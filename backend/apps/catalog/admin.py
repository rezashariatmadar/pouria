from django.contrib import admin

from .models import (
    Category,
    PriceAuditLog,
    Product,
    ProductImage,
    ProductVariant,
    VehicleMake,
    VehicleModel,
    VehicleTrim,
)

# Django admin (at /django-admin/) is the internal fallback data editor.
# The real admin panel is the Next.js app at /admin.


class VehicleModelInline(admin.TabularInline):
    model = VehicleModel
    extra = 0


@admin.register(VehicleMake)
class VehicleMakeAdmin(admin.ModelAdmin):
    list_display = ["name", "slug"]
    inlines = [VehicleModelInline]


class VehicleTrimInline(admin.TabularInline):
    model = VehicleTrim
    extra = 0


@admin.register(VehicleModel)
class VehicleModelAdmin(admin.ModelAdmin):
    list_display = ["name", "make", "slug"]
    list_filter = ["make"]
    search_fields = ["name"]
    inlines = [VehicleTrimInline]


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0


class ProductAdmin(admin.ModelAdmin):
    list_display = [
        "title", "brand", "category", "price", "stock",
        "is_call_for_price", "is_active", "updated_at",
    ]
    list_filter = ["category", "brand", "is_call_for_price", "is_active"]
    search_fields = ["title", "part_number", "isaco_code"]
    list_editable = ["price", "stock", "is_call_for_price", "is_active"]
    inlines = [ProductVariantInline, ProductImageInline]
    filter_horizontal = ["compatible_trims"]


@admin.register(PriceAuditLog)
class PriceAuditLogAdmin(admin.ModelAdmin):
    list_display = ["product", "old_price", "new_price", "changed_by", "timestamp"]
    list_filter = ["changed_by"]
    search_fields = ["product__title"]
    date_hierarchy = "timestamp"


admin.site.register(Category)
