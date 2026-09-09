"use client";

/**
 * خلاصه سفارش مشترک بین سبد خرید و صفحه تسویه — اقلام + جمع اقلام + هزینه ارسال + مبلغ کل.
 * قیمت‌ها صرفاً نمایشی هستند؛ مبلغ نهایی همیشه هنگام پرداخت سمت سرور محاسبه می‌شود.
 */

import type { CartItem } from "@/stores/cart";
import { faDigits, toman } from "@/lib/format";

interface CheckoutSummaryProps {
  items: CartItem[];
  /** هزینه ارسال (تومان) — null یعنی هنوز انتخاب نشده و سطرش نشان داده نمی‌شود */
  shippingCost?: number | null;
  /** در سبد خرید فعال است؛ در تسویه فقط خواندنی است */
  onSetQty?: (item: CartItem, qty: number) => void;
  onRemove?: (item: CartItem) => void;
}

export function CheckoutSummary({
  items,
  shippingCost = null,
  onSetQty,
  onRemove,
}: CheckoutSummaryProps) {
  const subtotal = items.reduce((sum, it) => sum + (it.display?.price ?? 0) * it.qty, 0);
  const showShipping = shippingCost != null;
  const total = subtotal + (showShipping ? shippingCost : 0);

  return (
    <div className="space-y-4">
      {/* اقلام */}
      <ul className="divide-y divide-gray-800 rounded-2xl border border-gray-800 bg-gray-900">
        {items.map((it) => (
          <li
            key={`${it.product_id}-${it.variant_id}`}
            className="flex flex-wrap items-center gap-3 p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-gray-100">
                {it.display?.title ?? `قطعه ${faDigits(it.product_id)}`}
              </div>
              {it.display?.variant_name && (
                <span className="mt-1 inline-block rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                  {it.display.variant_name}
                </span>
              )}
              {it.display ? (
                <div className="mt-1 text-xs text-gray-500" dir="ltr">
                  {toman(it.display.price)}
                </div>
              ) : (
                <div className="mt-1 text-xs text-amber-400">
                  قیمت هنگام پرداخت مشخص می‌شود
                </div>
              )}
            </div>

            {onSetQty ? (
              <div className="flex items-center rounded-lg border border-gray-700 bg-gray-800">
                <button
                  type="button"
                  onClick={() => onSetQty(it, it.qty - 1)}
                  aria-label="کاهش تعداد"
                  className="h-8 w-8 text-lg text-gray-300 hover:text-white"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-bold text-white">
                  {faDigits(it.qty)}
                </span>
                <button
                  type="button"
                  onClick={() => onSetQty(it, Math.min(it.qty + 1, it.display?.max_qty ?? 99))}
                  disabled={it.qty >= (it.display?.max_qty ?? 99)}
                  aria-label="افزایش تعداد"
                  className="h-8 w-8 text-lg text-gray-300 hover:text-white disabled:cursor-not-allowed disabled:text-gray-600"
                >
                  +
                </button>
              </div>
            ) : (
              <span className="text-sm text-gray-400">{faDigits(it.qty)} عدد</span>
            )}

            <div className="w-28 text-end font-bold text-white" dir="ltr">
              {it.display ? toman(it.display.price * it.qty) : "—"}
            </div>

            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(it)}
                aria-label="حذف از سبد"
                className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
              >
                🗑
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* جمع‌ها */}
      <div className="space-y-2 rounded-2xl border border-gray-800 bg-gray-900 p-4 text-sm">
        <div className="flex items-center justify-between text-gray-300">
          <span>جمع اقلام</span>
          <span dir="ltr">{toman(subtotal)}</span>
        </div>
        {showShipping && (
          <div className="flex items-center justify-between text-gray-300">
            <span>هزینه ارسال</span>
            <span dir="ltr">{shippingCost === 0 ? "رایگان" : toman(shippingCost)}</span>
          </div>
        )}
        {showShipping && (
          <div className="flex items-center justify-between border-t border-gray-800 pt-2 text-base font-bold text-white">
            <span>مبلغ کل</span>
            <span dir="ltr">{toman(total)}</span>
          </div>
        )}
        <p className="pt-1 text-xs text-gray-500">
          قیمت‌ها هنگام پرداخت نهایی محاسبه می‌شوند
        </p>
      </div>
    </div>
  );
}
