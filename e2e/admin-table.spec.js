/**
 * Admin fast-table E2E — port of verify-fixes.js §10.
 *
 * Covers: the /login credential flow, the fast price/stock table loading all
 * seeded products + variant sub-rows, inline price editing with the dirty
 * counter, Ctrl+S batch save, persistence verified through the API, and the
 * «ناموجودها» stock filter. Every price the test changes is restored.
 */
const { test, expect } = require("@playwright/test");

const { adminLogin, apiFetch, faDigits, fastTableRows } = require("./helpers");

/** Product used for the price-edit round-trip (nothing else in the suite depends on its price). */
const EDIT_PRODUCT_ID = 12; // طبق کامل چپ و راست پژو ۲۰۶ امیرنیا اصل — ۱,۶۲۰,۰۰۰
const EDIT_PRODUCT_TITLE = "طبق کامل چپ و راست پژو ۲۰۶ امیرنیا اصل";

/** Log in via the API and land on /admin with the token already in localStorage. */
async function openAdmin(page) {
  const { access } = await adminLogin();
  await page.goto("/login");
  await page.evaluate((token) => localStorage.setItem("yadak_admin_token", token), access);
  await page.goto("/admin");
  await page.locator("tbody tr").first().waitFor();
}

const rowFor = (rows, productId) =>
  rows.find((r) => r.product_id === productId && r.variant_id === null);

test.describe.serial("admin fast table", () => {
  let originalPrice = null;

  test("/login credential flow lands on the fast table", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "ورود به پنل مدیریت یدک‌پرو" })).toBeVisible();

    await page.getByLabel("نام کاربری").fill("pouria");
    await page.getByLabel("رمز عبور").fill("YadakSm0ke!");
    await page.getByRole("button", { name: "ورود", exact: true }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator("tbody tr").first()).toContainText("لنت ترمز جلو");
  });

  test("fast table loads 12 products plus variant sub-rows", async ({ page }) => {
    await openAdmin(page);

    // Column headers
    for (const header of ["قطعه", "قیمت (تومان)", "موجودی", "تماس بگیر"]) {
      await expect(page.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
    }

    // 12 products + 3 headlight variants (راست/چپ/جفت) = 15 rows
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(15);

    // First product row: brake pads with its brand + code underneath
    await expect(rows.first()).toContainText("لنت ترمز جلو پژو ۲۰۶ تیپ ۵ (ایساکو شرکتی)");
    await expect(rows.first()).toContainText("ایساکو");

    // Variant sub-rows belong to the quick headlight product
    await expect(page.locator("tbody tr").filter({ hasText: "سمت راست (شاگرد)" })).toHaveCount(1);
    await expect(page.locator("tbody tr").filter({ hasText: "سمت چپ (راننده)" })).toHaveCount(1);
    await expect(page.locator("tbody tr").filter({ hasText: "جفت (راست + چپ)" })).toHaveCount(1);

    // Price cells render Persian digits: brake pads ۸۹۰٬۰۰۰
    const firstPrice = rows.first().locator("td").nth(1).locator("input");
    await expect(firstPrice).toHaveValue(faDigits(890_000));
  });

  test("price cell edit → dirty counter → Ctrl+S saves → persists (restored afterwards)", async ({ page }) => {
    await openAdmin(page);

    // Snapshot the original price through the API before touching the UI
    const before = rowFor(await fastTableRows(), EDIT_PRODUCT_ID);
    originalPrice = before.price;
    const newPrice = originalPrice + 15_000;

    const row = page.locator("tbody tr").filter({ hasText: EDIT_PRODUCT_TITLE });
    await expect(row).toHaveCount(1);
    const priceInput = row.locator("td").nth(1).locator("input");
    await expect(priceInput).toHaveValue(faDigits(originalPrice));

    // Edit the price cell
    await priceInput.click();
    await priceInput.fill(String(newPrice));

    // Dirty counter appears
    const dirty = page.getByText("تغییر ذخیره‌نشده");
    await expect(dirty).toBeVisible();
    await expect(dirty).toHaveText(`${faDigits(1)} تغییر ذخیره‌نشده`);

    // Ctrl+S saves the batch
    await page.keyboard.press("Control+s");
    await expect(dirty).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ذخیره همه/ })).toBeDisabled();

    // Persisted — checked with a fresh admin token through the API
    const after = rowFor(await fastTableRows(), EDIT_PRODUCT_ID);
    expect(after.price).toBe(newPrice);

    // And still there after a full page reload
    await page.reload();
    const priceAfterReload = page
      .locator("tbody tr")
      .filter({ hasText: EDIT_PRODUCT_TITLE })
      .locator("td")
      .nth(1)
      .locator("input");
    await expect(priceAfterReload).toHaveValue(faDigits(newPrice));

    // Restore the original price — leave no residue
    const { access } = await adminLogin();
    await apiFetch("/admin/products/batch-update", {
      method: "PATCH",
      token: access,
      body: [{ id: EDIT_PRODUCT_ID, price: originalPrice }],
    });
    const restored = rowFor(await fastTableRows(), EDIT_PRODUCT_ID);
    expect(restored.price).toBe(originalPrice);
  });

  test.afterAll(async () => {
    // Belt-and-braces: force the original price back even if the test above failed midway.
    if (originalPrice === null) return;
    const rows = await fastTableRows();
    const current = rowFor(rows, EDIT_PRODUCT_ID);
    if (current && current.price !== originalPrice) {
      const { access } = await adminLogin();
      await apiFetch("/admin/products/batch-update", {
        method: "PATCH",
        token: access,
        body: [{ id: EDIT_PRODUCT_ID, price: originalPrice }],
      });
    }
  });

  test("stock filter «ناموجودها» shows only zero-stock rows", async ({ page }) => {
    await openAdmin(page);

    await page.getByRole("button", { name: "ناموجودها", exact: true }).click();

    // Zero-stock products: چراغ جلو کوئیک (parent row; its variants are in stock), کمک فنر پراید، رادیاتور
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("چراغ جلو کوئیک کروز");
    await expect(rows.nth(1)).toContainText("کمک فنر جلو پراید");
    await expect(rows.nth(2)).toContainText("رادیاتور آب دولول");

    // In-stock rows (e.g. the headlight variants) must be gone
    await expect(page.locator("tbody tr").filter({ hasText: "سمت راست (شاگرد)" })).toHaveCount(0);
    await expect(page.locator("tbody tr").filter({ hasText: "لنت ترمز جلو" })).toHaveCount(0);

    // Every remaining stock cell reads zero (stock 0 renders as an empty input)
    const stockValues = await page
      .locator("tbody td:nth-child(3) input")
      .evaluateAll((els) => els.map((e) => e.value));
    expect(stockValues).toHaveLength(3);
    for (const v of stockValues) expect(["", "۰"]).toContain(v);

    // Switching back to «همه» restores the full grid
    await page.getByRole("button", { name: "همه", exact: true }).click();
    await expect(rows).toHaveCount(15);
  });
});
