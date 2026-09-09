/**
 * Checkout E2E — the M4 offline gate, end to end.
 *
 * PDP (brake pads ×2) → cart → «ادامه» → /checkout OTP login (the code is
 * recovered from the DB by hash-matching, see helpers) → address form →
 * shipping method → submit → /mock-payment → «پرداخت موفق» → result page with
 * order number YK-1000x → verified paid through the admin API, with stock
 * dropping 12 → 10.
 */
const { test, expect } = require("@playwright/test");

const { adminLogin, apiFetch, clearActiveHolds, faDigits, getOtpCode, toman } = require("./helpers");

const PHONE = "09125556677";
const PADS_URL = "/product/1/brake-pads-206-type5-isaco"; // 890,000 — seeded stock 10

test("M4 offline gate: brake pads ×2 through OTP checkout to a paid order", async ({ page }) => {
  test.setTimeout(240_000);

  // Deterministic starting point: the seed value for brake pads is stock 12
  // (seed_demo_data.py). Stock is what this test consumes, so reset it to the
  // seed so reruns stay green. A failed earlier run can also leave an active
  // 15-min hold that lowers `available` below raw stock — clear those too.
  const { access: seedToken } = await adminLogin();
  await apiFetch("/admin/products/batch-update", {
    method: "PATCH",
    token: seedToken,
    body: [{ id: 1, stock: 12 }],
  });
  clearActiveHolds();

  // ---------- 1. PDP: add 2 brake pads ----------
  await page.goto(PADS_URL);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("لنت ترمز جلو");
  await expect(page.getByText(`موجودی انبار: ${faDigits(12)} عدد (تحویل فوری)`)).toBeVisible();

  await page.getByRole("button", { name: "افزایش تعداد" }).click(); // qty → 2
  await expect(page.locator(".text-3xl")).toHaveText(toman(890_000 * 2)); // ۱٬۷۸۰٬۰۰۰ تومان

  await page.getByRole("button", { name: "افزودن به سبد خرید و پرداخت آنلاین" }).click();
  await expect(page.getByText("به سبد اضافه شد")).toBeVisible();

  // ---------- 2. Cart ----------
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "سبد خرید", exact: true })).toBeVisible();
  await expect(page.getByText("لنت ترمز جلو پژو ۲۰۶ تیپ ۵ (ایساکو شرکتی)")).toBeVisible();
  await expect(page.getByText(toman(890_000 * 2)).first()).toBeVisible();

  await page.getByRole("link", { name: "ادامه فرآیند خرید" }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  // ---------- 3. OTP login ----------
  await expect(page.getByRole("heading", { name: "ورود / عضویت" })).toBeVisible();

  const phoneInput = page.locator("input[autocomplete='tel']");
  await phoneInput.fill(PHONE);
  await page.getByRole("button", { name: "دریافت کد" }).click();

  await expect(page.getByText("کد تایید پیامک شد")).toBeVisible();
  await expect(page.getByRole("heading", { name: "کد تایید را وارد کنید" })).toBeVisible();

  // The backend logs the SMS to its own console — recover the code from the DB
  const code = getOtpCode(PHONE);
  await page.locator("input[autocomplete='one-time-code']").fill(code);
  await page.getByRole("button", { name: "تایید", exact: true }).click();

  // ---------- 4. Address form ----------
  await expect(page.getByRole("heading", { name: "آدرس ارسال" })).toBeVisible();
  await expect(page.locator("input[readonly]")).toHaveValue(PHONE);

  await page.getByLabel("نام و نام خانوادگی گیرنده").fill("پوریا محمدی");
  await page.getByLabel("استان").selectOption("تهران");
  await page.getByLabel("شهر", { exact: true }).fill("تهران");
  await page.getByLabel("نشانی کامل").fill("خیابان آزادی، کوچه بهار، پلاک ۱۲، واحد ۳");
  await page.getByLabel(/کد پستی/).fill("1234567890");

  // ---------- 5. Shipping method ----------
  await page.getByText("پست پیشتاز", { exact: true }).click();
  await expect(page.getByText("هزینه ارسال")).toBeVisible();
  await expect(page.getByText("مبلغ کل")).toBeVisible();

  // ---------- 6. Submit → mock gateway ----------
  await page.getByRole("button", { name: "پرداخت و ثبت سفارش" }).click();

  await expect(page).toHaveURL(/\/mock-payment\?track_id=/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "درگاه پرداخت آزمایشی" })).toBeVisible();

  const orderFromGateway = new URL(page.url()).searchParams.get("order");
  expect(orderFromGateway).toMatch(/^YK-\d+$/);
  await expect(page.getByText(orderFromGateway)).toBeVisible();

  // ---------- 7. Pay successfully ----------
  await page.getByRole("button", { name: "پرداخت موفق" }).click();

  await expect(page).toHaveURL(/\/checkout\/result\?order=/);
  await expect(page.getByRole("heading", { name: "پرداخت با موفقیت انجام شد" })).toBeVisible();

  const orderNumber = new URL(page.url()).searchParams.get("order");
  expect(orderNumber).toMatch(/^YK-\d+$/);
  expect(orderNumber).toBe(orderFromGateway);
  await expect(page.locator("div.font-mono.text-lg")).toHaveText(orderNumber);

  // ---------- 8. Admin API: the order exists and is paid ----------
  const { access: adminToken } = await adminLogin();
  const orders = await apiFetch(`/admin/orders?q=${orderNumber}`, { token: adminToken });
  expect(orders.total).toBe(1);
  const order = orders.items[0];
  expect(order.order_number).toBe(orderNumber);
  expect(order.status).toBe("paid");
  expect(order.status_display).toContain("پرداخت");
  expect(order.customer.phone_number).toBe(PHONE);
  expect(order.lines).toHaveLength(1);
  expect(order.lines[0].title).toContain("لنت ترمز جلو");
  expect(order.lines[0].quantity).toBe(2);
  expect(order.lines[0].unit_price).toBe(890_000);
  expect(order.total_amount).toBe(890_000 * 2 + 30_000); // + پست پیشتاز

  // ---------- 9. Stock went 12 → 10 ----------
  const detail = await apiFetch("/catalog/products/1");
  expect(detail.stock).toBe(10);

  // ---------- 10. Cart was cleared after the paid result ----------
  await page.goto("/cart");
  await expect(page.getByText("سبد خرید شما خالی است")).toBeVisible();
});
