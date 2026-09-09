"use client";

/**
 * نتیجه پرداخت — ?order&status: POST /checkout/verify-payment {order_number}
 * موفق: شماره سفارش YK-…، متن موفقیت، راهنمای پیگیری + خالی‌کردن سبد.
 * ناموفق: موجودی تا ۱۵ دقیقه رزرو می‌ماند + لینک تلاش مجدد.
 */

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { api } from "@/lib/api-client";
import { toman } from "@/lib/format";
import { useCart } from "@/stores/cart";

type Phase = "loading" | "success" | "failure" | "error";

function ResultInner() {
  const params = useSearchParams();
  const orderNumber = params.get("order") ?? "";
  // status پارامتر راهنماست — منبع حقیقت پاسخ verify-payment سرور است
  const statusHint = params.get("status");

  const [phase, setPhase] = useState<Phase>("loading");
  const [total, setTotal] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clearCart = useCart((s) => s.clear);
  const cartCleared = useRef(false);

  const verify = useCallback(async () => {
    if (!orderNumber) {
      setPhase("error");
      setMessage("شماره سفارش در آدرس موجود نیست");
      return;
    }
    try {
      // دقیقاً مطابق VerifyPaymentIn بک‌اند: {order_number, track_id}
      // مسیر JWT-دار است → توکن مشتری از sessionStorage (lib/customer-session)
      const trackId = params.get("track_id") ?? "";
      const res = await api.post(
        "/checkout/verify-payment",
        { order_number: orderNumber, track_id: trackId },
        "customer"
      );
      const paid = Boolean(res?.paid ?? res?.success ?? res?.status === "paid");
      setTotal(typeof res?.total_amount === "number" ? res.total_amount : null);
      if (paid) {
        // فقط روی تایید قطعی سرور سبد را خالی کن — یک‌بار
        if (!cartCleared.current) {
          cartCleared.current = true;
          clearCart();
        }
        setPhase("success");
      } else {
        setPhase("failure");
      }
    } catch (e: any) {
      // اگر سرور گفت ناموفق (مثلاً 400) همان حالت شکست است
      const msg = e?.message ?? "";
      if (String(e?.status) === "400" || /ناموفق|failed|cancel/i.test(msg)) {
        setPhase("failure");
      } else {
        setPhase("error");
        setMessage(msg || "خطا در تایید پرداخت");
      }
    }
  }, [orderNumber, clearCart]);

  useEffect(() => {
    verify();
  }, [verify]);

  const card = (children: React.ReactNode) => (
    <div className="w-full max-w-md space-y-5 rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center shadow-xl">
      {children}
    </div>
  );

  if (phase === "loading") {
    return <p className="text-gray-400">در حال تایید پرداخت…</p>;
  }

  if (phase === "success") {
    return card(
      <>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
          ✅
        </div>
        <h1 className="text-xl font-bold text-white">پرداخت با موفقیت انجام شد</h1>
        <div className="rounded-xl bg-gray-800/50 p-4">
          <div className="text-xs text-gray-400">شماره سفارش شما</div>
          <div className="mt-1 font-mono text-lg font-bold text-white" dir="ltr">
            {orderNumber}
          </div>
          {total != null && (
            <div className="mt-2 text-sm text-gray-300" dir="ltr">{toman(total)}</div>
          )}
        </div>
        <p className="text-sm leading-7 text-gray-400">
          سفارش شما ثبت شد و کارشناسان یدک‌پرو قطعات را برای ارسال آماده می‌کنند.
          برای پیگیری سفارش، شماره سفارش بالا را نزد خود نگه دارید و با پشتیبانی تماس بگیرید.
          وضعیت سفارش از طریق همین شماره قابل استعلام است.
        </p>
        <div className="flex gap-3">
          <Link
            href="/catalog"
            className="flex-1 rounded-lg bg-brand-500 py-2.5 font-bold text-white transition hover:bg-brand-600"
          >
            ادامه خرید
          </Link>
          <Link
            href="/"
            className="flex-1 rounded-lg border border-gray-700 py-2.5 font-bold text-gray-200 transition hover:border-brand-500"
          >
            صفحه اصلی
          </Link>
        </div>
      </>
    );
  }

  if (phase === "failure") {
    return card(
      <>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-3xl">
          ❌
        </div>
        <h1 className="text-xl font-bold text-white">پرداخت ناموفق</h1>
        <p className="text-sm leading-7 text-gray-400">
          پرداخت انجام نشد، اما نگران نباشید — موجودی اقلام شما تا ۱۵ دقیقه رزرو می‌ماند.
          دوباره تلاش کنید.
          {statusHint === "expired" && " مهلت رزرو به پایان رسیده و ممکن است سبد نیاز به بازسازی داشته باشد."}
        </p>
        <div className="flex gap-3">
          <Link
            href="/checkout"
            className="flex-1 rounded-lg bg-brand-500 py-2.5 font-bold text-white transition hover:bg-brand-600"
          >
            تلاش مجدد پرداخت
          </Link>
          <Link
            href="/cart"
            className="flex-1 rounded-lg border border-gray-700 py-2.5 font-bold text-gray-200 transition hover:border-brand-500"
          >
            سبد خرید
          </Link>
        </div>
      </>
    );
  }

  // phase === "error"
  return card(
    <>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-3xl">
        ⚠️
      </div>
      <h1 className="text-xl font-bold text-white">خطا در تایید پرداخت</h1>
      <p className="text-sm text-gray-400">{message ?? "ارتباط با سرور برقرار نشد"}</p>
      <button
        onClick={verify}
        className="rounded-lg bg-brand-500 px-8 py-2.5 font-bold text-white transition hover:bg-brand-600"
      >
        تلاش مجدد
      </button>
    </>
  );
}

export default function CheckoutResultPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Suspense fallback={<p className="text-gray-400">در حال بارگذاری…</p>}>
        <ResultInner />
      </Suspense>
    </main>
  );
}
