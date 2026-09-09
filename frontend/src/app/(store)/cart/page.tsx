"use client";

/**
 * سبد خرید — آیتم‌ها با قیمت‌های «نمایشی»، استپر تعداد (سقف موجودی)،
 * حذف آیتم و ادامه به تسویه. قیمت‌ها هرگز از کلاینت اعتماد نمی‌شوند.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { CheckoutSummary } from "@/components/store/checkout-summary";
import { useCart } from "@/stores/cart";

export default function CartPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  // بعد از هیدرییت persist رندر کن تا فلکر SSR/CSR نداشته باشیم
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10">
        <p className="p-8 text-center text-gray-400">در حال بارگذاری…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/catalog" className="text-sm text-gray-400 hover:text-gray-200">
          ← فروشگاه
        </Link>
        <h1 className="text-2xl font-bold text-white">سبد خرید</h1>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center">
          <div className="mb-3 text-4xl">🛒</div>
          <h2 className="text-lg font-bold text-white">سبد خرید شما خالی است</h2>
          <p className="mt-1 text-sm text-gray-400">
            قطعات مورد نیاز خودروی خود را از فروشگاه انتخاب کنید
          </p>
          <Link
            href="/catalog"
            className="mt-5 inline-block rounded-lg bg-brand-500 px-6 py-2.5 font-bold text-white transition hover:bg-brand-600"
          >
            رفتن به فروشگاه
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <CheckoutSummary
            items={items}
            onSetQty={(it, qty) => setQty(it.product_id, it.variant_id, qty)}
            onRemove={(it) => remove(it.product_id, it.variant_id)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/catalog" className="text-sm text-gray-400 hover:text-gray-200">
              + افزودن قطعه بیشتر
            </Link>
            <Link
              href="/checkout"
              className="rounded-lg bg-brand-500 px-8 py-3 font-bold text-white transition hover:bg-brand-600"
            >
              ادامه فرآیند خرید
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
