"use client";

/**
 * اسکنر VIN/شاسی: ورودی + اعتبارسنجی نسبت به پلتفرم قطعه.
 * قرمز = نامعتبر، کهربایی = ناهم‌پلتفرم (با CTA ادامه — سرچک‌اوت VIN پرسیده می‌شود)، سبز = مطابق.
 */

import { useState } from "react";

import { TEST_VINS, validateVinForPlatform } from "@/lib/vin";

export function VinScanner({ platform }: { platform: "ikco" | "saipa" | null }) {
  const [vin, setVin] = useState("");
  const [result, setResult] = useState<ReturnType<typeof validateVinForPlatform> | null>(null);

  const verify = (value: string) => {
    const v = value.trim().toUpperCase();
    setVin(v);
    setResult(v ? validateVinForPlatform(v, platform) : null);
  };

  return (
    <div className="bg-gradient-to-l from-brand-50 via-amber-50 to-brand-50 border border-orange-300 rounded-2xl p-4 space-y-2.5 shadow-2xs">
      <div className="flex items-center justify-between text-xs font-extrabold text-orange-950">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-brand-500 text-white flex items-center justify-center shadow-2xs">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <span>استعلام آنلاین شاسی (پیشگیری از خرید اشتباه):</span>
        </div>
      </div>

      <p className="text-[11px] text-gray-600 leading-relaxed">
        شک دارید این قطعه دقیقاً به تیپ خودرویتان می‌خورد؟ شماره شاسی کارت ماشین را بنویسید
        تا سیستم به‌صورت خودکار سازگاری آن را تایید کند:
      </p>

      <div className="space-y-2">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={vin}
            onChange={(e) => verify(e.target.value)}
            placeholder="مثال: NAS411100P1452098"
            maxLength={17}
            spellCheck={false}
            dir="ltr"
            className="flex-1 bg-white border border-orange-300 rounded-xl px-3.5 py-2.5 text-xs font-mono placeholder:font-sans focus:ring-2 focus:ring-brand-500 outline-hidden uppercase shadow-inner"
          />
        </div>

        {/* دکمه‌های VIN آزمایشی */}
        <div className="flex flex-wrap gap-1.5">
          {TEST_VINS.map((t) => (
            <button
              key={t.vin}
              type="button"
              onClick={() => verify(t.vin)}
              title={t.vin}
              className="text-[10px] text-brand-600 font-bold hover:underline bg-white/70 border border-orange-200 px-2 py-1 rounded-lg transition"
            >
              {t.note}
            </button>
          ))}
        </div>

        {result && (
          <div
            className={`p-2.5 bg-white/90 rounded-xl border text-[11px] space-y-1.5 ${
              result.level === "invalid"
                ? "border-rose-300"
                : result.level === "mismatch"
                  ? "border-amber-300"
                  : "border-emerald-300"
            }`}
          >
            <div
              className={`font-bold flex items-center gap-1 ${
                result.level === "invalid"
                  ? "text-rose-700"
                  : result.level === "mismatch"
                    ? "text-amber-700"
                    : "text-emerald-700"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  result.level === "invalid"
                    ? "bg-rose-500"
                    : result.level === "mismatch"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
              />
              {result.level === "invalid"
                ? "✕ فرمت شماره شاسی نامعتبر است"
                : result.level === "mismatch"
                  ? "⚠ عدم تطابق پلتفرم"
                  : "✓ سازگار و تایید شد"}
            </div>
            <div className="text-[10px] text-gray-600 leading-relaxed">
              {result.message}
              {result.level === "mismatch" && (
                <span className="block mt-1 text-amber-700">
                  می‌توانید خرید را ادامه دهید — شماره شاسی در مرحله پرداخت از شما پرسیده می‌شود و
                  قبل از ارسال، کارشناس ما تطابق را تایید می‌کند.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
