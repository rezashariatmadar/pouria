from django.db import models
from django.utils import timezone


class Customer(models.Model):
    """مشتری — احراز هویت فقط با شماره موبایل (OTP)."""

    phone_number = models.CharField(max_length=11, unique=True, verbose_name="شماره موبایل")
    full_name = models.CharField(max_length=150, blank=True, verbose_name="نام و نام خانوادگی")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "مشتری"
        verbose_name_plural = "مشتریان"

    def __str__(self):
        return self.phone_number


class CartHold(models.Model):
    """قفل ۱۵ دقیقه‌ای موجودی هنگام رفتن به درگاه پرداخت.

    موجودی در زمان قفل کم نمی‌شود؛ موجودی قابل فروش به‌صورت تنبل محاسبه می‌شود:
    «موجودی انبار − مجموع قفل‌های فعال» که قفل فعال یعنی expires_at > now.
    به همین دلیل هیچ job پس‌زمینه‌ای برای آزادسازی لازم نیست.
    """

    cart_token = models.CharField(max_length=64, db_index=True, verbose_name="توکن سبد")
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.CASCADE, verbose_name="قطعه"
    )
    variant = models.ForeignKey(
        "catalog.ProductVariant",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        verbose_name="تنوع",
    )
    quantity = models.IntegerField(default=1, verbose_name="تعداد")
    order = models.ForeignKey(
        "Order",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="holds",
        verbose_name="سفارش",
    )
    expires_at = models.DateTimeField(db_index=True, verbose_name="زمان انقضا")

    class Meta:
        verbose_name = "قفل سبد"
        verbose_name_plural = "قفل‌های سبد"

    @property
    def is_active(self):
        return self.expires_at > timezone.now()

    def __str__(self):
        return f"hold({self.cart_token[:8]}…) {self.product_id}×{self.quantity}"


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING_PAYMENT = "pending_payment", "در انتظار پرداخت"
        PAID = "paid", "پرداخت شده / آماده بررسی"
        PROCESSING = "processing", "در حال بسته‌بندی در انبار"
        SHIPPED = "shipped", "ارسال شده"
        DELIVERED = "delivered", "تحویل شده"
        CANCELLED = "cancelled", "لغو شده"

    class Shipping(models.TextChoices):
        TIPAX = "tipax", "تیپاکس (پس‌کرایه)"
        POST = "post", "پست پیشتاز"
        COURIER = "courier", "پیک موتوری فوری (ویژه تهران)"
        FREIGHT = "freight", "باربری ترمینال"
        PICKUP = "pickup", "تحویل حضوری از انبار"

    customer = models.ForeignKey(
        Customer, on_delete=models.PROTECT, related_name="orders", verbose_name="مشتری"
    )
    order_number = models.CharField(max_length=32, unique=True, verbose_name="شماره سفارش")
    status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.PENDING_PAYMENT, verbose_name="وضعیت"
    )
    shipping_method = models.CharField(
        max_length=30, choices=Shipping.choices, verbose_name="روش ارسال"
    )

    # ویژگی کلیدی برای کاهش مرجوعی: شماره شاسی + تایید کارشناس
    vin_or_chassis = models.CharField(
        max_length=100, blank=True, verbose_name="شماره شاسی / VIN"
    )
    vin_verified = models.BooleanField(default=False, verbose_name="شاسی تاییدشده")
    admin_verification_note = models.TextField(
        blank=True, verbose_name="یادداشت کارشناس درباره تطابق شاسی"
    )

    shipping_address = models.TextField(verbose_name="آدرس ارسال")
    postal_code = models.CharField(max_length=10, blank=True, verbose_name="کد پستی")
    customer_note = models.TextField(blank=True, verbose_name="یادداشت مشتری")

    subtotal = models.BigIntegerField(default=0, verbose_name="جمع اقلام (تومان)")
    shipping_cost = models.BigIntegerField(default=0, verbose_name="هزینه ارسال (تومان)")
    total_amount = models.BigIntegerField(verbose_name="مبلغ کل (تومان)")
    payment_tracking_code = models.CharField(
        max_length=100, blank=True, verbose_name="کد رهگیری پرداخت"
    )
    shipping_tracking_code = models.CharField(
        max_length=100, blank=True, verbose_name="کد رهگیری ارسال"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "سفارش"
        verbose_name_plural = "سفارشات"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        # شماره سفارش از روی pk ساخته می‌شود — یکتا به‌صورت ذاتی و بدون شرط رقابتی.
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and not self.order_number:
            self.order_number = f"YK-{10000 + self.pk}"
            super().save(update_fields=["order_number"])

    def __str__(self):
        return self.order_number


class OrderLine(models.Model):
    """قلم سفارش — قیمت لحظه خرید روی قلم فریز می‌شود."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="lines", verbose_name="سفارش")
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.PROTECT, related_name="+", verbose_name="قطعه"
    )
    variant = models.ForeignKey(
        "catalog.ProductVariant",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
        verbose_name="تنوع",
    )
    product_title = models.CharField(max_length=255, verbose_name="عنوان قطعه (ثبت لحظه خرید)")
    quantity = models.PositiveIntegerField(verbose_name="تعداد")
    unit_price = models.BigIntegerField(verbose_name="قیمت واحد (تومان)")

    class Meta:
        verbose_name = "قلم سفارش"
        verbose_name_plural = "اقلام سفارش"

    def __str__(self):
        return f"{self.product_title} ×{self.quantity}"
