"""Shared pytest fixtures — a minimal taxonomy + product set mirroring the seed data."""
import json

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.catalog.models import Category, Product, ProductVariant, VehicleMake, VehicleModel, VehicleTrim

User = get_user_model()


@pytest.fixture
def staff_user(db):
    return User.objects.create_user(username="pouria", password="secret-123", is_staff=True)


@pytest.fixture
def staff_client(client, staff_user):
    """Client با توکن JWT ادمین — برای همه تست‌های API ادمین."""
    resp = client.post(
        "/api/v1/auth/admin/login",
        data=json.dumps({"username": "pouria", "password": "secret-123"}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {resp.json()['access']}"
    return client


@pytest.fixture
def taxonomy(db):
    ikco = VehicleMake.objects.create(name="ایران‌خودرو", slug="ikco")
    saipa = VehicleMake.objects.create(name="سایپا", slug="saipa")

    peugeot206 = VehicleModel.objects.create(make=ikco, name="پژو ۲۰۶", slug="peugeot-206")
    t2 = VehicleTrim.objects.create(vehicle_model=peugeot206, name="تیپ ۲", slug="type-2")
    t5 = VehicleTrim.objects.create(vehicle_model=peugeot206, name="تیپ ۵ (موتور TU5)", slug="type-5-tu5")

    quick = VehicleModel.objects.create(make=saipa, name="کوئیک", slug="quick")
    quick_s = VehicleTrim.objects.create(vehicle_model=quick, name="S", slug="s")

    return {"ikco": ikco, "saipa": saipa, "peugeot206": peugeot206, "quick": quick,
            "t2": t2, "t5": t5, "quick_s": quick_s}


@pytest.fixture
def products(db, taxonomy):
    brakes = Category.objects.create(name="ترمز", slug="brakes")
    electrical = Category.objects.create(name="برقی", slug="electrical")
    body = Category.objects.create(name="بدنه", slug="body")
    cooling = Category.objects.create(name="خنک‌کننده", slug="cooling")

    pads = Product.objects.create(
        title="لنت ترمز جلو پژو ۲۰۶ تیپ ۵ (ایساکو شرکتی)",
        slug="brake-pads-206-type5-isaco",
        brand="ایساکو", category=brakes, price=890_000, stock=12, isaco_code="16401002",
    )
    pads.compatible_trims.set([taxonomy["t2"], taxonomy["t5"]])

    sensor = Product.objects.create(
        title="سنسور اکسیژن ۲۰۶ (سیم کوتاه کروز اصل)",
        slug="oxygen-sensor-206-crouse",
        brand="کروز", category=electrical, price=1_750_000, stock=6, part_number="OX-CR-206",
    )
    sensor.compatible_trims.set([taxonomy["t2"], taxonomy["t5"]])

    plugs = Product.objects.create(
        title="شمع موتور سوزنی ایریدیوم دنسو ژاپن (دست ۴ عددی)",
        slug="spark-plugs-iridium-denso",
        brand="دنسو", category=electrical, price=1_420_000, stock=20, part_number="IK20-DENSO",
    )
    plugs.compatible_trims.set([taxonomy["t5"], taxonomy["quick_s"]])

    headlight = Product.objects.create(
        title="چراغ جلو کوئیک کروز",
        slug="quick-headlight-crouse",
        brand="کروز", category=body, price=1_450_000, stock=0, part_number="CR-QK-04",
        max_order_quantity=4,
    )
    headlight.compatible_trims.set([taxonomy["quick_s"]])
    v_right = ProductVariant.objects.create(
        product=headlight, name="سمت راست (شاگرد)", sku_modifier="R", stock=4, is_default=True
    )
    v_left = ProductVariant.objects.create(
        product=headlight, name="سمت چپ (راننده)", sku_modifier="L", stock=2
    )
    v_pair = ProductVariant.objects.create(
        product=headlight, name="جفت (راست + چپ)", sku_modifier="PAIR",
        price_override=2_800_000, stock=2,
    )

    radiator = Product.objects.create(
        title="رادیاتور آب دولول پژو ۴۰۵ و پارس ایران رادیاتور",
        slug="radiator-405-pars-iran-radiator",
        brand="ایران رادیاتور", category=cooling, price=2_100_000, stock=0,
    )

    return {
        "pads": pads, "sensor": sensor, "plugs": plugs,
        "headlight": headlight, "radiator": radiator,
        "v_right": v_right, "v_left": v_left, "v_pair": v_pair,
    }
