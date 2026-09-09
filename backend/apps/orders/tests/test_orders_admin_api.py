"""Admin orders API tests: cartable filters, stats cards, VIN verification box."""
import json
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone

from apps.orders.models import Customer, Order, OrderLine

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def orders(products):
    """۳ سفارش: پرداخت‌شده با VIN تاییدنشده، پرداخت‌شده تاییدشده، در حال پردازش."""
    customer = Customer.objects.create(phone_number="09121234567", full_name="رضا محمدی")
    pads, plugs, headlight = products["pads"], products["plugs"], products["headlight"]

    o1 = Order.objects.create(
        customer=customer, status=Order.Status.PAID,
        vin_or_chassis="NAS411100P1452098",
        shipping_method=Order.Shipping.TIPAX,
        shipping_address="تهران، خیابان ولیعصر، پلاک ۱۰", postal_code="1234567890",
        subtotal=890_000, shipping_cost=45_000, total_amount=935_000,
    )
    OrderLine.objects.create(
        order=o1, product=pads, quantity=1, product_title=pads.title, unit_price=890_000
    )

    o2 = Order.objects.create(
        customer=customer, status=Order.Status.PAID, vin_verified=True,
        admin_verification_note="با شاسی سازگار است",
        shipping_method=Order.Shipping.POST,
        subtotal=1_420_000, shipping_cost=30_000, total_amount=1_450_000,
    )
    OrderLine.objects.create(
        order=o2, product=plugs, quantity=1, product_title=plugs.title, unit_price=1_420_000
    )

    o3 = Order.objects.create(
        customer=customer, status=Order.Status.PROCESSING,
        shipping_method=Order.Shipping.COURIER,
        subtotal=2_800_000, shipping_cost=25_000, total_amount=2_825_000,
    )
    OrderLine.objects.create(
        order=o3, product=headlight, variant=products["v_pair"],
        quantity=1, product_title=f"{headlight.title} — جفت (راست + چپ)", unit_price=2_800_000
    )
    return {"paid_unverified": o1, "paid_verified": o2, "processing": o3, "customer": customer}


# ---------- Listing ----------

def test_list_orders_returns_all_with_stats(staff_client, orders):
    resp = staff_client.get("/api/v1/admin/orders")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert body["stats"] == {"new_orders": 2, "awaiting_vin": 1, "packing": 1, "shipped_today": 0}


def test_list_orders_filter_by_status(staff_client, orders):
    resp = staff_client.get("/api/v1/admin/orders", {"status": "processing"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == orders["processing"].pk


def test_list_orders_search_by_order_number(staff_client, orders):
    o = orders["paid_unverified"]
    resp = staff_client.get("/api/v1/admin/orders", {"q": o.order_number})
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["order_number"] == o.order_number


def test_list_orders_search_by_phone(staff_client, orders):
    resp = staff_client.get("/api/v1/admin/orders", {"q": "09121234567"})
    assert resp.json()["total"] == 3


def test_list_orders_search_by_partial_vin(staff_client, orders):
    resp = staff_client.get("/api/v1/admin/orders", {"q": "P1452098"})
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["vin_or_chassis"] == "NAS411100P1452098"


def test_list_orders_rejects_invalid_status(staff_client, orders):
    resp = staff_client.get("/api/v1/admin/orders", {"status": "bogus"})
    assert resp.status_code == 400


def test_list_orders_requires_auth(client):
    resp = client.get("/api/v1/admin/orders")
    assert resp.status_code == 401


def test_order_detail_with_lines_and_customer(staff_client, orders):
    o = orders["paid_unverified"]
    resp = staff_client.get(f"/api/v1/admin/orders/{o.pk}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["order_number"] == o.order_number
    assert body["customer"]["phone_number"] == "09121234567"
    assert body["customer"]["full_name"] == "رضا محمدی"
    assert body["vin_verified"] is False
    assert len(body["lines"]) == 1
    assert body["lines"][0]["title"] == "لنت ترمز جلو پژو ۲۰۶ تیپ ۵ (ایساکو شرکتی)"
    assert body["lines"][0]["total"] == 890_000


# ---------- Status transitions ----------

def test_set_order_status(staff_client, orders):
    o = orders["paid_unverified"]
    resp = staff_client.post(
        f"/api/v1/admin/orders/{o.pk}/status",
        data=json.dumps({"status": "processing"}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    o.refresh_from_db()
    assert o.status == Order.Status.PROCESSING


def test_set_order_status_rejects_invalid(staff_client, orders):
    o = orders["paid_unverified"]
    resp = staff_client.post(
        f"/api/v1/admin/orders/{o.pk}/status",
        data=json.dumps({"status": "flying"}),
        content_type="application/json",
    )
    assert resp.status_code == 400
    o.refresh_from_db()
    assert o.status == Order.Status.PAID


# ---------- VIN verification (the moat) ----------

def test_verify_vin_confirms(staff_client, orders):
    o = orders["paid_unverified"]
    resp = staff_client.post(
        f"/api/v1/admin/orders/{o.pk}/vin-verify",
        data=json.dumps({"verified": True, "note": "با شاسی سازگار است"}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    o.refresh_from_db()
    assert o.vin_verified is True
    assert o.admin_verification_note == "با شاسی سازگار است"


def test_verify_vin_needs_contact(staff_client, orders):
    o = orders["paid_unverified"]
    resp = staff_client.post(
        f"/api/v1/admin/orders/{o.pk}/vin-verify",
        data=json.dumps({"verified": False, "note": "VIN با تیپ ۵ مطابقت ندارد — تماس بگیرید"}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    o.refresh_from_db()
    assert o.vin_verified is False
    assert "تماس" in o.admin_verification_note


# ---------- Order creation guards (proxy for checkout math) ----------

def test_order_number_format_yk(staff_client, orders):
    o = orders["processing"]
    assert o.order_number == f"YK-{10000 + o.pk}"
