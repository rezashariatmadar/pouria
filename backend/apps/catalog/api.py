"""Catalog API: vehicle hierarchy + product browsing/filtering."""
from django.db.models import F, IntegerField, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from ninja import Router, Schema

from apps.orders.services import available_stock, variant_available_stock
from .models import Category, Product, ProductVariant, VehicleMake

router = Router(tags=["catalog"])

PAGE_SIZE = 24


class TrimOut(Schema):
    id: int
    name: str
    slug: str


class ModelOut(Schema):
    id: int
    name: str
    slug: str
    trims: list[TrimOut]


class MakeOut(Schema):
    id: int
    name: str
    slug: str
    models: list[ModelOut]


class VariantOut(Schema):
    id: int
    name: str
    price: int
    stock: int
    is_default: bool


class ProductListOut(Schema):
    id: int
    title: str
    slug: str
    brand: str
    category: str
    part_number: str
    isaco_code: str
    price: int
    stock: int
    is_call_for_price: bool
    is_genuine: bool
    image: str | None
    variants: list[VariantOut]


class ProductPageOut(Schema):
    items: list[ProductListOut]
    total: int
    page: int
    page_size: int
    has_next: bool


class CompatibilityOut(Schema):
    make: str
    model: str
    trims: list[str]


class ProductDetailOut(ProductListOut):
    description: str
    warranty_text: str
    max_order_quantity: int
    compatibility: list[CompatibilityOut]
    gallery: list[str]
    meta_title: str
    meta_description: str


@router.get("/vehicles/hierarchy", response=list[MakeOut])
def vehicle_hierarchy(request):
    makes = VehicleMake.objects.prefetch_related("models__trims").all()
    return [
        MakeOut(
            id=m.id,
            name=m.name,
            slug=m.slug,
            models=[
                ModelOut(
                    id=vm.id,
                    name=vm.name,
                    slug=vm.slug,
                    trims=[TrimOut(id=t.id, name=t.name, slug=t.slug) for t in vm.trims.all()],
                )
                for vm in m.models.all()
            ],
        )
        for m in makes
    ]


@router.get("/catalog/categories")
def list_categories(request):
    return [
        {"id": c.id, "name": c.name, "slug": c.slug, "icon": c.icon}
        for c in Category.objects.filter(is_active=True, parent__isnull=True)
    ]


def _base_queryset():
    """کوئری مشترک: موجودی تجمیعی — مجموع تنوع‌ها، وگرنه موجودی خود قطعه."""
    variant_stock_sum = (
        ProductVariant.objects.filter(product=OuterRef("pk"))
        .values("product")
        .annotate(total=Sum("stock"))
        .values("total")[:1]
    )
    return (
        Product.objects.filter(is_active=True)
        .select_related("category")
        .prefetch_related("variants", "compatible_trims__vehicle_model__make")
        .annotate(
            total_stock=Coalesce(
                Subquery(variant_stock_sum, output_field=IntegerField()),
                F("stock"),
                output_field=IntegerField(),
            ),
        )
    )


def _variant_out(v, hold_aware=False):
    return VariantOut(
        id=v.id,
        name=v.name,
        price=v.product.effective_price(v),
        stock=variant_available_stock(v) if hold_aware else v.stock,
        is_default=v.is_default,
    )


def _product_out(p, hold_aware=False):
    """خروجی مشترک لیست/جزئیات.

    hold_aware=False (لیست): موجودی خام برای سرعت — کاتالوگ نمایشی است و
    پرداخت همیشه سمت سرور با موجودی hold-aware اعتبارسنجی می‌شود.
    """
    variants = list(p.variants.all())
    if variants:
        stock = (
            sum(variant_available_stock(v) for v in variants)
            if hold_aware
            else sum(v.stock for v in variants)
        )
    else:
        stock = available_stock(p) if hold_aware else p.stock
    return ProductListOut(
        id=p.id,
        title=p.title,
        slug=p.slug,
        brand=p.brand,
        category=p.category.name,
        part_number=p.part_number,
        isaco_code=p.isaco_code,
        price=p.price,
        stock=stock,
        is_call_for_price=p.is_call_for_price,
        is_genuine=p.is_genuine,
        image=p.image.url if p.image else None,
        variants=[_variant_out(v, hold_aware) for v in variants],
    )


@router.get("/catalog/products", response=ProductPageOut)
def list_products(
    request,
    make: str | None = None,
    model: str | None = None,
    trim: str | None = None,
    category: str | None = None,
    q: str | None = None,
    page: int = 1,
):
    qs = _base_queryset()

    if trim:
        qs = qs.filter(compatible_trims__slug=trim)
    elif model:
        qs = qs.filter(compatible_trims__vehicle_model__slug=model)
    elif make:
        qs = qs.filter(compatible_trims__vehicle_model__make__slug=make)

    if category:
        qs = qs.filter(category__slug=category)

    if q:
        qs = qs.filter(
            Q(title__icontains=q) | Q(part_number__icontains=q) | Q(isaco_code__icontains=q)
        )

    # ناموجودها به انتهای لیست می‌روند (نیازمندی مستقیم بیزینس).
    qs = qs.distinct().order_by(F("total_stock").desc(nulls_last=True), "id")

    total = qs.count()
    page = max(page, 1)
    start = (page - 1) * PAGE_SIZE
    items = qs[start : start + PAGE_SIZE]
    return ProductPageOut(
        items=[_product_out(p) for p in items],
        total=total,
        page=page,
        page_size=PAGE_SIZE,
        has_next=start + PAGE_SIZE < total,
    )


@router.get("/catalog/products/{product_id}", response=ProductDetailOut, url_name="product-detail")
def product_detail(request, product_id: int):
    product = get_object_or_404(_base_queryset(), pk=product_id, is_active=True)

    compatibility: dict[tuple[str, str], list[str]] = {}
    for trim in product.compatible_trims.all():
        key = (trim.vehicle_model.make.name, trim.vehicle_model.name)
        compatibility.setdefault(key, []).append(trim.name)

    base = _product_out(product, hold_aware=True)
    return ProductDetailOut(
        **base.model_dump(),
        description=product.description,
        warranty_text=product.warranty_text,
        max_order_quantity=product.max_order_quantity,
        compatibility=[
            CompatibilityOut(make=make, model=model, trims=sorted(trims))
            for (make, model), trims in compatibility.items()
        ],
        gallery=[img.image.url for img in product.images.all()],
        meta_title=product.meta_title or product.title,
        meta_description=product.meta_description,
    )
