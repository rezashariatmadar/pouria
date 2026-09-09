# Technical & Development Specifications
**Project:** Online auto spare-parts e-commerce website  
**Client:** Pouria  
**Developer:** Dante  
**Document version:** 1.0.0 (Phase 1 — MVP)  
**Language & direction:** Persian (RTL) with the standard Vazirmatn font

---

## 1. Executive Summary & Scope

This project aims to build a modern, secure, fast-loading system for selling auto spare parts online in the Iranian market. Phase 1 focuses on high-volume **IKCO and SAIPA** vehicles and all vehicle spare parts (except complete engines and complete gearboxes).

### Foundational business concerns & requirements:
1. **Ultra-fast, frequent price updates (hourly/daily):** Due to severe market volatility, the client must be able to edit dozens of prices and stock counts daily or hourly in an Excel-like table, using the keyboard, and save with one click.
2. **Smooth inventory management:** A single centralized warehouse, initial support for 20–30 best-selling SKUs, low-stock thresholds, moving out-of-stock items to the end of the list, and SMS-based "notify me when back in stock" signups.
3. **Brand & position separation:** Different brands of the same part (e.g. ISACO, Crouse, Ezam, Valeo) are registered as separate products, but mounting directions (left / right, e.g. headlights or fenders) are selected as variants within the same product.
4. **The killer feature — reducing returns:** An optional VIN (chassis number) field or vehicle-card details at checkout, for part-matching and expert verification before shipment.
5. **Price security during payment:** A 15-minute inventory hold at the bank gateway + a per-invoice maximum purchase quantity.
6. **SEO & local SEO architecture:** Programmatic vehicle-matrix pages, structured data (JSON-LD), Torob and Emalls search-engine feeds, and optimization for Tehran and other provinces.

---

## 2. Tech Stack & Architecture

The system uses a **decoupled architecture (independent backend + high-speed frontend)**, so Dante's Python/Django expertise is leveraged while the frontend delivers the highest level of UX and SEO:

```
┌────────────────────────────────────────────────────────┐
│                        FRONTEND                        │
│             Next.js 15 (App Router) + Tailwind         │
│  - Customer Storefront: SSR / Dynamic SEO / RTL        │
│  - Admin Dashboard: TanStack Table (Fast Price Editor) │
└───────────────────────────┬────────────────────────────┘
                            │ REST APIs (JSON / JWT)
┌───────────────────────────▼────────────────────────────┐
│                        BACKEND                         │
│             Python 3.12 + Django 5 + Django Ninja      │
│  - High-Speed REST Endpoints & Pydantic Validation     │
│  - Django ORM, Robust Migrations & PostgreSQL Engine   │
│  - Celery / Redis: Background Tasks, SMS & Cart Hold   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                 INFRASTRUCTURE (Docker)                │
│  PostgreSQL 16 │ Redis 7 │ Caddy / Nginx Reverse Proxy │
└────────────────────────────────────────────────────────┘
```

### Key benefits of this choice:
* **Fast backend development:** Django ORM + Django Ninja (high speed, type hints, auto-generated OpenAPI/Swagger docs at `/api/docs`).
* **The best UX for Pouria:** An admin panel with modern Excel-like components: keyboard shortcuts, auto-focus, in-place optimistic UI updates without full page refresh.
* **Iran-first, resilient to international internet outages:** Containerized hosting on a cloud Linux server inside the country (Asiatech/ArvanCloud data centers) with the ability to instantly move to foreign PaaS services (such as Railway or Coolify) without codebase changes.

---

## 3. Database Schema Design

The database of choice is **PostgreSQL 16**. The core model relationships are designed as follows:

### 3.1. Vehicle taxonomy models
```python
class VehicleMake(models.Model):
    # IKCO, SAIPA
    name = models.CharField(max_length=100) # e.g. "ایران خودرو"
    slug = models.SlugField(unique=True)     # e.g. "ikco"
    logo = models.ImageField(upload_to="makes/", null=True, blank=True)

class VehicleModel(models.Model):
    # Peugeot 206, Peugeot Pars, Samand, Pride, Tiba, Quick, Shahin
    make = models.ForeignKey(VehicleMake, on_delete=models.CASCADE, related_name="models")
    name = models.CharField(max_length=100) # e.g. "پژو 206"
    slug = models.SlugField(unique=True)     # e.g. "peugeot-206"

class VehicleTrim(models.Model):
    # Type 2, Type 5, TU5 engine, EF7 engine
    vehicle_model = models.ForeignKey(VehicleModel, on_delete=models.CASCADE, related_name="trims")
    name = models.CharField(max_length=100) # e.g. "تیپ 5 (موتور TU5)"
    slug = models.SlugField()
    year_start = models.IntegerField(null=True, blank=True) # e.g. 1385
    year_end = models.IntegerField(null=True, blank=True)   # e.g. 1402
```

### 3.2. Category model
```python
class Category(models.Model):
    name = models.CharField(max_length=150) # e.g. "قطعات ترمز", "لنت ترمز"
    slug = models.SlugField(unique=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name="children")
    icon = models.CharField(max_length=50, blank=True) # e.g. "disc", "zap", "shield"
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
```

### 3.3. Product, variants & compatibility models
```python
class Product(models.Model):
    # Base info
    title = models.CharField(max_length=255) # e.g. "لنت ترمز جلو پژو 206 تیپ 5 ایساکو اصل"
    slug = models.SlugField(unique=True, max_length=255)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    brand = models.CharField(max_length=100) # e.g. "ایساکو", "کروز", "عظام", "والئو"
    part_number = models.CharField(max_length=100, blank=True, db_index=True) # technical part code
    isaco_code = models.CharField(max_length=50, blank=True, db_index=True)   # dedicated ISACO code

    # Pricing & warehousing (Pouria's priority)
    price = models.BigIntegerField(default=0) # price in Rial or Toman (standard: Toman in internal storage)
    stock = models.IntegerField(default=0)     # warehouse stock
    low_stock_threshold = models.IntegerField(default=2) # low-stock alert threshold
    is_call_for_price = models.BooleanField(default=False) # "call for price / WhatsApp inquiry" state
    max_order_quantity = models.IntegerField(default=5)    # per-invoice purchase cap to prevent hoarding

    # Warranty & specs
    warranty_text = models.CharField(max_length=200, default="ضمانت اصالت و سلامت فیزیکی")
    is_genuine = models.BooleanField(default=True) # authenticity label
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="products/")

    # Vehicle compatibility (many-to-many)
    compatible_trims = models.ManyToManyField(VehicleTrim, related_name="compatible_products")

    # SEO metadata
    meta_title = models.CharField(max_length=255, blank=True)
    meta_description = models.CharField(max_length=350, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class ProductVariant(models.Model):
    # For positional part variants (left / right / pair)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    name = models.CharField(max_length=100) # e.g. "سمت راست (شاگرد)", "سمت چپ (راننده)"
    sku_modifier = models.CharField(max_length=50, blank=True)
    price_override = models.BigIntegerField(null=True, blank=True) # if prices differ
    stock = models.IntegerField(default=0)
    is_default = models.BooleanField(default=False)

class PriceAuditLog(models.Model):
    # Price-change history for volatility monitoring
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="price_logs")
    old_price = models.BigIntegerField()
    new_price = models.BigIntegerField()
    changed_by = models.CharField(max_length=100, default="admin")
    timestamp = models.DateTimeField(auto_now_add=True)
```

### 3.4. Authentication, orders & cart-hold models
```python
class Customer(models.Model):
    phone_number = models.CharField(max_length=11, unique=True) # e.g. 09121234567
    full_name = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class CartHold(models.Model):
    # 15-minute cart hold while the customer is at the bank gateway
    cart_token = models.CharField(max_length=64, unique=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    variant = models.ForeignKey(ProductVariant, null=True, blank=True, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)
    expires_at = models.DateTimeField() # now() + 15 minutes

class Order(models.Model):
    STATUS_CHOICES = [
        ('pending_payment', 'در انتظار پرداخت'),
        ('paid', 'پرداخت شده / آماده بررسی'),
        ('processing', 'در حال بسته‌بندی در انبار'),
        ('shipped', 'ارسال شده به پست/تیپاکس/باربری'),
        ('delivered', 'تحویل شده'),
        ('cancelled', 'لغو شده'),
    ]
    SHIPPING_CHOICES = [
        ('tipax', 'تیپاکس (پس‌کرایه)'),
        ('post', 'پست پیشتاز'),
        ('courier', 'پیک موتوری فوری (ویژه تهران)'),
        ('freight', 'باربری ترمینال (قطعات سنگین/حجیم)'),
        ('pickup', 'تحویل حضوری از انبار'),
    ]
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="orders")
    order_number = models.CharField(max_length=32, unique=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending_payment')
    shipping_method = models.CharField(max_length=30, choices=SHIPPING_CHOICES)

    # The killer feature for reducing wrong purchases and returns
    vin_or_chassis = models.CharField(max_length=100, blank=True, help_text="شماره شاسی یا عکس کارت خودرو جهت استعلام")
    admin_verification_note = models.TextField(blank=True, help_text="یادداشت کارشناس فنی درباره تطابق شماره شاسی")

    shipping_address = models.TextField()
    postal_code = models.CharField(max_length=10, blank=True)
    total_amount = models.BigIntegerField()
    payment_tracking_code = models.CharField(max_length=100, blank=True)
    shipping_tracking_code = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

---

## 4. API Contracts & Endpoints (Django Ninja)

All endpoints are exposed under the base path `/api/v1/`.

### 4.1. Pouria's admin-only fast endpoints
* `GET /api/v1/admin/products/fast-table`
  * Returns a compact array of all products, each `[id, title, brand, part_number, price, stock, is_call_for_price, low_stock_threshold]`.
  * Target response time: under 100 ms.
* `PATCH /api/v1/admin/products/batch-update`
  * Accepts an array of edited records:
    ```json
    [
      {"id": 12, "price": 1850000, "stock": 4, "is_call_for_price": false},
      {"id": 15, "price": 0, "stock": 0, "is_call_for_price": true}
    ]
    ```
  * Persisted as an atomic transaction (`transaction.atomic`) with entries written to `PriceAuditLog`.
* `POST /api/v1/admin/products/bulk-percentage`
  * Apply a percentage increase/decrease by brand or category (e.g. +8% on all ISACO items).

### 4.2. Storefront & catalog endpoints
* `GET /api/v1/vehicles/hierarchy`
  * Returns the tree structure: `Make -> Models -> Trims`, used to render the site's top vehicle widget; cacheable in the user's localStorage.
* `GET /api/v1/catalog/products`
  * Filter params: `?make=ikco&model=peugeot-206&trim=type5&category=brakes&q=لنت`
  * Supports search by part number and by product name.
* `POST /api/v1/auth/otp/send` and `POST /api/v1/auth/otp/verify`
  * Send and verify SMS one-time passwords via the Kavenegar Pattern API (delivery under 5 seconds even to blacklisted/ad-blocked lines).
* `POST /api/v1/checkout/create-payment`
  * Checks the max-purchase limit, locks stock for 15 minutes, creates a Zibal transaction, and returns the Shetab payment link.
* `GET /api/v1/feeds/torob`
  * Standard XML/JSON feed of live product data for Torob and Emalls.

---

## 5. SEO & Local SEO Strategy

### 5.1. Programmatic (matrix) URL routing
To capture the maximum number of high-conversion keywords:
* `/parts/[make-slug]/[model-slug]/[category-slug]/`
  * *Example:* `/parts/ikco/peugeot-206/brake-pads/`
  * *Page title:* «خرید و قیمت لنت ترمز پژو ۲۰۶ (تیپ ۲ و ۵) اصل ایساکو»
* `/product/[id]/[slug]/`
  * *Example:* `/product/1042/isaco-brake-pad-peugeot-206/`
  * *Canonical tag:* points to the product's primary URL to avoid duplicate-content penalties.

### 5.2. Google structured data (JSON-LD schemas)
1. **Product schema:** price in Rial/Toman, stock status, ISACO code as MPN, manufacturer brand, and reviews.
2. **Local business schema (LocalBusiness / AutoPartsStore):** the shop's and warehouse's physical Tehran address, phone numbers, and geo location, to appear on Google Maps and in the Local Pack.
3. **Breadcrumb schema (BreadcrumbList):** structures links in Google results: `Home > IKCO Parts > Peugeot 206 > Brake System`.

### 5.3. Local & logistics signals for Tehran and provinces:
* Detect the user's location or show trust banners:
  * **Tehran:** "1–2 hour express delivery via Snappbox and motorcycle courier."
  * **Provinces:** "24–48 hour delivery via Tipax, Chapar, and terminal freight."

---

## 6. Prototyping & Rapid-Testing Roadmap with Pouria (UX)

As agreed, before diving into backend code and database setup, **6 lightweight clickable prototype pages (plain HTML/CSS/JS with Tailwind styles and the Vazirmatn font)** are built:

```
prototype/
├── admin/
│   ├── index.html            # 1. Super-fast price & stock inline editor table
│   ├── product-add.html      # 2. New-part form with left/right variants
│   └── orders.html           # 3. New-orders list & VIN (chassis) verification view
└── store/
    ├── index.html            # 4. Homepage with vehicle-selector widget & top categories
    ├── catalog.html          # 5. Catalog page with vehicle filter & part-number search
    └── product-detail.html   # 6. Product detail page, side selection, consult & add-to-cart
```

### Phasing:
1. **Phase 1 (test with Pouria):** present and review the first bundle (3 admin pages) with Pouria to validate the ergonomics of keyboard price editing.
2. **Phase 2 (storefront test):** present the second bundle (3 storefront pages) to Pouria to review the vehicle widget and the VIN field.
3. **Phase 3 (real development):** implement the Django Ninja backend, the PostgreSQL database, and the migration to Next.js.
