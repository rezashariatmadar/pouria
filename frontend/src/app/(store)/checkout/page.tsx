"use client";

/**
 * تسویه حساب: ورود OTP → آدرس ارسال → روش ارسال → VIN اختیاری → خلاصه و پرداخت.
 * POST /checkout/create-payment با اقلام {product_id, variant_id, quantity} —
 * قیمت‌ها سمت سرور محاسبه می‌شوند؛ در پاسخ payment_url به درگاه هدایت می‌شویم.
 */

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { CheckoutSummary } from "@/components/store/checkout-summary";
import {
  OtpInline,
  clearCustomer,
  getCustomer,
  type CustomerSession,
} from "@/components/store/otp-inline";
import { toman } from "@/lib/format";
import { validateVin } from "@/lib/vin";
import { useCart } from "@/stores/cart";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** روش‌های ارسال — مطابق enum مدل Order با هزینه‌های ثابت MVP. */
const SHIPPING_METHODS = [
  { value: "tipax", label: "تیپاکس (پس‌کرایه)", cost: 45_000, icon: "📦" },
  { value: "post", label: "پست پیشتاز", cost: 30_000, icon: "✉️" },
  { value: "courier", label: "پیک موتوری فوری (ویژه تهران)", cost: 25_000, icon: "🛵" },
  { value: "freight", label: "باربری ترمینال", cost: 60_000, icon: "🚛" },
  { value: "pickup", label: "تحویل حضوری از انبار", cost: 0, icon: "🏬" },
] as const;

const PROVINCES = [
  "تهران", "البرز", "اصفهان", "خراسان رضوی", "فارس", "آذربایجان شرقی", "آذربایجان غربی",
  "خوزستان", "گیلان", "مازندران", "قم", "کرمان", "یزد", "کرمانشاه", "هرمزگان", "همدان",
  "سیستان و بلوچستان", "لرستان", "اردبیل", "مرکزی", "قزوین", "زنجان", "بوشهر", "گلستان",
  "کردستان", "چهارمحال و بختیاری", "ایلام", "سمنان", "خراسان شمالی", "خراسان جنوبی",
  "کهگیلویه و بویراحمد",
];

export default function CheckoutPage() {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [mounted, setMounted] = useState(false);

  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);

  const [fullName, setFullName] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [shipping, setShipping] = useState<string>("tipax");
  const [vin, setVin] = useState("");
  const [customerNote, setCustomerNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
    setSession(getCustomer());
    setAuthChecked(true);
  }, []);

  const shippingCost = useMemo(
    () => SHIPPING_METHODS.find((m) => m.value === shipping)?.cost ?? 0,
    [shipping]
  );

  // اعتبارسنجی زنده VIN — همیشه فقط هشدار است، خرید مجاز می‌ماند
  const vinResult = useMemo(() => {
    if (!vin.trim()) return null;
    return validateVin(vin);
  }, [vin]);

  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.full_name = "نام و نام خانوادگی را وارد کنید";
    if (!province) errs.province = "استان را انتخاب کنید";
    if (!city.trim()) errs.city = "شهر را وارد کنید";
    if (address.trim().length < 10) errs.address = "آدرس کامل را وارد کنید (حداقل ۱۰ حرف)";
    if (shipping !== "pickup") {
      if (!/^\d{10}$/.test(postalCode))
        errs.postal_code = "کد پستی ۱۰ رقمی لازم است (برای تحویل حضوری خالی بماند)";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submitOrder(_: FormEvent) {
    _.preventDefault();
    setError(null);
    if (!validateForm() || !session || busy) return;

    setBusy(true);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/checkout/create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access}`,
        },
        body: JSON.stringify({
          // دقیقاً مطابق CheckoutIn بک‌اند: {quantity, shipping_address, postal_code, ...}
          items: items.map((it) => ({
            product_id: it.product_id,
            variant_id: it.variant_id,
            quantity: it.qty,
          })),
          shipping_method: shipping,
          vin_or_chassis: vin.trim() ? vin.trim().toUpperCase() : "",
          customer_note: customerNote.trim()
            + (customerNote.trim() ? " — " : "")
            + `گیرنده: ${fullName.trim()} — ${province} / ${city.trim()}`,
          shipping_address: `${address.trim()} — ${city.trim()} / ${province}`,
          postal_code: postalCode.trim(),
        }),
      });

      const text = await resp.text();
      const body = text ? JSON.parse(text) : null;

      if (resp.status === 401) {
        // نشست منقضی — برگرد به OTP
        clearCustomer();
        setSession(null);
        setError("نشست شما منقضی شد — دوباره وارد شوید");
        return;
      }

      if (!resp.ok) {
        const detail = body?.detail ?? body?.message ?? `خطای ${resp.status}`;
        setError(String(detail));
        return;
      }

      // موفق — سبد را خالی کن و به درگاه برو (سبد در نتیجه پرداخت دوباره چک می‌شود)
      if (body?.payment_url) {
        clearCart();
        window.location.href = String(body.payment_url);
      } else {
        setError("پاسخ درگاه نامعتبر است — با پشتیبانی تماس بگیرید");
      }
    } catch {
      setError("ارتباط با سرور برقرار نشد — دوباره تلاش کنید");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !authChecked) {
    return (
      <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10">
        <p className="p-8 text-center text-gray-400">در حال بارگذاری…</p>
      </main>
    );
  }

  // مرحله ۱: ورود با OTP
  if (!session) {
    return (
      <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/cart" className="text-sm text-gray-400 hover:text-gray-200">
            ← سبد خرید
          </Link>
          <h1 className="text-2xl font-bold text-white">تسویه حساب</h1>
        </div>
        {error && (
          <p className="mx-auto mb-4 max-w-sm rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        <OtpInline onAuthed={(s) => { setError(null); setSession(s); }} />
      </main>
    );
  }

  // مرحله ۲: فرم تسویه
  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/cart" className="text-sm text-gray-400 hover:text-gray-200">
          ← سبد خرید
        </Link>
        <h1 className="text-2xl font-bold text-white">تسویه حساب</h1>
        <span className="ms-auto text-sm text-gray-400" dir="ltr">
          {session.phone}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center">
          <h2 className="text-lg font-bold text-white">سبد خرید شما خالی است</h2>
          <Link
            href="/catalog"
            className="mt-4 inline-block rounded-lg bg-brand-500 px-6 py-2.5 font-bold text-white hover:bg-brand-600"
          >
            رفتن به فروشگاه
          </Link>
        </div>
      ) : (
        <form onSubmit={submitOrder} className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            {/* آدرس ارسال */}
            <section className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <h2 className="font-bold text-white">آدرس ارسال</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm text-gray-300">نام و نام خانوادگی گیرنده</span>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-brand-500"
                  />
                  {fieldErrors.full_name && (
                    <span className="block text-xs text-red-400">{fieldErrors.full_name}</span>
                  )}
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm text-gray-300">شماره موبایل</span>
                  <input
                    value={session.phone}
                    readOnly
                    dir="ltr"
                    className="w-full cursor-not-allowed rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2.5 text-gray-400 outline-none"
                  />
                  <span className="block text-xs text-gray-500">شماره وارد‌شده هنگام ورود</span>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm text-gray-300">استان</span>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-brand-500"
                  >
                    <option value="">انتخاب استان…</option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  {fieldErrors.province && (
                    <span className="block text-xs text-red-400">{fieldErrors.province}</span>
                  )}
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm text-gray-300">شهر</span>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-brand-500"
                  />
                  {fieldErrors.city && (
                    <span className="block text-xs text-red-400">{fieldErrors.city}</span>
                  )}
                </label>

                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-sm text-gray-300">نشانی کامل</span>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    required
                    placeholder="خیابان، کوچه، پلاک، واحد…"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white placeholder:text-gray-500 outline-none focus:border-brand-500"
                  />
                  {fieldErrors.address && (
                    <span className="block text-xs text-red-400">{fieldErrors.address}</span>
                  )}
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm text-gray-300">
                    کد پستی {shipping === "pickup" && <span className="text-gray-500">(برای تحویل حضوری لازم نیست)</span>}
                  </span>
                  <input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="۱۰ رقم"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white placeholder:text-gray-600 outline-none focus:border-brand-500"
                  />
                  {fieldErrors.postal_code && (
                    <span className="block text-xs text-red-400">{fieldErrors.postal_code}</span>
                  )}
                </label>
              </div>
            </section>

            {/* روش ارسال */}
            <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <h2 className="font-bold text-white">روش ارسال</h2>
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {SHIPPING_METHODS.map((m) => (
                  <label
                    key={m.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                      shipping === m.value
                        ? "border-brand-500 bg-brand-500/10"
                        : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      value={m.value}
                      checked={shipping === m.value}
                      onChange={() => setShipping(m.value)}
                      className="accent-brand-500"
                    />
                    <span className="text-lg">{m.icon}</span>
                    <span className="flex-1 text-sm text-gray-200">{m.label}</span>
                    <span className="text-sm font-bold text-gray-300" dir="ltr">
                      {m.cost === 0 ? "رایگان" : toman(m.cost)}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* VIN اختیاری */}
            <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-bold text-white">شماره شاسی / VIN</h2>
                <span className="text-xs text-gray-500">اختیاری — برای کاهش مرجوعی</span>
              </div>
              <input
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase().slice(0, 20))}
                dir="ltr"
                placeholder="مثلاً NAAP411000P123456"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 font-mono text-sm tracking-widest text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-500 outline-none focus:border-brand-500"
              />
              {vinResult && (
                <p
                  className={`text-sm ${
                    vinResult.ok ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {vinResult.message}
                  {vinResult.level === "mismatch" && " — خرید همچنان مجاز است"}
                </p>
              )}
              {vinResult && !vinResult.ok && vinResult.level === "invalid" && (
                <p className="text-xs text-amber-400">
                  می‌توانید ادامه دهید؛ کارشناسان ما شاسی را قبل از ارسال بررسی می‌کنند
                </p>
              )}
            </section>

            {/* یادداشت مشتری */}
            <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-bold text-white">یادداشت برای سفارش</h2>
                <span className="text-xs text-gray-500">اختیاری</span>
              </div>
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="مثلاً: تیپ قطعه، رنگ، یا توضیح آدرس…"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white placeholder:text-gray-500 outline-none focus:border-brand-500"
              />
            </section>
          </div>

          {/* ستون خلاصه */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <CheckoutSummary items={items} shippingCost={shippingCost} />

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-brand-500 py-3 text-lg font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? "در حال انتقال به درگاه…" : "پرداخت و ثبت سفارش"}
            </button>
            <p className="text-center text-xs text-gray-500">
              با ثبت سفارش، موجودی اقلام تا ۱۵ دقیقه برای شما رزرو می‌شود
            </p>
          </aside>
        </form>
      )}
    </main>
  );
}
