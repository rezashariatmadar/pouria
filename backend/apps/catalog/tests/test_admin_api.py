"""Admin API tests: auth, fast table, batch update, bulk percentage, product CRUD."""
import json
import time

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.catalog.models import PriceAuditLog, Product, ProductVariant

pytestmark = pytest.mark.django_db

User = get_user_model()


# ---------- Auth ----------

def test_admin_login_rejects_bad_password(db):
    User.objects.create_user(username="pouria", password="secret-123", is_staff=True)
    resp = Client().post(
        "/api/v1/auth/admin/login",
        data=json.dumps({"username": "pouria", "password": "wrong"}),
        content_type="application/json",
    )
    assert resp.status_code == 401


def test_admin_login_rejects_non_staff(db):
    User.objects.create_user(username="customer", password="secret-123")
    resp = Client().post(
        "/api/v1/auth/admin/login",
        data=json.dumps({"username": "customer", "password": "secret-123"}),
        content_type="application/json",
    )
    assert resp.status_code == 401


def test_admin_endpoints_require_auth(client):
    resp = client.get("/api/v1/admin/products/fast-table")
    assert resp.status_code == 401


# ---------- Fast table ----------

def test_fast_table_rows_and_variant_subrows(staff_client, products):
    resp = staff_client.get("/api/v1/admin/products/fast-table")
    assert resp.status_code == 200
    body = resp.json()
    assert body["products"] == 5

    rows = body["rows"]
    # هر قطعه + تنوع‌هایش: 5 قطعه + 3 تنوع چراغ = 8 ردیف
    assert len(rows) == 8

    headlight_rows = [r for r in rows if r[0] == products["headlight"].pk]
    assert len(headlight_rows) == 4  # خود قطعه + 3 تنوع
    product_row = next(r for r in headlight_rows if r[8] is None)
    assert product_row[4] == 1_450_000  # قیمت پایه
    pair_row = next(r for r in headlight_rows if r[1].endswith("جفت (راست + چپ)"))
    assert pair_row[4] == 2_800_000  # price_override
    assert pair_row[8] == products["v_pair"].pk


def test_fast_table_under_100ms_with_30_skus(staff_client, products, taxonomy):
    """نگهبان رگرسیون هدف <۱۰۰ms (در مقیاس MVP)."""
    from apps.catalog.models import Category
    cat = Category.objects.get(slug="brakes")
    for i in range(25):
        p = Product.objects.create(
            title=f"قطعه تست شماره {i}", slug=f"perf-part-{i}",
            brand="برند تست", category=cat, price=100_000 + i, stock=i,
        )
        ProductVariant.objects.create(product=p, name="سمت راست", stock=1)

    start = time.perf_counter()
    resp = staff_client.get("/api/v1/admin/products/fast-table")
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert resp.status_code == 200
    # ۵ قطعه موجود (۸ ردیف) + ۲۵ قطعه جدید × (خودش + ۱ تنوع) = ۵۸
    assert len(resp.json()["rows"]) == 8 + 25 * 2
    assert elapsed_ms < 100, f"fast-table took {elapsed_ms:.0f}ms"


# ---------- Batch update ----------

def test_batch_update_price_creates_audit_log(staff_client, products):
    pads = products["pads"]
    resp = staff_client.patch(
        "/api/v1/admin/products/batch-update",
        data=json.dumps([{"id": pads.pk, "price": 950_000, "stock": 10}]),
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] == 1

    pads.refresh_from_db()
    assert pads.price == 950_000
    assert pads.stock == 10
    log = PriceAuditLog.objects.get(product=pads)
    assert log.old_price == 890_000
    assert log.new_price == 950_000
    assert log.changed_by == "pouria"


def test_batch_update_same_price_no_log(staff_client, products):
    pads = products["pads"]
    staff_client.patch(
        "/api/v1/admin/products/batch-update",
        data=json.dumps([{"id": pads.pk, "price": pads.price}]),
        content_type="application/json",
    )
    assert PriceAuditLog.objects.count() == 0


def test_batch_update_variant_row(staff_client, products):
    resp = staff_client.patch(
        "/api/v1/admin/products/batch-update",
        data=json.dumps([
            {"id": products["headlight"].pk, "variant_id": products["v_left"].pk, "stock": 9},
        ]),
        content_type="application/json",
    )
    assert resp.status_code == 200
    products["v_left"].refresh_from_db()
    assert products["v_left"].stock == 9
    # قیمت پایه قطعه دست‌نخورده
    products["headlight"].refresh_from_db()
    assert products["headlight"].price == 1_450_000


def test_batch_update_atomic_on_bad_id(staff_client, products):
    """یک id ناموجود باید کل بسته را برگرداند — بدون نوشتن نصفه."""
    pads = products["pads"]
    resp = staff_client.patch(
        "/api/v1/admin/products/batch-update",
        data=json.dumps([
            {"id": pads.pk, "price": 999_000},
            {"id": 999999, "price": 1},
        ]),
        content_type="application/json",
    )
    assert resp.status_code == 404
    pads.refresh_from_db()
    assert pads.price == 890_000  # rollback
    assert PriceAuditLog.objects.count() == 0


def test_batch_update_call_for_price_toggle(staff_client, products):
    resp = staff_client.patch(
        "/api/v1/admin/products/batch-update",
        data=json.dumps([{"id": products["pads"].pk, "is_call_for_price": True, "price": 0}]),
        content_type="application/json",
    )
    assert resp.status_code == 200
    products["pads"].refresh_from_db()
    assert products["pads"].is_call_for_price is True


# ---------- Bulk percentage ----------

def test_bulk_percentage_by_brand_rounds_to_1000(staff_client, products, taxonomy):
    from apps.catalog.models import Category
    cat = Category.objects.get(slug="brakes")
    Product.objects.create(
        title="دیسک تست", slug="disc-test", brand="ایساکو", category=cat,
        price=1_234_500, stock=3,
    )
    resp = staff_client.post(
        "/api/v1/admin/products/bulk-percentage",
        data=json.dumps({"percentage": 10, "brand": "ایساکو"}),
        content_type="application/json",
    )
    assert resp.status_code == 200

    disc = Product.objects.get(slug="disc-test")
    assert disc.price == 1_358_000  # 1234500×1.1=1357950 → گرد به 1358000

    # لنت هم ایساکوست → 890000×1.1=979000
    products["pads"].refresh_from_db()
    assert products["pads"].price == 979_000
    assert PriceAuditLog.objects.filter(product=disc).exists()


def test_bulk_percentage_negative(staff_client, products):
    resp = staff_client.post(
        "/api/v1/admin/products/bulk-percentage",
        data=json.dumps({"percentage": -10, "brand": "دنسو"}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    products["plugs"].refresh_from_db()
    assert products["plugs"].price == 1_278_000  # 1420000×0.9


def test_bulk_percentage_leaves_variant_overrides(staff_client, products):
    """price_override صریح تنوع‌ها درصد نمی‌گیرد."""
    staff_client.post(
        "/api/v1/admin/products/bulk-percentage",
        data=json.dumps({"percentage": 100, "brand": "کروز"}),
        content_type="application/json",
    )
    products["v_pair"].refresh_from_db()
    assert products["v_pair"].price_override == 2_800_000


# ---------- Product CRUD ----------

def test_create_product_with_variants_and_compat(staff_client, products, taxonomy):
    payload = {
        "title": "آینه بغل پژو ۲۰۶ کروز",
        "brand": "کروز",
        "category_slug": "body",
        "part_number": "MIR-206-01",
        "price": 700_000,
        "stock": 0,
        "model_slugs": ["peugeot-206"],  # همه تیپ‌های ۲۰۶ (تیپ ۲ + تیپ ۵)
        "variants": [
            {"name": "سمت راست", "sku_modifier": "R", "stock": 2, "is_default": True},
            {"name": "سمت چپ", "sku_modifier": "L", "stock": 3},
        ],
    }
    resp = staff_client.post(
        "/api/v1/admin/products", data=json.dumps(payload), content_type="application/json"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["slug"] == "mir-206-01"  # اسلاگ از پارت‌نامبر

    product = Product.objects.get(pk=body["id"])
    assert product.variants.count() == 2
    assert product.compatible_trims.count() == 2  # تیپ ۲ و تیپ ۵
    assert {t.pk for t in product.compatible_trims.all()} == {
        taxonomy["t2"].pk, taxonomy["t5"].pk,
    }


def test_create_product_slug_fallback_for_persian(staff_client, products):
    payload = {
        "title": "قطعه فارسی بدون کد",
        "brand": "برند",
        "category_slug": "brakes",
        "price": 100_000,
        "model_slugs": [],
    }
    resp = staff_client.post(
        "/api/v1/admin/products", data=json.dumps(payload), content_type="application/json"
    )
    assert resp.status_code == 200
    slug = resp.json()["slug"]
    assert slug  # فارسی یا uuid — فقط باید یکتا و غیرخالی باشد


def test_update_product_replaces_variants(staff_client, products):
    headlight = products["headlight"]
    payload = {
        "title": headlight.title,
        "brand": headlight.brand,
        "category_slug": "body",
        "part_number": "CR-QK-04",
        "price": 1_500_000,
        "model_slugs": ["quick"],
        "variants": [
            {"id": products["v_right"].pk, "name": "سمت راست (شاگرد)", "sku_modifier": "R", "stock": 7},
        ],
    }
    resp = staff_client.patch(
        f"/api/v1/admin/products/{headlight.pk}",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert resp.status_code == 200
    headlight.refresh_from_db()
    assert headlight.price == 1_500_000
    assert headlight.variants.count() == 1
    products["v_right"].refresh_from_db()
    assert products["v_right"].stock == 7
