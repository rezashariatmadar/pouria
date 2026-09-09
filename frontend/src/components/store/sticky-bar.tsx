"use client";

/**
 * نوار چسبان موبایل: قیمت + دکمه خرید سریع؛ بعد از رد شدن از هیرو ظاهر می‌شود.
 */

import { useEffect, useState } from "react";

import { toman } from "@/lib/format";

export function StickyBar({
  price,
  qty,
  onAdd,
  visible,
}: {
  price: number;
  qty: number;
  onAdd: () => void;
  visible: boolean;
}) {
  // نمایان بودن با اسکرول کنترل می‌شود؛ این استیت برای محو تدریجی است.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div
      className={`sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-3 z-40 flex items-center justify-between gap-3 shadow-2xl transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="shrink-0">
        <div className="text-[10px] text-gray-400">قیمت روز ({qty > 1 ? `${qty} عدد` : "واحد"}):</div>
        <div className="text-sm font-black text-gray-900">{toman(price * qty)}</div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex-1 py-2.5 bg-brand-500 active:bg-brand-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/30"
      >
        <span>خرید سریع</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </button>
    </div>
  );
}
