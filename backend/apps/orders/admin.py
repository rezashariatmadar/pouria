from django.contrib import admin

from .models import CartHold, Customer, Order, OrderLine


class OrderLineInline(admin.TabularInline):
    model = OrderLine
    extra = 0
    readonly_fields = ["product_title", "quantity", "unit_price", "product", "variant"]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "order_number", "customer", "status", "shipping_method",
        "total_amount", "vin_or_chassis", "vin_verified", "created_at",
    ]
    list_filter = ["status", "shipping_method", "vin_verified"]
    search_fields = ["order_number", "customer__phone_number", "vin_or_chassis"]
    readonly_fields = ["order_number", "subtotal", "total_amount", "created_at"]
    inlines = [OrderLineInline]


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["phone_number", "full_name", "created_at"]
    search_fields = ["phone_number", "full_name"]


@admin.register(CartHold)
class CartHoldAdmin(admin.ModelAdmin):
    list_display = ["cart_token", "product", "variant", "quantity", "expires_at"]
    list_filter = ["product"]
