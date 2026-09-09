"""سید دموی یدک‌پرو — تاکسونومی خودروها، دسته‌بندی‌ها و ۱۲ محصول نمونه.

داده‌ها از پروتوتایپ تأییدشده (prototype/store/catalog.html و PROTOTYPE_SPECS.md)
استخراج شده‌اند. کامند idempotent است و می‌تواند دوباره اجرا شود.
"""
import hashlib

import httpx
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from apps.catalog.models import (
    Category,
    Product,
    ProductVariant,
    VehicleMake,
    VehicleModel,
    VehicleTrim,
)

MAKES = [
    {"slug": "ikco", "name": "ایران‌خودرو"},
    {"slug": "saipa", "name": "سایپا"},
]

MODELS = {
    "ikco": [
        ("peugeot-206", "پژو ۲۰۶"),
        ("peugeot-207", "پژو ۲۰۷"),
        ("peugeot-pars", "پژو پارس"),
        ("rana", "رانا"),
        ("samand", "سمند"),
        ("dena", "دنا"),
        ("tara", "تارا"),
    ],
    "saipa": [
        ("pride", "پراید"),
        ("tiba", "تیبا"),
        ("saina", "ساینا"),
        ("quick", "کوئیک"),
        ("shahin", "شاهین"),
    ],
}

TRIMS = {
    "peugeot-206": [("type-2", "تیپ ۲"), ("type-5-tu5", "تیپ ۵ (موتور TU5)"), ("type-6-sd", "تیپ ۶ SD")],
    "peugeot-207": [("manual", "دستی"), ("automatic", "اتوماتیک")],
    "peugeot-pars": [("lx", "LX"), ("elx", "ELX")],
    "rana": [("standard", "معمولی"), ("plus", "پلاس")],
    "samand": [("xu5", "موتور XU5"), ("ef7", "موتور ملی EF7"), ("soren", "سورن")],
    "dena": [("standard", "معمولی"), ("turbo", "توربو")],
    "tara": [("manual", "تیپ ۲ دستی"), ("automatic", "تیپ ۴ اتوماتیک")],
    "pride": [("p131", "۱۳۱"), ("p132", "۱۳۲"), ("p141", "۱۴۱")],
    "tiba": [("t1", "تیپ ۱"), ("t2-auto", "تیپ ۲ اتوماتیک")],
    "saina": [("s", "S"), ("ex", "EX")],
    "quick": [("r", "R"), ("s", "S"), ("auto", "اتوماتیک")],
    "shahin": [("g", "G"), ("se", "SE")],
}

CATEGORIES = [
    ("brakes", "ترمز", "disc", 1),
    ("suspension", "تعلیق", "cog", 2),
    ("clutch", "کلاچ", "circle-dot", 3),
    ("cooling", "خنک‌کننده", "thermometer", 4),
    ("electrical", "برقی", "zap", 5),
    ("body", "بدنه", "car", 6),
    ("consumable", "مصرفی", "wrench", 7),
]

IMG = "https://images.unsplash.com/photo-{}?w=700&auto=format&fit=crop&q=80"

# (slug, title, brand, category, price, stock, part_number, isaco_code,
#  call_for_price, max_qty, [model slugs], image-id, description)
PRODUCTS = [
    ("brake-pads-206-type5-isaco", "لنت ترمز جلو پژو ۲۰۶ تیپ ۵ (ایساکو شرکتی)", "ایساکو",
     "brakes", 890_000, 12, "", "16401002", False, 5,
     ["peugeot-206", "peugeot-207", "rana"], "1600790142055-619df03207e6",
     "لنت ترمز جلو اصلی ایساکو مناسب پژو ۲۰۶ تیپ ۲ و ۵، پژو ۲۰۷ و رانا با کیفیت فابریک کارخانه."),

    ("clutch-kit-206-tu5-valeo", "کیت کلاچ (دیسک و صفحه) ۲۰۶ تیپ ۵ والئو", "والئو",
     "clutch", 4_850_000, 3, "826360-VAL", "", False, 2,
     ["peugeot-206", "peugeot-pars"], "1517524008697-84bbe3c3fd98",
     "کیت کامل دیسک و صفحه کلاچ والئو فرانسه (جعبه سبز اصل) مناسب موتور TU5."),

    ("oxygen-sensor-206-crouse", "سنسور اکسیژن ۲۰۶ (سیم کوتاه کروز اصل)", "کروز",
     "electrical", 1_750_000, 6, "OX-CR-206", "", False, 5,
     ["peugeot-206"], "1563720223185-11003d516935",
     "سنسور اکسیژن سیم کوتاه کروز برای پژو ۲۰۶ تیپ ۲ و ۵؛ نو و پلمب کارخانه."),

    ("water-pump-samand-ef7-isaco", "واتر پمپ سمند موتور ملی EF7 ایساکو اصل", "ایساکو",
     "cooling", 1_280_000, 5, "WP-EF7-88", "", True, 5,
     ["samand", "dena"], "1619642751034-765dfdf7c58e",
     "واتر پمپ موتور ملی EF7 ایساکو؛ به دلیل نوسان ساعتی بازار، قیمت روز از طریق کارشناس اعلام می‌شود."),

    ("quick-headlight-crouse", "چراغ جلو کوئیک کروز", "کروز",
     "body", 1_450_000, 0, "CR-QK-04", "", False, 4,
     ["quick"], "1511919884226-fd3cad34687c",
     "چراغ جلو کامل کوئیک کروز با انتخاب سمت راست (شاگرد)، چپ (راننده) یا جفت؛ سوکت فابریک و شیشه پلمب."),

    ("front-shock-pride-ezam", "کمک فنر جلو پراید (عظام اصل شرکتی)", "عظام",
     "suspension", 1_150_000, 1, "EZ-PR-110", "", False, 4,
     ["pride"], "1487754180451-c456f719a1fc",
     "کمک فنر جلو عظام برای انواع پراید؛ موجودی محدود — هشدار موجودی کم فعال است."),

    ("brake-disc-206-textar", "دیسک چرخ جلو خنک‌شونده تکستار (دست ۲ تایی)", "تکستار",
     "brakes", 2_050_000, 8, "TX-206-ROTOR", "", False, 2,
     ["peugeot-206", "peugeot-207"], "1578844251758-2f71da64c96f",
     "دیسک چرخ جلو خنک‌شونده (Slotted) برند تکستار آلمان، دست ۲ عددی برای پژو ۲۰۶ و ۲۰۷."),

    ("radiator-405-pars-iran-radiator", "رادیاتور آب دولول پژو ۴۰۵ و پارس ایران رادیاتور", "ایران رادیاتور",
     "cooling", 2_100_000, 0, "IR-405-RAD", "", False, 2,
     ["peugeot-pars", "samand"], "1617814076367-b759c7d7e738",
     "رادیاتور آب دولول اصلی ایران رادیاتور مناسب پژو پارس و سمند؛ در حال حاضر ناموجود."),

    ("207-taillight-crouse", "چراغ خطر عقب پژو ۲۰۷ نئون‌دار کروز (چپ/راست)", "کروز",
     "body", 1_380_000, 5, "CR-207-REAR", "", False, 4,
     ["peugeot-207", "peugeot-206"], "1552519507-da3b142c6e3d",
     "چراغ خطر عقب نئون‌دار دودی کروز برای پژو ۲۰۷؛ هنگام سفارش سمت چپ یا راست را مشخص کنید."),

    ("spark-plugs-iridium-denso", "شمع موتور سوزنی ایریدیوم دنسو ژاپن (دست ۴ عددی)", "دنسو",
     "electrical", 1_420_000, 20, "IK20-DENSO", "", False, 4,
     ["peugeot-206", "peugeot-pars", "samand", "dena", "quick", "saina", "tiba"],
     "1563720223185-11003d516935",
     "شمع سوزنی ایریدیوم دنسو ژاپن (IK20) دست ۴ عددی مناسب موتورهای TU5، EF7 و M15."),

    ("timing-belt-206-dayco", "تسمه تایم ۱۰۴ دندانه دایکو ایتالیا (با بیمه ایران)", "دایکو",
     "consumable", 880_000, 15, "DYC-104-TB", "", False, 4,
     ["peugeot-206"], "1542282088-72c9c27ed0cd",
     "تسمه تایم ۱۰۴ دندانه دایکو ایتالیا همراه بیمه خسارت برای پژو ۲۰۶ تیپ ۲ و ۵."),

    ("control-arm-206-amirnia", "طبق کامل چپ و راست پژو ۲۰۶ امیرنیا اصل", "امیرنیا",
     "suspension", 1_620_000, 6, "AMIR-206-ARM", "", False, 2,
     ["peugeot-206", "rana"], "1487754180451-c456f719a1fc",
     "طبق کامل (سیبک و طبقه) امیرنیا برای پژو ۲۰۶ و رانا؛ قیمت هر دست کامل چپ و راست."),
]

# تنوع‌های سمت برای چراغ جلو کوئیک — (product_slug, name, sku_modifier, price_override, stock, is_default)
VARIANTS = [
    ("quick-headlight-crouse", "سمت راست (شاگرد)", "R", None, 4, True),
    ("quick-headlight-crouse", "سمت چپ (راننده)", "L", None, 2, False),
    ("quick-headlight-crouse", "جفت (راست + چپ)", "PAIR", 2_800_000, 2, False),
]


class Command(BaseCommand):
    help = "پرکردن دیتابیس با داده دمو (تاکسونومی خودروها + ۱۲ محصول نمونه از پروتوتایپ)"

    def handle(self, *args, **options):
        models_by_slug = self._seed_taxonomy()
        self._seed_categories()
        self._seed_products(models_by_slug)
        self._seed_variants()
        self.stdout.write(self.style.SUCCESS("سید دمو کامل شد ✓"))

    def _seed_taxonomy(self):
        models_by_slug = {}
        for make_def in MAKES:
            make, _ = VehicleMake.objects.get_or_create(
                slug=make_def["slug"], defaults={"name": make_def["name"]}
            )
            for model_slug, model_name in MODELS[make_def["slug"]]:
                model, _ = VehicleModel.objects.get_or_create(
                    slug=model_slug, defaults={"name": model_name, "make": make}
                )
                models_by_slug[model_slug] = model
                for trim_slug, trim_name in TRIMS[model_slug]:
                    VehicleTrim.objects.get_or_create(
                        vehicle_model=model,
                        slug=trim_slug,
                        defaults={"name": trim_name},
                    )
        self.stdout.write(f"تاکسونومی: {VehicleMake.objects.count()} خودروساز، "
                          f"{VehicleModel.objects.count()} مدل، {VehicleTrim.objects.count()} تیپ")
        return models_by_slug

    def _seed_categories(self):
        for slug, name, icon, order in CATEGORIES:
            Category.objects.get_or_create(
                slug=slug, defaults={"name": name, "icon": icon, "order": order}
            )
        self.stdout.write(f"دسته‌بندی‌ها: {Category.objects.count()}")

    def _seed_products(self, models_by_slug):
        for (slug, title, brand, cat_slug, price, stock, part_number, isaco_code,
             call_for_price, max_qty, model_slugs, img_id, description) in PRODUCTS:
            category = Category.objects.get(slug=cat_slug)
            product, created = Product.objects.update_or_create(
                slug=slug,
                defaults={
                    "title": title,
                    "brand": brand,
                    "category": category,
                    "price": price,
                    "stock": stock,
                    "part_number": part_number,
                    "isaco_code": isaco_code,
                    "is_call_for_price": call_for_price,
                    "max_order_quantity": max_qty,
                    "description": description,
                },
            )
            # سازگاری: همه تیپ‌های مدل‌های لیست‌شده
            trims = VehicleTrim.objects.filter(vehicle_model__slug__in=model_slugs)
            product.compatible_trims.set(trims)

            if not product.image:
                image_name = self._fetch_image(IMG.format(img_id))
                if image_name:
                    product.image = image_name
                    product.save(update_fields=["image"])

            state = "ایجاد" if created else "به‌روزرسانی"
            self.stdout.write(f"  [{state}] {title}")

    def _seed_variants(self):
        for product_slug, name, sku_modifier, price_override, stock, is_default in VARIANTS:
            product = Product.objects.get(slug=product_slug)
            ProductVariant.objects.update_or_create(
                product=product,
                name=name,
                defaults={
                    "sku_modifier": sku_modifier,
                    "price_override": price_override,
                    "stock": stock,
                    "is_default": is_default,
                },
            )
        self.stdout.write(f"تنوع‌ها: {ProductVariant.objects.count()}")

    def _fetch_image(self, url):
        """دانلود یک‌باره تصویر seed داخل media؛ اگر آفلاین/خطا بود None برمی‌گردد."""
        name = f"products/seed/{hashlib.md5(url.encode()).hexdigest()[:16]}.jpg"
        if default_storage.exists(name):
            return name
        try:
            resp = httpx.get(url, timeout=15, follow_redirects=True)
            resp.raise_for_status()
            default_storage.save(name, ContentFile(resp.content))
            return name
        except Exception as exc:  # noqa: BLE001 — سید نباید به‌خاطر یک عکس شکست بخورد
            self.stdout.write(self.style.WARNING(f"  دانلود تصویر ناموفق ({exc}) — بدون تصویر ادامه می‌دهیم"))
            return None
