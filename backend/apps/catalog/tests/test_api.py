"""Catalog API tests: hierarchy, filters, search, ordering, detail."""
import pytest
from django.test import Client

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return Client()


def get_products(client, **params):
    query = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
    resp = client.get(f"/api/v1/catalog/products?{query}")
    assert resp.status_code == 200
    body = resp.json()
    return body, [item["slug"] for item in body["items"]]


def test_vehicle_hierarchy(client, taxonomy):
    resp = client.get("/api/v1/vehicles/hierarchy")
    assert resp.status_code == 200
    makes = resp.json()
    assert [m["slug"] for m in makes] == ["ikco", "saipa"]

    ikco = makes[0]
    assert ikco["name"] == "ایران‌خودرو"
    model_206 = next(m for m in ikco["models"] if m["slug"] == "peugeot-206")
    assert {t["slug"] for t in model_206["trims"]} == {"type-2", "type-5-tu5"}


def test_categories(client, products):
    resp = client.get("/api/v1/catalog/categories")
    assert resp.status_code == 200
    assert {c["slug"] for c in resp.json()} >= {"brakes", "electrical", "body", "cooling"}


def test_filter_by_make(client, products):
    body, slugs = get_products(client, make="saipa")
    assert set(slugs) == {"quick-headlight-crouse", "spark-plugs-iridium-denso"}


def test_filter_by_model(client, products):
    body, slugs = get_products(client, model="quick")
    assert set(slugs) == {"quick-headlight-crouse", "spark-plugs-iridium-denso"}


def test_filter_by_trim(client, products):
    body, slugs = get_products(client, trim="type-5-tu5")
    assert set(slugs) == {
        "brake-pads-206-type5-isaco",
        "oxygen-sensor-206-crouse",
        "spark-plugs-iridium-denso",
    }


def test_filter_by_category(client, products):
    body, slugs = get_products(client, category="brakes")
    assert slugs == ["brake-pads-206-type5-isaco"]


def test_search_by_title(client, products):
    body, slugs = get_products(client, q="لنت")
    assert slugs == ["brake-pads-206-type5-isaco"]


def test_search_by_part_number(client, products):
    body, slugs = get_products(client, q="OX-CR-206")
    assert slugs == ["oxygen-sensor-206-crouse"]


def test_search_by_isaco_code(client, products):
    body, slugs = get_products(client, q="16401002")
    assert slugs == ["brake-pads-206-type5-isaco"]


def test_combined_filters(client, products):
    body, slugs = get_products(client, make="ikco", category="electrical")
    assert set(slugs) == {"oxygen-sensor-206-crouse", "spark-plugs-iridium-denso"}


def test_out_of_stock_sorts_last(client, products):
    body, slugs = get_products(client)
    assert body["total"] == 5
    assert slugs[-1] == "radiator-405-pars-iran-radiator"  # stock 0 → last
    assert slugs[0] == "spark-plugs-iridium-denso"  # highest stock first


def test_variant_product_stock_is_sum_of_variants(client, products):
    body, slugs = get_products(client)
    headlight = next(i for i in body["items"] if i["slug"] == "quick-headlight-crouse")
    assert headlight["stock"] == 8  # 4 + 2 + 2
    assert {v["name"] for v in headlight["variants"]} == {
        "سمت راست (شاگرد)", "سمت چپ (راننده)", "جفت (راست + چپ)"
    }


def test_pagination_meta(client, products):
    body, _ = get_products(client)
    assert body["page"] == 1
    assert body["page_size"] == 24
    assert body["has_next"] is False


def test_product_detail(client, products):
    resp = client.get(f"/api/v1/catalog/products/{products['headlight'].pk}")
    assert resp.status_code == 200
    detail = resp.json()

    variants = {v["name"]: v for v in detail["variants"]}
    assert variants["سمت راست (شاگرد)"]["price"] == 1_450_000  # effective = product price
    assert variants["جفت (راست + چپ)"]["price"] == 2_800_000  # price_override
    assert detail["max_order_quantity"] == 4

    compat = detail["compatibility"]
    assert len(compat) == 1
    assert compat[0]["make"] == "سایپا"
    assert compat[0]["model"] == "کوئیک"
    assert compat[0]["trims"] == ["S"]


def test_product_detail_404(client, products):
    resp = client.get("/api/v1/catalog/products/999999")
    assert resp.status_code == 404
