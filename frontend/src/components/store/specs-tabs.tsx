"use client";

/**
 * تب‌های مشخصات: توضیحات / مشخصات / سازگاری (گروه‌بندی خودروساز → مدل) / ارسال و ضمانت.
 */

import { useState } from "react";

export interface CompatibilityEntry {
  make: string;
  model: string;
  trims: string[];
}

type TabKey = "description" | "specs" | "compat" | "shipping";

const TABS: { key: TabKey; label: string }[] = [
  { key: "description", label: "توضیحات" },
  { key: "specs", label: "مشخصات" },
  { key: "compat", label: "سازگاری" },
  { key: "shipping", label: "ارسال و ضمانت" },
];

export function SpecsTabs({
  title,
  description,
  brand,
  category,
  partNumber,
  isacoCode,
  isGenuine,
  warrantyText,
  compatibility,
}: {
  title: string;
  description: string;
  brand: string;
  category: string;
  partNumber: string;
  isacoCode: string;
  isGenuine: boolean;
  warrantyText: string;
  compatibility: CompatibilityEntry[];
}) {
  const [tab, setTab] = useState<TabKey>("description");

  // سازگاری: خودروساز → مدل → تیپ‌ها
  const grouped = compatibility.reduce<Record<string, Record<string, string[]>>>((acc, c) => {
    (acc[c.make] ??= {})[c.model] = c.trims;
    return acc;
  }, {});

  const specs: [string, string][] = [
    ["برند تولیدکننده", brand || "—"],
    ["دسته‌بندی", category],
    ["کد فنی قطعه", partNumber || "—"],
    ["کد ایساکو", isacoCode || "—"],
    ["وضعیت اصالت", isGenuine ? "اصلی (فابریک/OEM)" : "باکیفیت (بازار جانبی)"],
    ["گارانتی", warrantyText || "ضمانت اصالت و سلامت فیزیکی"],
  ];

  return (
    <div className="bg-white rounded-3xl border border-gray-200/90 p-6 shadow-xs space-y-5">
      <div className="flex border-b border-gray-200 gap-4 sm:gap-6 text-xs font-bold overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`pb-3 whitespace-nowrap transition ${
              tab === t.key
                ? "text-brand-600 border-b-2 border-brand-600"
                : "text-gray-400 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "description" && (
        <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
          {description || `توضیحات فنی برای «${title}» به‌زودی تکمیل می‌شود.`}
        </div>
      )}

      {tab === "specs" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          {specs.map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-100"
            >
              <span className="text-gray-500 shrink-0">{k}:</span>
              <span className="font-extrabold text-gray-900 text-left">{v}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "compat" && (
        <div className="text-xs text-gray-600 space-y-4">
          {Object.keys(grouped).length === 0 && (
            <p>اطلاعات سازگاری برای این قطعه ثبت نشده است — برای اطمینان با ما تماس بگیرید.</p>
          )}
          {Object.entries(grouped).map(([make, models]) => (
            <div key={make} className="space-y-2">
              <div className="font-black text-gray-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                {make}
              </div>
              <div className="space-y-2 pr-4">
                {Object.entries(models).map(([model, trims]) => (
                  <div
                    key={model}
                    className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-1.5"
                  >
                    <div className="font-bold text-gray-800">{model}</div>
                    <div className="text-[11px] text-gray-500 leading-relaxed">
                      {trims.length > 0 ? `تیپ‌های سازگار: ${trims.join("، ")}` : "تمامی تیپ‌ها"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "shipping" && (
        <div className="text-xs text-gray-600 space-y-3 leading-relaxed">
          {warrantyText && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1 text-emerald-900">
              <strong className="text-xs">گارانتی:</strong>
              <p className="text-[11px] text-emerald-700">{warrantyText}</p>
            </div>
          )}
          <div className="p-4 bg-brand-50/60 border border-orange-200 rounded-2xl space-y-1 text-orange-950">
            <strong className="text-xs">تحویل اکسپرس تهران (۱ تا ۲ ساعته):</strong>
            <p className="text-[11px] text-orange-800">
              ارسال مستقیم از انبار با پیک موتوری و بسته‌بندی حباب‌پیچ ضدضربه.
            </p>
          </div>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-1">
            <strong className="text-xs text-gray-900">ارسال به سراسر کشور:</strong>
            <p className="text-[11px] text-gray-600">
              بسته‌بندی کارتن دوجداره با ضربه‌گیر؛ ارسال روزانه با تیپاکس (تحویل ۲۴ ساعته) یا
              باربری ترمینال.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
              <strong className="text-[11px] text-gray-900 block mb-0.5">پست پیشتاز</strong>
              <span className="text-[11px] text-gray-500">تحویل ۲ تا ۴ روز کاری به سراسر ایران</span>
            </div>
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
              <strong className="text-[11px] text-gray-900 block mb-0.5">تحویل حضوری</strong>
              <span className="text-[11px] text-gray-500">
                دریافت از انبار تهران با هماهنگی تلفنی قبلی
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
