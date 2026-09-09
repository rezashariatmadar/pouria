"""مهم‌ترین تست‌های سیستم: ریاضی قفل سبد (موجودی قابل فروش).

available = stock − Σ(active holds) — انقضای تنبل، بدون job پس‌زمینه.
"""
from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from apps.orders.models import CartHold
from apps.orders.services import available_stock, held_quantity

pytestmark = pytest.mark.django_db


def make_hold(product, quantity, minutes, variant=None, token="tok-1"):
    return CartHold.objects.create(
        cart_token=token,
        product=product,
        variant=variant,
        quantity=quantity,
        expires_at=timezone.now() + timedelta(minutes=minutes),
    )


def test_no_holds_full_stock(products):
    assert available_stock(products["pads"]) == 12


def test_active_hold_reduces_available(products):
    make_hold(products["pads"], quantity=3, minutes=15)
    assert held_quantity(products["pads"]) == 3
    assert available_stock(products["pads"]) == 9


def test_expired_hold_is_ignored(products):
    """هسته طراحی: قفل منقضی‌شده بدون هیچ jobی از محاسبه خارج می‌شود."""
    expired = CartHold.objects.create(
        cart_token="tok-old",
        product=products["pads"],
        quantity=5,
        expires_at=timezone.now() - timedelta(minutes=1),
    )
    assert expired.is_active is False
    assert held_quantity(products["pads"]) == 0
    assert available_stock(products["pads"]) == 12


def test_multiple_active_holds_sum_up(products):
    make_hold(products["pads"], quantity=2, minutes=15, token="tok-a")
    make_hold(products["pads"], quantity=3, minutes=10, token="tok-b")
    assert available_stock(products["pads"]) == 7


def test_hold_never_makes_stock_negative(products):
    make_hold(products["pads"], quantity=50, minutes=15)
    assert available_stock(products["pads"]) == 0


def test_variant_holds_are_isolated(products):
    """قفل روی تنوع راست نباید موجودی چپ را کم کند."""
    headlight = products["headlight"]
    make_hold(headlight, quantity=3, minutes=15, variant=products["v_right"])
    assert available_stock(headlight, products["v_right"]) == 1  # 4 − 3
    assert available_stock(headlight, products["v_left"]) == 2  # دست‌نخورده
    assert available_stock(headlight, products["v_pair"]) == 2


def test_product_level_stock_ignores_variant_holds(products):
    """موجودی سطح قطعه فقط قفل‌های بدون تنوع را می‌شمارد."""
    headlight = products["headlight"]
    make_hold(headlight, quantity=3, minutes=15, variant=products["v_right"])
    assert available_stock(headlight) == 0  # stock خود قطعه (0) − قفل بدون تنوع (0)


def test_api_detail_stock_is_hold_aware(products):
    """صفحه محصول موجودیِ hold-aware نشان می‌دهد؛ پرداخت همیشه سمت سرور دوباره اعتبارسنجی می‌کند."""
    make_hold(products["headlight"], quantity=3, minutes=15, variant=products["v_right"])
    client = Client()
    resp = client.get(f"/api/v1/catalog/products/{products['headlight'].pk}")
    assert resp.status_code == 200
    variants = {v["name"]: v for v in resp.json()["variants"]}
    assert variants["سمت راست (شاگرد)"]["stock"] == 1
    assert variants["سمت چپ (راننده)"]["stock"] == 2


def test_api_list_stock_is_hold_blind(products):
    """لیست کاتالوگ موجودی خام را نشان می‌دهد (سرعت) — هولد فقط ۱۵ دقیقه است."""
    make_hold(products["pads"], quantity=5, minutes=15)
    client = Client()
    resp = client.get("/api/v1/catalog/products?category=brakes")
    items = resp.json()["items"]
    assert items[0]["stock"] == 12  # خام، بدون کسر قفل
