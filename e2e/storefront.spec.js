/**
 * Storefront E2E — port of verify-fixes.js §1–3, 6–9 to the Next.js app.
 *
 * Covers: home hero + vehicle selector deep-link, catalog server-side filters
 * (category / make), out-of-stock handling, header search, the home-page VIN
 * decoder's three outcomes, PDP variant price switching, the qty stepper's
 * max, and add-to-cart → cart.
 */
const { test, expect } = require("@playwright/test");

const { faDigits, toman } = require("./helpers");

// Seeded data (backend/apps/catalog/management/commands/seed_demo_data.py)
const PADS_URL = "/product/1/brake-pads-206-type5-isaco"; // 890,000 — stock 10, max_order 5
const HEADLIGHT_URL = "/product/5/quick-headlight-crouse"; // variants R/L 1,450,000 — PAIR 2,800,000
const RADIATOR_URL = "/product/8/radiator-405-pars-iran-radiator"; // stock 0

test.describe("storefront", () => {
  test("home page loads with Persian title, hero and vehicle selector", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/یدک‌پرو/);

    // Hero (RSC — no client fetch needed)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "قطعه دقیق اتومبیلت را با قیمت لحظه‌ای"
    );
    await expect(page.getByText("بزرگ‌ترین کاتالوگ آنلاین قطعات اصلی ایران‌خودرو و سایپا")).toBeVisible();

    // Vehicle selector widget
    await expect(page.getByText("انتخاب هوشمند خودرو (فیلتر قطعات ۱۰۰٪ سازگار)")).toBeVisible();

    // Featured products section — server-rendered from the API
    await expect(page.getByRole("heading", { name: "قطعات منتخب آماده ارسال" })).toBeVisible();
    await expect(page.getByText("۱۲ قطعه فعال در کاتالوگ یدک‌پرو")).toBeVisible();
    await expect(page.locator("a[href^='/product/']")).not.toHaveCount(0);

    // html lang/dir
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("fa");
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  });

  test("vehicle selector deep-links to catalog (?make=&model=)", async ({ page }) => {
    await page.goto("/");

    // The hero section hosts the 3-step vehicle selector
    const hero = page.locator("section").filter({
      has: page.getByRole("heading", { level: 1 }),
    });
    const makeSelect = hero.locator("select").first();
    const modelSelect = hero.locator("select").nth(1);

    await makeSelect.selectOption("ikco"); // ایران‌خودرو
    await modelSelect.selectOption("peugeot-206"); // پژو ۲۰۶

    await page.getByRole("button", { name: "مشاهده و خرید قطعات سازگار" }).click();

    await expect(page).toHaveURL(/\/catalog\?make=ikco&model=peugeot-206$/);
    await expect(page.getByText("۸ قطعه یافت شد")).toBeVisible();

    // Active-filter bar with removable chips
    await expect(page.getByText("فیلتر فعال:")).toBeVisible();
    await expect(page.getByRole("button", { name: "خودرو: ikco ✕" })).toBeVisible();
    await expect(page.getByRole("button", { name: "مدل: peugeot-206 ✕" })).toBeVisible();

    // Only 206-compatible products are listed (8 seeded items)
    await expect(page.locator("a[href^='/product/']")).toHaveCount(8);
  });

  test("catalog filters by category (chip + deep-link) and make", async ({ page }) => {
    // Category via chip click
    await page.goto("/catalog");
    await expect(page.getByText("۱۲ قطعه یافت شد")).toBeVisible();
    await page.getByRole("button", { name: "برقی", exact: true }).click();
    await expect(page).toHaveURL(/\/catalog\?cat=electrical/);
    await expect(page.getByText("۲ قطعه یافت شد")).toBeVisible();
    await expect(page.getByText("شمع موتور سوزنی ایریدیوم دنسو ژاپن")).toBeVisible();
    await expect(page.getByText("سنسور اکسیژن ۲۰۶ (سیم کوتاه کروز اصل)")).toBeVisible();

    // Category via deep-link: cooling → واتر پمپ (call-for-price) + رادیاتور (out of stock)
    await page.goto("/catalog?cat=cooling");
    await expect(page.getByText("۲ قطعه یافت شد")).toBeVisible();
    const radiatorCard = page.locator("a[href^='/product/8/']");
    await expect(radiatorCard).toBeVisible();
    await expect(radiatorCard.getByText("ناموجود", { exact: true })).toBeVisible();
    const waterPumpCard = page.locator("a[href^='/product/4/']");
    await expect(waterPumpCard).toBeVisible();
    await expect(waterPumpCard.getByText("تماس بگیرید", { exact: true })).toBeVisible();

    // Make filter: saipa → 3 products (شمع، چراغ جلو کوئیک، کمک فنر پراید)
    await page.goto("/catalog?make=saipa");
    await expect(page.getByText("۳ قطعه یافت شد")).toBeVisible();
    await expect(page.getByText("چراغ جلو کوئیک کروز")).toBeVisible();
    await expect(page.getByText("کمک فنر جلو پراید (عظام اصل شرکتی)")).toBeVisible();
  });

  test("out-of-stock PDP shows ناموجود and no add-to-cart", async ({ page }) => {
    await page.goto(RADIATOR_URL);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("رادیاتور آب دولول");
    await expect(page.getByText("فعلاً ناموجود — با تماس، زمان ورود را استعلام کنید")).toBeVisible();
    await expect(page.getByText("این قطعه فعلاً ناموجود است")).toBeVisible();

    // No add-to-cart button anywhere on the page
    await expect(
      page.getByRole("button", { name: "افزودن به سبد خرید و پرداخت آنلاین" })
    ).toHaveCount(0);
  });

  test("header search lands on catalog with results", async ({ page }) => {
    await page.goto("/");
    const search = page.getByPlaceholder("جستجوی نام قطعه یا کد فنی...");
    await search.fill("لنت");
    await search.press("Enter");

    await expect(page).toHaveURL(/\/catalog\?q=/);
    await expect(page.getByText("۱ قطعه یافت شد")).toBeVisible();

    // The single hit is the brake pads product
    await expect(page.getByText("لنت ترمز جلو پژو ۲۰۶ تیپ ۵ (ایساکو شرکتی)")).toBeVisible();
    await expect(page.locator("a[href^='/product/1/']")).toHaveCount(1);

    // Active-filter bar echoes the query
    await expect(page.getByText("«لنت»")).toBeVisible();
  });

  test("VIN decoder: invalid red, valid NAS green, platform mismatch amber", async ({ page }) => {
    await page.goto("/");
    const vinSection = page.locator("section").filter({
      hasText: "سامانه هوشمند رمزگشایی شماره شاسی",
    });
    const vinInput = vinSection.getByPlaceholder("مثال: NAS411100P1452098");
    const platformSelect = vinSection.locator("select");

    // The status badge is the rounded-full pill; getByText alone resolves to its
    // inner (classless) label span, so filter the pill by its text.
    const badge = (label) => vinSection.locator("span.rounded-full").filter({ hasText: label });

    // --- invalid format → red
    await vinInput.fill("IRN411100P999999");
    await expect(badge("قالب شماره شاسی نامعتبر است")).toBeVisible();
    await expect(badge("قالب شماره شاسی نامعتبر است")).toHaveClass(/text-rose-300/);
    await expect(vinSection.getByText(/NAAP\/NAAB\/NAS شروع می‌شوند/)).toBeVisible();

    // --- valid Saipa NAS prefix → green
    await vinInput.fill("NAS411100P1452098");
    await expect(badge("شماره شاسی معتبر و تایید شد")).toBeVisible();
    await expect(badge("شماره شاسی معتبر و تایید شد")).toHaveClass(/text-emerald-300/);
    await expect(vinSection.getByText("پلتفرم شناسایی‌شده: سایپا")).toBeVisible();

    // --- same VIN vs. selected IKCO platform → amber mismatch
    await platformSelect.selectOption("ikco"); // قطعه ایران‌خودرو
    await expect(badge("شاسی با پلتفرم انتخابی هم‌خوانی ندارد")).toBeVisible();
    await expect(badge("شاسی با پلتفرم انتخابی هم‌خوانی ندارد")).toHaveClass(/text-amber-300/);
    await expect(
      vinSection.getByText(/این شاسی متعلق به پلتفرم سایپا است، اما این قطعه برای ایران‌خودرو است/)
    ).toBeVisible();
  });

  test("PDP variant switching changes price (headlight right/left vs pair)", async ({ page }) => {
    await page.goto(HEADLIGHT_URL);
    const price = page.locator(".text-3xl"); // BuyBox price — unique on the PDP

    // Default variant: سمت راست (شاگرد) → inherited product price 1,450,000
    await expect(page.getByRole("button", { name: /سمت راست \(شاگرد\)/ })).toHaveClass(/border-brand-500/);
    await expect(price).toHaveText(toman(1_450_000));
    await expect(page.getByText(`موجودی انبار: ${faDigits(4)} عدد (تحویل فوری)`)).toBeVisible();

    // Variant buttons carry their own prices
    await expect(page.getByRole("button", { name: /سمت چپ \(راننده\)/ })).toContainText(
      `${faDigits(1_450_000)} تومان`
    );
    await expect(page.getByRole("button", { name: /جفت \(راست \+ چپ\)/ })).toContainText(
      `${faDigits(2_800_000)} تومان`
    );

    // Switch to جفت → price and stock swap
    await page.getByRole("button", { name: /جفت \(راست \+ چپ\)/ }).click();
    await expect(price).toHaveText(toman(2_800_000)); // ۲٬۸۰۰٬۰۰۰ تومان
    await expect(page.getByText(`موجودی انبار: ${faDigits(2)} عدد (تحویل فوری)`)).toBeVisible();
    await expect(page.getByRole("button", { name: /جفت \(راست \+ چپ\)/ })).toHaveClass(/border-brand-500/);

    // And back to سمت چپ → 1,450,000 again
    await page.getByRole("button", { name: /سمت چپ \(راننده\)/ }).click();
    await expect(price).toHaveText(toman(1_450_000));
  });

  test("qty stepper respects max (min(stock, max_order_quantity))", async ({ page }) => {
    await page.goto(PADS_URL); // stock 10, max_order_quantity 5 → cap 5

    await expect(page.getByText(/حداکثر ۵/)).toBeVisible();
    const inc = page.getByRole("button", { name: "افزایش تعداد" });
    const qtyDisplay = inc.locator("xpath=following-sibling::span");

    await expect(qtyDisplay).toHaveText("۱");

    // Click + until it disables at the cap — Playwright refuses to click a
    // disabled button, so reaching the disabled state IS the cap being enforced.
    for (let i = 0; i < 4; i++) {
      await inc.click();
    }
    await expect(qtyDisplay).toHaveText("۵");
    await expect(inc).toBeDisabled();

    // Total price follows qty: 5 × 890,000
    await expect(page.locator(".text-3xl")).toHaveText(toman(890_000 * 5));
    await expect(page.getByText(/\(۵ × /)).toBeVisible();

    // Decrement works again
    await page.getByRole("button", { name: "کاهش تعداد" }).click();
    await expect(qtyDisplay).toHaveText("۴");
  });

  test("add-to-cart then cart page shows the item", async ({ page }) => {
    await page.goto(PADS_URL);
    await page.getByRole("button", { name: "افزودن به سبد خرید و پرداخت آنلاین" }).click();

    // Success toast with a link to the cart
    await expect(page.getByText("به سبد اضافه شد")).toBeVisible();
    await page.getByRole("link", { name: "مشاهده سبد خرید" }).click();

    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole("heading", { name: "سبد خرید", exact: true })).toBeVisible();
    await expect(page.getByText("لنت ترمز جلو پژو ۲۰۶ تیپ ۵ (ایساکو شرکتی)")).toBeVisible();
    await expect(page.getByText("سبد خرید شما خالی است")).toHaveCount(0);

    // Item line total + subtotal: 1 × 890,000
    await expect(page.getByText("جمع اقلام")).toBeVisible();
    await expect(page.getByText(toman(890_000)).first()).toBeVisible();

    // Header badge shows the count in Persian digits
    const badge = page.locator("a[href='/cart'] span").last();
    await expect(badge).toHaveText("۱");
  });
});
