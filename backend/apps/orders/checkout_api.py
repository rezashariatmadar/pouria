"""Checkout API: create payment (order + stock holds), verify payment, mock-pay."""
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.accounts.auth import JWTAuth
from apps.integrations.gateways import MockGateway, get_gateway
from apps.integrations.sms import get_sms
from apps.catalog.models import Product, ProductVariant
from .models import CartHold, Customer, Order, OrderLine
from .services import available_stock

router = Router(tags=["checkout"], auth=JWTAuth())

# هزینه ارسال ثابت به تومان — همان مقادیر سبد خرید.
SHIPPING_COSTS = {
    Order.Shipping.TIPAX: 45_000,
    Order.Shipping.POST: 30_000,
    Order.Shipping.COURIER: 25_000,
    Order.Shipping.FREIGHT: 60_000,
    Order.Shipping.PICKUP: 0,
}


class CheckoutItemIn(Schema):
    product_id: int
    variant_id: int | None = None
    quantity: int


class CheckoutIn(Schema):
    items: list[CheckoutItemIn]
    shipping_method: str
    vin_or_chassis: str = ""
    customer_note: str = ""
    shipping_address: str
    postal_code: str = ""


class CheckoutOut(Schema):
    payment_url: str
    order_number: str
    order_id: int


class VerifyPaymentIn(Schema):
    order_id: int | None = None
    order_number: str | None = None
    track_id: str


class VerifyPaymentOut(Schema):
    status: int
    order_number: str
    paid: bool


class MockPayIn(Schema):
    track_id: str
    success: bool


def _checkout_customer(request) -> Customer:
    """JWTAuth resolves a Django user; the customer is looked up by username ==
    phone number (the OTP flow guarantees that mapping)."""
    username = getattr(request.auth, "username", None)
    if username:
        customer = Customer.objects.filter(phone_number=username).first()
        if customer:
            return customer
    raise HttpError(403, "برای ثبت سفارش باید با شماره موبایل وارد شوید")


def _resolve_order(order_id: int | None, order_number: str | None) -> Order:
    if order_id is not None:
        return get_object_or_404(Order, pk=order_id)
    if order_number:
        return get_object_or_404(Order, order_number=order_number)
    raise HttpError(400, "order_id یا order_number لازم است")


@router.post("/checkout/create-payment", response=CheckoutOut)
@transaction.atomic
def create_payment(request, payload: CheckoutIn):
    """Server-side pricing and validation — client prices are never trusted."""
    if payload.shipping_method not in Order.Shipping.values:
        raise HttpError(400, "روش ارسال نامعتبر است")
    if not payload.items:
        raise HttpError(400, "سبد خرید خالی است")

    customer = _checkout_customer(request)

    subtotal = 0
    lines = []  # (product, variant, quantity, unit_price)
    for item in payload.items:
        product = Product.objects.filter(pk=item.product_id).first()
        if product is None or not product.is_active:
            raise HttpError(400, "یکی از قطعات یافت نشد یا غیرفعال است")
        variant = None
        if item.variant_id is not None:
            variant = ProductVariant.objects.filter(product=product, pk=item.variant_id).first()
            if variant is None:
                raise HttpError(400, "تنوع انتخابی یافت نشد")
        if product.is_call_for_price:
            raise HttpError(400, f"«{product.title}» استعلام قیمت است و آنلاین فروش ندارد")
        if item.quantity < 1:
            raise HttpError(400, "تعداد باید حداقل ۱ باشد")
        if item.quantity > product.max_order_quantity:
            raise HttpError(
                400,
                f"حداکثر تعداد قابل سفارش برای «{product.title}» {product.max_order_quantity} عدد است",
            )
        if available_stock(product, variant) < item.quantity:
            raise HttpError(400, f"موجودی «{product.title}» کافی نیست")

        unit_price = product.effective_price(variant)
        subtotal += unit_price * item.quantity
        lines.append((product, variant, item.quantity, unit_price))

    shipping_cost = SHIPPING_COSTS[payload.shipping_method]
    total = subtotal + shipping_cost

    order = Order.objects.create(
        customer=customer,
        status=Order.Status.PENDING_PAYMENT,
        shipping_method=payload.shipping_method,
        vin_or_chassis=payload.vin_or_chassis.strip(),
        customer_note=payload.customer_note.strip(),
        shipping_address=payload.shipping_address.strip(),
        postal_code=payload.postal_code.strip(),
        subtotal=subtotal,
        shipping_cost=shipping_cost,
        total_amount=total,
    )

    expires_at = timezone.now() + timezone.timedelta(minutes=settings.CART_HOLD_MINUTES)
    for product, variant, quantity, unit_price in lines:
        OrderLine.objects.create(
            order=order,
            product=product,
            variant=variant,
            product_title=product.title,
            quantity=quantity,
            unit_price=unit_price,
        )
        CartHold.objects.create(
            cart_token=order.order_number,
            product=product,
            variant=variant,
            quantity=quantity,
            order=order,
            expires_at=expires_at,
        )

    callback_url = f"{settings.FRONTEND_URL}/checkout/verify"
    gateway = get_gateway()
    payment_url, track_id = gateway.request_payment(
        amount_rial=total * 10,  # تومان → ریال
        order_number=order.order_number,
        callback_url=callback_url,
    )
    order.payment_tracking_code = track_id
    order.save(update_fields=["payment_tracking_code"])

    return CheckoutOut(payment_url=payment_url, order_number=order.order_number, order_id=order.pk)


@router.post("/checkout/verify-payment", response=VerifyPaymentOut)
@transaction.atomic
def verify_payment(request, payload: VerifyPaymentIn):
    order = _resolve_order(payload.order_id, payload.order_number)
    if not payload.track_id or payload.track_id != order.payment_tracking_code:
        raise HttpError(400, "کد رهگیری پرداخت با سفارش مطابقت ندارد")

    result = get_gateway().verify(payload.track_id)

    if result["paid"]:
        if order.status != Order.Status.PAID:  # idempotent
            order.status = Order.Status.PAID
            order.save(update_fields=["status"])
            for line in order.lines.select_related("product", "variant"):
                if line.variant is not None:
                    ProductVariant.objects.filter(pk=line.variant.pk).update(
                        stock=F("stock") - line.quantity
                    )
                else:
                    Product.objects.filter(pk=line.product.pk).update(
                        stock=F("stock") - line.quantity
                    )
            order.holds.all().delete()
            get_sms().send_order_confirmation(order.customer.phone_number, order.order_number)

    return VerifyPaymentOut(
        status=result["status"],
        order_number=order.order_number,
        paid=result["paid"],
    )


@router.post("/checkout/mock-pay")
def mock_pay(request, payload: MockPayIn):
    """Simulates the bank callback — only active with the mock provider."""
    if settings.PAYMENT_PROVIDER != "mock":
        raise HttpError(404, "این مسیر فقط در حالت آزمایشی درگاه فعال است")
    if MockGateway.mark_paid(payload.track_id, payload.success) is None:
        raise HttpError(404, "تراکنش یافت نشد")
    return {"track_id": payload.track_id, "success": payload.success}
