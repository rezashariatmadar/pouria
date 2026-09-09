# Requirements Discovery & Questionnaire — Auto Spare-Parts E-Commerce Website

This document is designed to examine and clarify every technical, process, and operational dimension of the website. Its special focus is on the client's two main concerns (**very fast price updates** and **smooth warehouse inventory management**) and vehicle-parts compatibility.

---

## 1. Priority 1: Fast, instant price-update mechanism (Price Management)
Given the daily and hourly price volatility of the spare-parts market:

1. **What is your preferred method for changing prices?**
   * **Excel file (bulk update):** download an Excel export, edit the price column, and re-upload within seconds?
   * **Inline fast editing:** an Excel-like table inside the admin panel where prices can be typed directly and a single "Save all" button pressed?
   * **Percentage / bulk changes:** e.g. applying a "10% price increase" to all parts of a specific brand (e.g. ISACO or Crouse products) or a specific category?
2. **How should items without a live or known price behave?**
   * Show a "Call for price" status instead of the buy button?
   * Temporarily disable the add-to-cart button?
   * Offer a quick price inquiry via WhatsApp/phone for that exact part?
3. **Do you run accounting software?**
   * (Such as Sepidar, Holoo, Hesabfa, Parmis, Tadbir, …)
   * Should prices and stock sync directly from your accounting software to the website, or will management happen inside the site itself?

---

## 2. Priority 2: Inventory & warehouse management (Inventory Control)

1. **What should the new-product registration flow look like?**
   * Is part information (name, brand, compatibility, photos) entered once, with only the stock number and price changing afterwards?
   * Do you need bulk item registration via an Excel file (CSV import)?
2. **What is your warehouse structure?**
   * Do you have one central warehouse, or several separate warehouses/shops (shop warehouse + central warehouse)?
3. **Out-of-stock alerting (low-stock alert):**
   * Would you like an item's stock below, say, 2 units to be shown in red in the panel, or to trigger an SMS alert to you?
4. **Brand & quality variety for a single part (variations):**
   * For a specific part (e.g. Peugeot 206 front brake pads), are different brands (ISACO, Mkco, High-Q, Textar) registered as separate products, or as one product with a brand menu and different prices?
   * For body/headlight parts: should the left/right split (driver side / passenger side) be modeled as product variants?
5. **Site behavior when stock runs out:**
   * Should out-of-stock items move to the end of the product list?
   * Should the "notify me when back in stock" (SMS) option be active for customers?

---

## 3. Catalog, Categories & Vehicle Compatibility (Fitment)

1. **What is your shop's vehicle coverage?**
   * Domestic vehicles (IKCO, SAIPA)?
   * Chinese vehicles (Modiran/MVM/Funvic, Kerman Motor/JAC, Bahman/Fidelity/Dignity, …)?
   * Imported vehicles (Kia, Hyundai, Toyota, …)?
2. **How customers search & filter parts:**
   * Should the customer be able to see only parts that fit their car by selecting **"vehicle brand > model > production year / trim"**?
   * Is search by **technical part code (Part Number / OE Number)** needed for professional customers and mechanics?
3. **Complementary-part suggestions:**
   * Should the product page suggest complementary parts? (e.g. offering brake pads when buying brake discs).

---

## 4. Customers, Access Levels & Wholesale (B2B vs B2C)

1. **Do you have wholesale or partner pricing?**
   * Should mechanics, battery shops, or provincial shops have special accounts that, after your approval, show wholesale/discounted prices?
2. **Invoices & pro-formas:**
   * Does the customer need a "pro-forma invoice" before payment?
   * Is a standard warehouse invoice printout needed for order preparation (pick list) in the warehouse?

---

## 5. Payment & Legal Matters

1. **Which payment gateways are you considering?**
   * Direct bank gateways (Behpardakht Melli, Sadad, Saman/SEP, Parsian)?
   * Intermediary gateways (ZarinPal, Zibal, NextPay)?
   * Do you intend to offer installment/credit purchases (SnappPay BNPL / Tara)?
2. **eNamad trust seal & tax:**
   * Do you have a tax file and eNamad seal ready?
   * Do invoices need to connect to the Moadian (state tax) system, or national ID registration for purchases above a set limit?

---

## 6. Shipping & Logistics for Auto Parts
Auto parts vary widely in weight and volume (from a tiny fuse relay to a large door or bumper):

1. **Intra-city shipping methods:**
   * Instant motorcycle courier / pickup van (Snapp, Tapsi, Alopex), collect-on-delivery or fixed fee?
2. **Inter-city shipping methods:**
   * Light, standard parts: express post, Tipax, Chapar (collect-on-delivery).
   * Heavy, bulky parts (hood, bumper, radiator, exhaust, …): terminal freight / bus cargo.
3. **In-person pickup:**
   * Should a "pickup from warehouse/shop" option be active in the checkout flow?

---

## 7. Authentication & SMS System (Auth & SMS)

1. **Login & registration:**
   * Fast sign-up with only **mobile number + one-time SMS code (SMS OTP)** (the Iranian standard, no email needed).
2. **SMS panel:**
   * Do you have an active SMS panel with a service line (able to send codes even to ad-blocked/blacklisted numbers)? (Kavenegar, FarazSMS, Melipayamak, …)
3. **SMS events:**
   * Send an order-confirmation SMS to the customer.
   * Send an SMS to the warehouse manager when a new order is placed.
   * SMS with the shipment tracking code (post/Tipax/freight).

---

## 8. Infrastructure, Look & Timeline (UI/UX & Infrastructure)

1. **Reference examples:**
   * Which 2 or 3 active spare-parts websites (or large shops like Digikala or Torob) have UI or speed you like?
2. **Hosting & servers:**
   * For stability during international internet outages, the project's server will be hosted in Iranian data centers (ArvanCloud / Asiatech / Afranet).
3. **Phasing & timeline:**
   * How many SKUs do you want to launch with in the first phase (MVP), and what is your target timeline?
