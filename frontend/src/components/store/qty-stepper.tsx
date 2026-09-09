"use client";

/**
 * استپر تعداد: حداقل ۱، حداکثر min(موجودی، سقف سفارش) — با ارقام فارسی.
 */

import { faDigits } from "@/lib/format";

export function QtyStepper({
  qty,
  max,
  onChange,
}: {
  qty: number;
  max: number;
  onChange: (qty: number) => void;
}) {
  const canInc = qty < max;

  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200">
      <span className="text-xs font-bold text-gray-700">
        تعداد سفارش: <span className="text-[11px] font-normal text-gray-400">(حداکثر {faDigits(max)})</span>
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="افزایش تعداد"
          disabled={!canInc}
          onClick={() => onChange(qty + 1)}
          className="w-8 h-8 rounded-xl bg-white border border-gray-300 font-bold text-gray-800 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition shadow-2xs"
        >
          +
        </button>
        <span className="font-bold text-base text-gray-900 tabular-nums">{faDigits(qty)}</span>
        <button
          type="button"
          aria-label="کاهش تعداد"
          disabled={qty <= 1}
          onClick={() => onChange(qty - 1)}
          className="w-8 h-8 rounded-xl bg-white border border-gray-300 font-bold text-gray-800 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition shadow-2xs"
        >
          −
        </button>
      </div>
    </div>
  );
}
