"""Admin product APIs: fast price/stock table, batch update, bulk percentage, CRUD.

این ماژول قلب ویژگی اصلی پوریاست: تغییر سریع قیمت و موجودی.
هدف: جدول زیر ۱۰۰ms لود شود و ذخیره گروهی اتمیک باشد.
"""
import math
import uuid

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.accounts.auth import StaffAuth
from .models import Category, PriceAuditLog, Product, ProductVariant, VehicleTrim

router = Router(tags=["admin-products"], auth=StaffAuth())


# ---------- Fast table ----------

@router.get("/admin/products/fast-table")
def fast_table(request):
    """ردیف‌های فشرده: [product_id, title, brand, code, price, stock, call_for_price, low_threshold, variant_id]

    تنوع‌ها به‌صورت ردیف زیرین (variant_id != null) می‌آیند تا موجودی چپ/راست
    هم در همان گرید کیبوردی ویرایش شود.
    """
    products = (
        Product.objects.filter(is_active=True)
        .select_related("category")
        .prefetch_related("variants")
        .order_by("id")
    )
    rows = []
    for p in products:
        code = p.part_number or p.isaco_code
        rows.append([p.pk, p.title, p.brand, code, p.price, p.stock,
                     p.is_call_for_price, p.low_stock_threshold, None])
        for v in p.variants.all():
            rows.append([p.pk, f"— {v.name}", p.brand, f"{code}-{v.sku_modifier}" if code else "",
                         p.effective_price(v), v.stock,
                         p.is_call_for_price, p.low_stock_threshold, v.pk])
    return {"rows": rows, "products": len(products)}


# ---------- Batch update ----------

class BatchUpdateItem(Schema):
    id: int
    variant_id: int | None = None
    price: int | None = None
    stock: int | None = None
    is_call_for_price: bool | None = None


@router.patch("/admin/products/batch-update")
def batch_update(request, items: list[BatchUpdateItem]):
    """ذخیره گروهی اتمیک؛ هر تغییر قیمت یک ردیف PriceAuditLog می‌سازد."""
    if not items:
        return {"updated": 0}
    changed_by = request.auth.username
    updated = 0

    with transaction.atomic():
        for item in items:
            if item.variant_id is not None:
                variant = (
                    ProductVariant.objects.select_related("product")
                    .filter(pk=item.variant_id, product_id=item.id)
                    .first()
                )
                if variant is None:
                    raise HttpError(404, f"تنوع {item.variant_id} برای قطعه {item.id} پیدا نشد")
                product = variant.product
                old_price = product.effective_price(variant)
                if item.price is not None:
                    variant.price_override = item.price
                if item.stock is not None:
                    variant.stock = item.stock
                variant.save()
                if item.price is not None and item.price != old_price:
                    PriceAuditLog.objects.create(
                        product=product, old_price=old_price,
                        new_price=item.price, changed_by=changed_by,
                    )
                if item.is_call_for_price is not None:
                    product.is_call_for_price = item.is_call_for_price
                    product.save(update_fields=["is_call_for_price", "updated_at"])
            else:
                product = Product.objects.filter(pk=item.id).first()
                if product is None:
                    raise HttpError(404, f"قطعه {item.id} پیدا نشد")
                if item.price is not None and item.price != product.price:
                    PriceAuditLog.objects.create(
                        product=product, old_price=product.price,
                        new_price=item.price, changed_by=changed_by,
                    )
                    product.price = item.price
                if item.stock is not None:
                    product.stock = item.stock
                if item.is_call_for_price is not None:
                    product.is_call_for_price = item.is_call_for_price
                product.save()
            updated += 1

    return {"updated": updated}


# ---------- Bulk percentage ----------

class BulkPercentageIn(Schema):
    percentage: float  # مثبت = افزایش، منفی = کاهش
    brand: str | None = None
    category: str | None = None
    round_to: int = 1000  # گرد کردن به نزدیک‌ترین ۱۰۰۰ تومان


def round_to_step(value: int, step: int) -> int:
    if step <= 1:
        return value
    return int(math.floor(value / step + 0.5) * step)


@router.post("/admin/products/bulk-percentage")
def bulk_percentage(request, payload: BulkPercentageIn):
    """اعمال درصد روی قیمت پایه قطعات (برند یا دسته‌بندی).

    تنوع‌هایی که price_override صریح دارند دست نمی‌خورند؛ بقیه قیمت پایه را
    به ارث می‌برند و خودبه‌خود درصد را می‌گیرند.
    """
    qs = Product.objects.all()
    if payload.brand:
        qs = qs.filter(brand=payload.brand)
    if payload.category:
        qs = qs.filter(category__slug=payload.category)
    if not qs.exists():
        return {"updated": 0}

    changed_by = request.auth.username
    updated = 0
    with transaction.atomic():
        for product in qs:
            old = product.price
            new = max(round_to_step(int(old * (1 + payload.percentage / 100)), payload.round_to), 0)
            if new == old:
                continue
            PriceAuditLog.objects.create(
                product=product, old_price=old, new_price=new, changed_by=changed_by
            )
            product.price = new
            product.save(update_fields=["price", "updated_at"])
            updated += 1
    return {"updated": updated}


# ---------- Product CRUD ----------

class VariantIn(Schema):
    id: int | None = None
    name: str
    sku_modifier: str = ""
    price_override: int | None = None
    stock: int = 0
    is_default: bool = False


class ProductIn(Schema):
    title: str
    brand: str
    category_slug: str
    part_number: str = ""
    isaco_code: str = ""
    price: int = 0
    stock: int = 0
    is_call_for_price: bool = False
    max_order_quantity: int = 5
    low_stock_threshold: int = 2
    warranty_text: str = "ضمانت اصالت و سلامت فیزیکی"
    is_genuine: bool = True
    description: str = ""
    # سازگاری: با مدل (همه تیپ‌ها) یا با تیپ مشخص
    model_slugs: list[str] = []
    trim_ids: list[int] = []
    variants: list[VariantIn] = []


class ProductMutationOut(Schema):
    id: int
    slug: str
    title: str


def _make_slug(title: str, part_number: str) -> str:
    """اسلاگ لاتین از پارت‌نامبر؛ وگرنه اسلاگ فارسی از عنوان؛ وگرنه uuid کوتاه."""
    base = slugify(part_number, allow_unicode=False)
    if not base:
        base = slugify(title, allow_unicode=True)
    if not base:
        base = uuid.uuid4().hex[:10]
    candidate = base
    n = 2
    while Product.objects.filter(slug=candidate).exists():
        candidate = f"{base}-{n}"
        n += 1
    return candidate


def _resolve_trims(model_slugs: list[str], trim_ids: list[int]):
    if trim_ids:
        return list(VehicleTrim.objects.filter(pk__in=trim_ids))
    if model_slugs:
        return list(VehicleTrim.objects.filter(vehicle_model__slug__in=model_slugs))
    return []


def _apply_product(product: Product, payload: ProductIn):
    try:
        category = Category.objects.get(slug=payload.category_slug)
    except Category.DoesNotExist:
        raise HttpError(400, f"دسته‌بندی «{payload.category_slug}» پیدا نشد")

    product.title = payload.title
    product.brand = payload.brand
    product.category = category
    product.part_number = payload.part_number
    product.isaco_code = payload.isaco_code
    product.price = payload.price
    product.stock = payload.stock
    product.is_call_for_price = payload.is_call_for_price
    product.max_order_quantity = payload.max_order_quantity
    product.low_stock_threshold = payload.low_stock_threshold
    product.warranty_text = payload.warranty_text
    product.is_genuine = payload.is_genuine
    product.description = payload.description
    product.save()

    product.compatible_trims.set(_resolve_trims(payload.model_slugs, payload.trim_ids))

    # سنکرون کردن تنوع‌ها: موجودها به‌روز، جدیدها ساخته، حذف‌شده‌ها پاک می‌شوند
    keep_ids = set()
    for v in payload.variants:
        fields = {
            "name": v.name,
            "sku_modifier": v.sku_modifier,
            "price_override": v.price_override,
            "stock": v.stock,
            "is_default": v.is_default,
        }
        if v.id is not None:
            variant = ProductVariant.objects.filter(pk=v.id, product=product).first()
            if variant is None:
                raise HttpError(400, f"تنوع {v.id} متعلق به این قطعه نیست")
            for attr, value in fields.items():
                setattr(variant, attr, value)
            variant.save()
        else:
            variant = ProductVariant.objects.create(product=product, **fields)
        keep_ids.add(variant.pk)
    ProductVariant.objects.filter(product=product).exclude(pk__in=keep_ids).delete()

    return product


@router.post("/admin/products", response=ProductMutationOut)
def create_product(request, payload: ProductIn):
    product = Product(slug=_make_slug(payload.title, payload.part_number))
    product = _apply_product(product, payload)
    return ProductMutationOut(id=product.pk, slug=product.slug, title=product.title)


@router.patch("/admin/products/{product_id}", response=ProductMutationOut)
def update_product(request, product_id: int, payload: ProductIn):
    product = get_object_or_404(Product, pk=product_id)
    product = _apply_product(product, payload)
    return ProductMutationOut(id=product.pk, slug=product.slug, title=product.title)


@router.get("/admin/products/{product_id}")
def get_product_for_edit(request, product_id: int):
    """فرم ادیت: همه فیلدها + تنوع‌ها + تیپ‌های سازگار."""
    product = get_object_or_404(Product.objects.prefetch_related("variants"), pk=product_id)
    return {
        "id": product.pk,
        "title": product.title,
        "slug": product.slug,
        "brand": product.brand,
        "category_slug": product.category.slug,
        "part_number": product.part_number,
        "isaco_code": product.isaco_code,
        "price": product.price,
        "stock": product.stock,
        "is_call_for_price": product.is_call_for_price,
        "max_order_quantity": product.max_order_quantity,
        "low_stock_threshold": product.low_stock_threshold,
        "warranty_text": product.warranty_text,
        "is_genuine": product.is_genuine,
        "description": product.description,
        "trim_ids": [t.pk for t in product.compatible_trims.all()],
        "model_slugs": sorted(
            {t.vehicle_model.slug for t in product.compatible_trims.all().select_related("vehicle_model")}
        ),
        "variants": [
            {
                "id": v.pk, "name": v.name, "sku_modifier": v.sku_modifier,
                "price_override": v.price_override, "stock": v.stock, "is_default": v.is_default,
            }
            for v in product.variants.all()
        ],
    }
