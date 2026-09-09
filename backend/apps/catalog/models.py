from django.db import models


class VehicleMake(models.Model):
    """خودروساز — IKCO, SAIPA."""

    name = models.CharField(max_length=100, verbose_name="نام")
    slug = models.SlugField(unique=True)
    logo = models.ImageField(upload_to="makes/", null=True, blank=True)

    class Meta:
        verbose_name = "خودروساز"
        verbose_name_plural = "خودروسازها"
        ordering = ["id"]

    def __str__(self):
        return self.name


class VehicleModel(models.Model):
    """مدل خودرو — پژو ۲۰۶, سمند, کوئیک, ..."""

    make = models.ForeignKey(
        VehicleMake, on_delete=models.CASCADE, related_name="models", verbose_name="خودروساز"
    )
    name = models.CharField(max_length=100, verbose_name="نام")
    slug = models.SlugField(unique=True)

    class Meta:
        verbose_name = "مدل خودرو"
        verbose_name_plural = "مدل‌های خودرو"
        ordering = ["make__id", "id"]

    def __str__(self):
        return self.name


class VehicleTrim(models.Model):
    """تیپ/فنی — تیپ ۵ موتور TU5, توربو, S, ..."""

    vehicle_model = models.ForeignKey(
        VehicleModel, on_delete=models.CASCADE, related_name="trims", verbose_name="مدل خودرو"
    )
    name = models.CharField(max_length=100, verbose_name="نام")
    slug = models.SlugField()
    year_start = models.IntegerField(null=True, blank=True, verbose_name="سال شروع")
    year_end = models.IntegerField(null=True, blank=True, verbose_name="سال پایان")

    class Meta:
        verbose_name = "تیپ خودرو"
        verbose_name_plural = "تیپ‌های خودرو"
        unique_together = [("vehicle_model", "slug")]
        ordering = ["vehicle_model__id", "id"]

    def __str__(self):
        return f"{self.vehicle_model.name} {self.name}"


class Category(models.Model):
    """دسته‌بندی قطعه — ترمز, تعلیق, برقی, ..."""

    name = models.CharField(max_length=150, verbose_name="نام")
    slug = models.SlugField(unique=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="دسته والد",
    )
    icon = models.CharField(max_length=50, blank=True, help_text="نام آیکون (مثلاً disc, zap)")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        verbose_name = "دسته‌بندی"
        verbose_name_plural = "دسته‌بندی‌ها"
        ordering = ["order", "id"]

    def __str__(self):
        return self.name


class Product(models.Model):
    """قطعه — هر برند یک محصول جدا؛ سمت چپ/راست به‌صورت تنوع."""

    title = models.CharField(max_length=255, verbose_name="عنوان")
    slug = models.SlugField(unique=True, max_length=255)
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="products", verbose_name="دسته‌بندی"
    )
    brand = models.CharField(max_length=100, verbose_name="برند")
    part_number = models.CharField(max_length=100, blank=True, db_index=True, verbose_name="کد فنی")
    isaco_code = models.CharField(max_length=50, blank=True, db_index=True, verbose_name="کد ایساکو")

    # قیمت‌ها به تومان نگهداری می‌شوند.
    price = models.BigIntegerField(default=0, verbose_name="قیمت (تومان)")
    stock = models.IntegerField(default=0, verbose_name="موجودی")
    low_stock_threshold = models.IntegerField(default=2, verbose_name="آستانه موجودی کم")
    is_call_for_price = models.BooleanField(default=False, verbose_name="استعلام قیمت")
    max_order_quantity = models.IntegerField(default=5, verbose_name="حداکثر تعداد در سفارش")

    warranty_text = models.CharField(
        max_length=200, default="ضمانت اصالت و سلامت فیزیکی", verbose_name="متن ضمانت"
    )
    is_genuine = models.BooleanField(default=True, verbose_name="اصل")
    description = models.TextField(blank=True, verbose_name="توضیحات")
    image = models.ImageField(
        upload_to="products/", null=True, blank=True, verbose_name="تصویر شاخص"
    )

    compatible_trims = models.ManyToManyField(
        VehicleTrim, related_name="compatible_products", blank=True, verbose_name="تیپ‌های سازگار"
    )

    meta_title = models.CharField(max_length=255, blank=True, verbose_name="عنوان سئو")
    meta_description = models.CharField(max_length=350, blank=True, verbose_name="توضیحات سئو")

    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "قطعه"
        verbose_name_plural = "قطعات"
        ordering = ["id"]

    def __str__(self):
        return self.title

    @property
    def has_variants(self):
        return self.variants.exists()

    def effective_price(self, variant=None):
        """قیمت مؤثر: تنوع می‌تواند قیمت جدا داشته باشد."""
        if variant is not None and variant.price_override is not None:
            return variant.price_override
        return self.price


class ProductVariant(models.Model):
    """تنوع سمت — راست (شاگرد) / چپ (راننده) / جفت."""

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="variants", verbose_name="قطعه"
    )
    name = models.CharField(max_length=100, verbose_name="نام")
    sku_modifier = models.CharField(max_length=50, blank=True, verbose_name="پسوند کد")
    price_override = models.BigIntegerField(
        null=True, blank=True, verbose_name="قیمت اختصاصی (تومان)"
    )
    stock = models.IntegerField(default=0, verbose_name="موجودی")
    is_default = models.BooleanField(default=False, verbose_name="پیش‌فرض")

    class Meta:
        verbose_name = "تنوع قطعه"
        verbose_name_plural = "تنوع‌های قطعه"
        ordering = ["id"]

    def __str__(self):
        return f"{self.product.title} — {self.name}"


class ProductImage(models.Model):
    """گالری تصاویر قطعه (گالری چند زاویه‌ای صفحه محصول)."""

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="images", verbose_name="قطعه"
    )
    image = models.ImageField(upload_to="products/gallery/", verbose_name="تصویر")
    alt = models.CharField(max_length=200, blank=True, verbose_name="متن جایگزین")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        verbose_name = "تصویر قطعه"
        verbose_name_plural = "تصاویر قطعات"
        ordering = ["order", "id"]

    def __str__(self):
        return f"تصویر {self.order} — {self.product.title}"


class PriceAuditLog(models.Model):
    """تاریخچه تغییر قیمت‌ها برای پایش نوسان بازار."""

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="price_logs", verbose_name="قطعه"
    )
    old_price = models.BigIntegerField(verbose_name="قیمت قبلی")
    new_price = models.BigIntegerField(verbose_name="قیمت جدید")
    changed_by = models.CharField(max_length=100, default="admin", verbose_name="تغییردهنده")
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name="زمان")

    class Meta:
        verbose_name = "سابقه قیمت"
        verbose_name_plural = "سابقه قیمت‌ها"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.product_id}: {self.old_price} → {self.new_price}"
