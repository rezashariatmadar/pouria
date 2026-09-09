"use client";

/**
 * انتخاب تنوع (راست/چپ/جفت): هر دکمه قیمت و موجودی خودش را نشان می‌دهد؛
 * تنوع ناموجود غیرفعال است. انتخاب، قیمت/سقف تعداد/افزودن به سبد را به‌روز می‌کند.
 */

import { faDigits } from "@/lib/format";

export interface VariantInfo {
  id: number;
  name: string;
  price: number;
  stock: number;
  is_default: boolean;
}

export function VariantPicker({
  variants,
  selectedId,
  onSelect,
}: {
  variants: VariantInfo[];
  selectedId: number | null;
  onSelect: (v: VariantInfo) => void;
}) {
  if (variants.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-800">جهت مورد نیاز را انتخاب کنید: *</label>
        <span className="text-[11px] text-gray-400">قیمت بر اساس جهت</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {variants.map((v) => {
          const isSelected = v.id === selectedId;
          const outOfStock = v.stock <= 0;
          return (
            <button
              key={v.id}
              type="button"
              disabled={outOfStock}
              onClick={() => onSelect(v)}
              className={`p-3 rounded-2xl text-xs text-center transition ${
                isSelected
                  ? "border-2 border-brand-500 bg-brand-50/60 font-extrabold text-orange-950 shadow-2xs"
                  : outOfStock
                    ? "border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "border border-gray-200 bg-white font-bold text-gray-700 hover:border-gray-400"
              }`}
            >
              <div>{v.name}</div>
              <div
                className={`text-[10px] mt-0.5 font-normal ${
                  outOfStock ? "text-rose-400" : isSelected ? "text-gray-500" : "text-gray-400"
                }`}
              >
                {outOfStock
                  ? "ناموجود"
                  : `${faDigits(v.price)} تومان • موجودی: ${faDigits(v.stock)}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
