"""موجودی قابل فروش — مهم‌ترین محاسبه سیستم.

موجودی قابل فروش = موجودی انبار − مجموع قفل‌های فعال سبد.
قفل فعال یعنی expires_at > now (انقضای تنبل — بدون job پس‌زمینه).
"""

from django.db.models import Sum
from django.utils import timezone

from .models import CartHold


def held_quantity(product, variant=None):
    """مجموع تعداد قفل‌شده در قفل‌های فعال برای یک قطعه/تنوع."""
    qs = CartHold.objects.filter(
        product=product,
        variant=variant,
        expires_at__gt=timezone.now(),
    )
    return qs.aggregate(total=Sum("quantity"))["total"] or 0


def available_stock(product, variant=None):
    """موجودی قابل فروش برای یک قطعه (یا تنوع مشخص)."""
    stock = variant.stock if variant is not None else product.stock
    return max(stock - held_quantity(product, variant), 0)


def variant_available_stock(variant):
    """موجودی قابل فروش برای یک تنوع (شکل رایج در کاتالوگ)."""
    return available_stock(variant.product, variant)
