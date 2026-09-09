"""Admin orders API: cartable, detail, status transitions, VIN verification."""
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.accounts.auth import StaffAuth
from .models import Order

router = Router(tags=["admin-orders"], auth=StaffAuth())

PAGE_SIZE = 20


class StatusIn(Schema):
    status: str


class VinVerifyIn(Schema):
    verified: bool
    note: str = ""


def _order_out(order: Order) -> dict:
    return {
        "id": order.pk,
        "order_number": order.order_number,
        "status": order.status,
        "status_display": order.get_status_display(),
        "shipping_method": order.shipping_method,
        "shipping_method_display": order.get_shipping_method_display(),
        "customer": {
            "phone_number": order.customer.phone_number,
            "full_name": order.customer.full_name,
        },
        "vin_or_chassis": order.vin_or_chassis,
        "vin_verified": order.vin_verified,
        "admin_verification_note": order.admin_verification_note,
        "customer_note": order.customer_note,
        "shipping_address": order.shipping_address,
        "postal_code": order.postal_code,
        "subtotal": order.subtotal,
        "shipping_cost": order.shipping_cost,
        "total_amount": order.total_amount,
        "payment_tracking_code": order.payment_tracking_code,
        "shipping_tracking_code": order.shipping_tracking_code,
        "created_at": order.created_at.isoformat(),
        "lines": [
            {
                "title": line.product_title,
                "quantity": line.quantity,
                "unit_price": line.unit_price,
                "total": line.quantity * line.unit_price,
            }
            for line in order.lines.select_related("product", "variant")
        ],
    }


@router.get("/admin/orders")
def list_orders(request, status: str | None = None, page: int = 1, q: str | None = None):
    qs = Order.objects.select_related("customer").prefetch_related("lines")

    if status:
        if status not in Order.Status.values:
            raise HttpError(400, "وضعیت نامعتبر است")
        qs = qs.filter(status=status)
    if q:
        qs = qs.filter(
            Q(order_number__icontains=q)
            | Q(customer__phone_number__icontains=q)
            | Q(vin_or_chassis__icontains=q)
        )

    total = qs.count()
    page = max(page, 1)
    start = (page - 1) * PAGE_SIZE
    orders = qs[start : start + PAGE_SIZE]

    # کارت‌های آمار بالای کارتابل
    stats = Order.objects.aggregate(
        new_orders=Count("pk", filter=Q(status=Order.Status.PAID)),
        awaiting_vin=Count(
            "pk",
            filter=Q(status=Order.Status.PAID, vin_verified=False)
            & ~Q(vin_or_chassis=""),
        ),
        packing=Count("pk", filter=Q(status=Order.Status.PROCESSING)),
        shipped_today=Count(
            "pk",
            filter=Q(status=Order.Status.SHIPPED),
        ),
    )

    return {
        "items": [_order_out(o) for o in orders],
        "total": total,
        "page": page,
        "page_size": PAGE_SIZE,
        "stats": stats,
    }


@router.get("/admin/orders/{order_id}")
def order_detail(request, order_id: int):
    order = get_object_or_404(Order.objects.select_related("customer"), pk=order_id)
    return _order_out(order)


@router.post("/admin/orders/{order_id}/status")
def set_order_status(request, order_id: int, payload: StatusIn):
    order = get_object_or_404(Order, pk=order_id)
    if payload.status not in Order.Status.values:
        raise HttpError(400, "وضعیت نامعتبر است")
    order.status = payload.status
    order.save(update_fields=["status"])
    return {"id": order.pk, "status": order.status}


@router.post("/admin/orders/{order_id}/vin-verify")
def verify_vin(request, order_id: int, payload: VinVerifyIn):
    """جعبه استعلام شاسی: تایید کارشناس یا ثبت نیاز به تماس با مشتری."""
    order = get_object_or_404(Order, pk=order_id)
    order.vin_verified = payload.verified
    order.admin_verification_note = payload.note
    order.save(update_fields=["vin_verified", "admin_verification_note"])
    return {"id": order.pk, "vin_verified": order.vin_verified, "note": order.admin_verification_note}
