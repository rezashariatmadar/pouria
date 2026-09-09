# Rapid Prototype Specifications
**Project:** Interactive auto spare-parts shop prototype (client-review version)  
**Review audience:** Pouria  
**Approach:** Standalone HTML/CSS/JS files (no installation needed, run directly in any browser)  
**Direction & font:** Right-to-left (RTL) + Persian Vazirmatn font  
**Goal:** Evaluate UX ergonomics and the core business flows before the final implementation

---

## 1. Prototype Folder & Page Structure

```text
prototype/
├── admin/
│   ├── index.html            # 1. Super-fast price & stock inline editor table
│   ├── product-add.html      # 2. New-product form with brand separation & left/right variants
│   └── orders.html           # 3. Order management with a dedicated VIN (chassis) verification section
└── store/
    ├── index.html            # 4. Homepage with the 3-step vehicle-selector widget & top categories
    ├── catalog.html          # 5. Parts catalog with vehicle, category & ISACO-code filters
    └── product-detail.html   # 6. Product page with side selection (left/right), warranty & WhatsApp inquiry
```

---

## 2. Admin Panel Page Specs & Flows (First Bundle)

### 2.1. Page 1: Super-fast price & stock table (`admin/index.html`)
* **Test goal with Pouria:** confirm that changing prices is faster than in Excel.
* **Key elements:**
  * **Top toolbar:** instant in-table search, quick brand filter (ISACO, Crouse, …), bulk percentage-increase button (e.g. apply 5% to selected items), and the prominent "Save changes" button with a change counter.
  * **Data table (Spreadsheet UX):**
    * Columns: thumbnail, part name, compatible vehicles, technical/ISACO code, warehouse stock (editable), price in Toman (editable), "Call for price" toggle, and save status.
    * **Keyboard interaction:** move between price cells with **Tab** or the **arrow keys**.
    * **Low-stock visual alert:** the stock cell of items below 3 units gets a soft yellow/red background.
    * **Instant state change:** a checkbox switch to enable the "Call for price / WhatsApp inquiry" state, which grays out the price field.

### 2.2. Page 2: New product form (`admin/product-add.html`)
* **Test goal with Pouria:** is registering a new part simple enough, without extra or tiresome fields?
* **Key elements:**
  * Product name + brand selection (ISACO, Crouse, Ezam, …).
  * Factory technical code and ISACO code.
  * Compatible-vehicles section (quick checkboxes: Peugeot 206 Type 2/5, Peugeot Pars, Samand, Quick, Tiba, …).
  * Positional-variant section: the "this part has a left/right direction" checkbox, which opens separate fields (left side, right side, pair) with their own price and stock.
  * Price, initial stock, and the maximum allowed quantity per order.

### 2.3. Page 3: Orders list & VIN confirmation (`admin/orders.html`)
* **Test goal with Pouria:** reviewing how to inspect an order, see customer details, and confirm the VIN (chassis number) to prevent shipping the wrong part.
* **Key elements:**
  * Summary cards: new orders, awaiting VIN verification, shipped today.
  * Orders table with: order number, customer name & mobile number, purchased part, shipping method (Tipax / courier / freight).
  * **Dedicated VIN verification box:** shows the chassis code entered by the customer, with an "expert-confirmed part match / needs customer contact" state.

---

## 3. Storefront Page Specs & Flows (Second Bundle)

### 3.1. Storefront home (`store/index.html`)
* **Visual theme:** industrial navy/smoky (`#111827`) + energetic automotive orange & yellow (`#f59e0b` / `#ea580c`) + clean white cards.
* **Vehicle selector widget (sticky):**
  * Step 1: choose the make (IKCO / SAIPA).
  * Step 2: choose the model (Peugeot 206, Pars, Samand, Quick, Pride, …).
  * Step 3: choose the trim/year (Type 2, Type 5, TU5 engine, Saina S, …).
  * Button: "Show parts compatible with my car."
* **Quick visual categories:** consumables, suspension, brakes, electrical, cooling, body.
* **Trust banners:** part authenticity & condition guarantee, 2-hour delivery in Tehran, and shipping to all of Iran via freight and Tipax.

### 3.2. Catalog page & part filters (`store/catalog.html`)
* Smart filter sidebar: brand filter (ISACO, Valeo, Crouse), availability filter, price-range filter.
* Dedicated search bar by part number or ISACO code.
* Product card: high-quality image, authenticity (genuine) badge, price in Toman, car-compatibility badge, an add-to-cart button or a "call for price inquiry" button.

### 3.3. Product detail page (`store/product-detail.html`)
* Full part name, ISACO code, and manufacturer brand.
* Side-selection menu (right / left) with automatic stock and price changes.
* Technical-specs table and the exact list of every vehicle model this part fits.
* Action buttons: "Add to cart", "Phone consultation with an expert", "Quick WhatsApp inquiry".
* 15-minute reservation timer notice and a clarifying message about freight vs. Tipax shipping.

---

## 4. Realistic Seed Data (for the test with Pouria)

To make the prototype fully tangible for Pouria, real Iranian-market items are used:
1. **Peugeot 206 Type 5 front brake pads** — brand ISACO (ISACO code: 16401002) — price: 890,000 Toman — stock: 12
2. **Quick headlight (Crouse)** — has left/right variants — price: 1,450,000 Toman — stock: left: 4 | right: 2
3. **Peugeot Pars TU5 clutch disc & plate kit** — brand Valeo (original green box) — price: 4,850,000 Toman — stock: 3
4. **Samand EF7 national-engine water pump** — brand ISACO — price: 1,280,000 Toman — status: call for price (hourly inquiry)
5. **Pride front shock absorber** — brand Ezam — price: 1,150,000 Toman — stock: 1 (low-stock alert state)
6. **206 Type 2 oxygen sensor (mint stock / genuine)** — brand Crouse — price: 1,750,000 Toman — stock: 6

---

## 5. Demo & Test-Session Checklist with Pouria

1. Is the font, Persian numerals, and Toman-formatted price readability to his liking?
2. Is keyboard typing & price-editing ergonomics in the admin page fast and smooth enough?
3. Is the 3-step car-selection filter not confusing for the customer?
4. Is the left/right option presentation for headlights and fenders understood correctly?
5. Is the VIN (chassis) verification box in the orders page what he had in mind for preventing returns?
