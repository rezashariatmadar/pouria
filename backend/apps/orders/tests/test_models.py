import pytest

from apps.orders.models import Customer, Order

pytestmark = pytest.mark.django_db


def test_order_number_generated_from_pk():
    customer = Customer.objects.create(phone_number="09121234567")
    order = Order.objects.create(
        customer=customer,
        shipping_address="تهران، سعدت‌آباد",
        shipping_method=Order.Shipping.TIPAX,
        total_amount=1_000_000,
    )
    assert order.order_number == f"YK-{10000 + order.pk}"


def test_order_number_unique_by_construction():
    customer = Customer.objects.create(phone_number="09121234567")
    o1 = Order.objects.create(
        customer=customer, shipping_address="a", shipping_method="tipax", total_amount=1
    )
    o2 = Order.objects.create(
        customer=customer, shipping_address="b", shipping_method="tipax", total_amount=2
    )
    assert o1.order_number != o2.order_number
