"""Checkout tests: create-payment validation, stock holds, verify-payment, mock-pay."""
import json
from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from apps.integrations.gateways import MockGateway
from apps.orders.models import CartHold, Customer, Order, OrderLine

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _reset_mock_gateway():
    MockGateway.payments = {}
    MockGateway._next_id = 0


@pytest.fixture
def customer(db):
    return Customer.objects.create(phone_number="09121234567", full_name="رضا محمدی")


@pytest.fixture
def customer_client(client, customer, django_user_model):
    # Mirror the OTP flow: JWT is issued for a User whose username is the phone.
    user = django_user_model.objects.create_user(username=customer.phone_number, password="x")
    token = str(RefreshToken.for_user(user).access_token)
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {token}"
    return client


def _post(client, url, data):
    return client.post(url, data=json.dumps(data), content_type="application/json")


def _checkout_payload(products, **overrides):
    payload = {
        "items": [{"product_id": products["pads"].pk, "quantity": 2}],
        "shipping_method": "tipax",
        "vin_or_chassis": "NAS411100P1452098",
        "customer_note": "لطفاً زودتر ارسال کنید",
        "shipping_address": "تهران، خیابان ولیعصر، پلاک ۱۰",
        "postal_code": "1234567890",
    }
    payload.update(overrides)
    return payload


# ---------- create-payment: happy path ----------

def test_create_payment_happy_path(customer_client, products):
    resp = _post(customer_client, "/api/v1/checkout/create-payment", _checkout_payload(products))
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["order_number"].startswith("YK-")
    assert body["payment_url"].startswith("http://localhost:3000/mock-payment?track_id=mock-")
    assert f"order={body['order_number']}" in body["payment_url"]

    order = Order.objects.get(pk=body["order_id"])
    assert order.customer.phone_number == "09121234567"
    assert order.status == Order.Status.PENDING_PAYMENT
    assert order.shipping_method == "tipax"
    assert order.vin_or_chassis == "NAS411100P1452098"
    assert order.shipping_address == "تهران، خیابان ولیعصر، پلاک ۱۰"

    # price snapshot from CURRENT price, not client input
    line = order.lines.get()
    assert line.unit_price == products["pads"].price  # 890_000
    assert line.quantity == 2
    assert line.product_title == products["pads"].title
    assert order.subtotal == 890_000 * 2
    assert order.shipping_cost == 45_000
    assert order.total_amount == 890_000 * 2 + 45_000

    # hold created with cart_token = order_number
    hold = CartHold.objects.get(order=order)
    assert hold.cart_token == order.order_number
    assert hold.quantity == 2
    assert hold.expires_at > timezone.now()
    assert (hold.expires_at - timezone.now()) <= timedelta(minutes=15)

    # track id stored on order; amount in RIAL inside the gateway
    assert order.payment_tracking_code
    payment = MockGateway.payments[order.payment_tracking_code]
    assert payment["amount_rial"] == order.total_amount * 10


def test_create_payment_variant_price_override(customer_client, products):
    payload = _checkout_payload(
        products,
        items=[{"product_id": products["headlight"].pk, "variant_id": products["v_pair"].pk, "quantity": 1}],
        shipping_method="pickup",
    )
    resp = _post(customer_client, "/api/v1/checkout/create-payment", payload)
    assert resp.status_code == 200
    order = Order.objects.get(pk=resp.json()["order_id"])
    line = order.lines.get()
    assert line.variant.pk == products["v_pair"].pk
    assert line.unit_price == 2_800_000  # price_override, not product price
    assert order.subtotal == 2_800_000
    assert order.shipping_cost == 0
    assert order.total_amount == 2_800_000


# ---------- create-payment: rejections ----------

def test_create_payment_insufficient_stock_rejected(customer_client, products):
    payload = _checkout_payload(products, items=[{"product_id": products["sensor"].pk, "quantity": 6}])
    resp = _post(customer_client, "/api/v1/checkout/create-payment", payload)
    assert resp.status_code == 400
    assert not Order.objects.exists()
    assert not CartHold.objects.exists()


def test_create_payment_hold_blocks_second_order(customer_client, products):
    """An active hold must reduce sellable stock for a second checkout."""
    first = _post(customer_client, "/api/v1/checkout/create-payment", _checkout_payload(products))
    assert first.status_code == 200
    # pads stock 12, first order holds 2 → second order of 11 must fail
    payload = _checkout_payload(products, items=[{"product_id": products["pads"].pk, "quantity": 11}])
    resp = _post(customer_client, "/api/v1/checkout/create-payment", payload)
    assert resp.status_code == 400
    assert Order.objects.count() == 1


def test_create_payment_max_order_quantity_rejected(customer_client, products):
    # headlight max_order_quantity = 4
    payload = _checkout_payload(
        products,
        items=[{"product_id": products["headlight"].pk, "variant_id": products["v_right"].pk, "quantity": 5}],
    )
    resp = _post(customer_client, "/api/v1/checkout/create-payment", payload)
    assert resp.status_code == 400
    assert not Order.objects.exists()


def test_create_payment_call_for_price_rejected(customer_client, products):
    products["radiator"].is_call_for_price = True
    products["radiator"].stock = 5
    products["radiator"].save()
    payload = _checkout_payload(products, items=[{"product_id": products["radiator"].pk, "quantity": 1}])
    resp = _post(customer_client, "/api/v1/checkout/create-payment", payload)
    assert resp.status_code == 400
    assert not Order.objects.exists()


def test_create_payment_inactive_product_rejected(customer_client, products):
    products["pads"].is_active = False
    products["pads"].save()
    resp = _post(customer_client, "/api/v1/checkout/create-payment", _checkout_payload(products))
    assert resp.status_code == 400
    assert not Order.objects.exists()


def test_create_payment_invalid_shipping_method_rejected(customer_client, products):
    payload = _checkout_payload(products, shipping_method="teleport")
    resp = _post(customer_client, "/api/v1/checkout/create-payment", payload)
    assert resp.status_code == 400


def test_create_payment_requires_auth(client, products):
    resp = _post(client, "/api/v1/checkout/create-payment", _checkout_payload(products))
    assert resp.status_code == 401


# ---------- verify-payment ----------

def _create_order(client, products):
    resp = _post(client, "/api/v1/checkout/create-payment", _checkout_payload(products))
    assert resp.status_code == 200
    return resp.json()


def _pay(client, created, success=True):
    """Simulate the bank callback (mock provider) for a created order."""
    track_id = Order.objects.get(pk=created["order_id"]).payment_tracking_code
    resp = _post(client, "/api/v1/checkout/mock-pay", {"track_id": track_id, "success": success})
    assert resp.status_code == 200
    return track_id


def test_verify_payment_success_decrements_stock_and_deletes_holds(customer_client, products):
    created = _create_order(customer_client, products)
    track_id = _pay(customer_client, created)

    resp = _post(
        customer_client,
        "/api/v1/checkout/verify-payment",
        {"order_id": created["order_id"], "track_id": track_id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["paid"] is True
    assert body["status"] == 100
    assert body["order_number"] == created["order_number"]

    order = Order.objects.get(pk=created["order_id"])
    assert order.status == Order.Status.PAID

    pads = products["pads"]
    pads.refresh_from_db()
    assert pads.stock == 12 - 2  # stock decremented

    assert not CartHold.objects.filter(order=order).exists()
    assert OrderLine.objects.filter(order=order).count() == 1


def test_verify_payment_by_order_number(customer_client, products):
    created = _create_order(customer_client, products)
    track_id = _pay(customer_client, created)
    resp = _post(
        customer_client,
        "/api/v1/checkout/verify-payment",
        {"order_number": created["order_number"], "track_id": track_id},
    )
    assert resp.status_code == 200
    assert resp.json()["paid"] is True


def test_verify_payment_failure_leaves_everything_unchanged(customer_client, products):
    created = _create_order(customer_client, products)
    order = Order.objects.get(pk=created["order_id"])

    # simulate a failed payment (bank says no)
    resp = _post(customer_client, "/api/v1/checkout/mock-pay", {"track_id": order.payment_tracking_code, "success": False})
    assert resp.status_code == 200

    resp = _post(
        customer_client,
        "/api/v1/checkout/verify-payment",
        {"order_id": created["order_id"], "track_id": order.payment_tracking_code},
    )
    assert resp.status_code == 200
    assert resp.json()["paid"] is False

    order.refresh_from_db()
    products["pads"].refresh_from_db()
    assert order.status == Order.Status.PENDING_PAYMENT
    assert products["pads"].stock == 12  # untouched
    assert CartHold.objects.filter(order=order).exists()  # hold kept

    # a second pending order for the same stock is still blocked by the hold
    payload = _checkout_payload(products, items=[{"product_id": products["pads"].pk, "quantity": 11}])
    resp = _post(customer_client, "/api/v1/checkout/create-payment", payload)
    assert resp.status_code == 400


def test_verify_payment_wrong_track_id_rejected(customer_client, products):
    created = _create_order(customer_client, products)
    resp = _post(
        customer_client,
        "/api/v1/checkout/verify-payment",
        {"order_id": created["order_id"], "track_id": "mock-999"},
    )
    assert resp.status_code == 400


# ---------- mock-pay endpoint ----------

def test_mock_pay_marks_payment_paid(customer_client, products):
    created = _create_order(customer_client, products)
    track_id = Order.objects.get(pk=created["order_id"]).payment_tracking_code

    resp = _post(customer_client, "/api/v1/checkout/mock-pay", {"track_id": track_id, "success": True})
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    resp = _post(
        customer_client,
        "/api/v1/checkout/verify-payment",
        {"order_id": created["order_id"], "track_id": track_id},
    )
    assert resp.json()["paid"] is True


def test_mock_pay_unknown_track_id_404s(customer_client):
    resp = _post(customer_client, "/api/v1/checkout/mock-pay", {"track_id": "mock-404", "success": True})
    assert resp.status_code == 404


def test_mock_pay_only_active_in_mock_mode(customer_client, products, settings):
    settings.PAYMENT_PROVIDER = "zibal"
    created = _create_order(customer_client, products)
    order = Order.objects.get(pk=created["order_id"])
    # gateway already returned a mock URL (provider resolved at request time);
    # but the mock-pay endpoint itself must refuse to run
    resp = _post(customer_client, "/api/v1/checkout/mock-pay", {"track_id": order.payment_tracking_code, "success": True})
    assert resp.status_code == 404
