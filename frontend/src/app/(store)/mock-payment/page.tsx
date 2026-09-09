"use client";

/**
 * درگاه پرداخت آزمایشی (PAYMENT_PROVIDER=mock) — ?track_id&order&amount.
 * دکمه موفق/ناموفق → POST /checkout/mock-pay → نتیجه در /checkout/result.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "@/lib/api-client";
import { toman } from "@/lib/format";

function MockPaymentInner() {
  const router = useRouter();
  const params = useSearchParams();
  const trackId = params.get("track_id") ?? "";
  const order = params.get("order") ?? "";
  const amount = Number(params.get("amount") ?? 0);

  const [busy, setBusy] = useState<null | "success" | "fail">(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  async function pay(success: boolean) {
    if (busy || !trackId) return;
    setBusy(success ? "success" : "fail");
    setError(null);
    try {
      await api.post("/checkout/mock-pay", { track_id: trackId, success });
      router.push(
        `/checkout/result?order=${encodeURIComponent(order)}&track_id=${encodeURIComponent(trackId)}`
      );
    } catch (e: any) {
      setError(e?.message ?? "خطا در پرداخت — دوباره تلاش کنید");
      setBusy(null);
    }
  }

  if (ready && (!trackId || !order)) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center">
        <h1 className="text-lg font-bold text-white">پارامترهای پرداخت ناقص است</h1>
        <a href="/cart" className="mt-4 inline-block text-sm text-brand-400 hover:text-brand-300">
          بازگشت به سبد خرید
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/15 text-2xl">
          💳
        </div>
        <h1 className="text-xl font-bold text-white">درگاه پرداخت آزمایشی</h1>
        <p className="mt-1 text-sm text-gray-400">این درگاه فقط برای تست است — پول واقعی حرکت نمی‌کند</p>
      </div>

      <div className="space-y-2 rounded-xl bg-gray-800/50 p-4 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>شماره سفارش</span>
          <span className="font-mono text-gray-200" dir="ltr">{order}</span>
        </div>
        {amount > 0 && (
          <div className="flex justify-between text-gray-400">
            <span>مبلغ</span>
            <span className="font-bold text-white" dir="ltr">{toman(amount)}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-400">
          <span>کد پیگیری</span>
          <span className="font-mono text-xs text-gray-300" dir="ltr">{trackId}</span>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => pay(true)}
          disabled={busy !== null}
          className="rounded-lg bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy === "success" ? "در حال پردازش…" : "پرداخت موفق"}
        </button>
        <button
          onClick={() => pay(false)}
          disabled={busy !== null}
          className="rounded-lg border border-red-500/50 py-3 font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
        >
          {busy === "fail" ? "در حال پردازش…" : "پرداخت ناموفق"}
        </button>
      </div>
    </div>
  );
}

export default function MockPaymentPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Suspense
        fallback={<p className="text-gray-400">در حال بارگذاری درگاه…</p>}
      >
        <MockPaymentInner />
      </Suspense>
    </main>
  );
}
