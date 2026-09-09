"use client";

import { useMemo, useState } from "react";

import { TEST_VINS, validateVin, validateVinForPlatform } from "@/lib/vin";

type Platform = "ikco" | "saipa" | null;

const STATE_STYLES = {
  invalid: {
    box: "border-rose-700/60 bg-rose-950/40",
    badge: "border border-rose-700/60 bg-rose-950/70 text-rose-300",
    dot: "bg-rose-400",
    label: "قالب شماره شاسی نامعتبر است",
  },
  mismatch: {
    box: "border-amber-700/60 bg-amber-950/40",
    badge: "border border-amber-700/60 bg-amber-950/70 text-amber-300",
    dot: "bg-amber-400",
    label: "شاسی با پلتفرم انتخابی هم‌خوانی ندارد",
  },
  match: {
    box: "border-emerald-700/60 bg-emerald-950/40",
    badge: "border border-emerald-700/60 bg-emerald-950/70 text-emerald-300",
    dot: "bg-emerald-400",
    label: "شماره شاسی معتبر و تایید شد",
  },
} as const;

/** دیکدر VIN — سه حالت بصری: نامعتبر (قرمز) / ناهم‌پلتفرم (کهربایی) / مطابق (سبز). */
export function VinDecoder() {
  const [vin, setVin] = useState("");
  const [platform, setPlatform] = useState<Platform>(null);

  const result = useMemo(() => {
    if (!vin.trim()) return null;
    return platform
      ? validateVinForPlatform(vin, platform)
      : validateVin(vin);
  }, [vin, platform]);

  const style = result ? STATE_STYLES[result.level] : null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
      <div className="space-y-4 lg:col-span-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-800/60 bg-emerald-950/50 px-3 py-1 text-xs font-bold text-emerald-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span>نوآوری اختصاصی یدک‌پرو | بدون ۱ مورد مرجوعی</span>
        </div>
        <h2 className="text-xl font-black leading-tight text-white sm:text-2xl">
          سامانه هوشمند رمزگشایی شماره شاسی (VIN Decoder)
        </h2>
        <p className="text-xs leading-relaxed text-gray-400 sm:text-sm">
          در بازار خودروی ایران، دو پژو ۲۰۶ هم‌مدل ممکن است قطعات موتوری و برقی متفاوتی (فرانسه،
          کروز یا بوش) داشته باشند! شماره شاسی ماشینتان را وارد کنید تا پلتفرم آن شناسایی و
          تطابق قطعه قبل از خرید بررسی شود.
        </p>

        <div className="space-y-1.5 pt-2">
          <div className="text-[11px] font-bold text-gray-500">
            با دکمه‌های زیر می‌توانید اعتبارسنجی را تست کنید:
          </div>
          <div className="flex flex-wrap gap-2">
            {TEST_VINS.map((t) => (
              <button
                key={t.vin}
                onClick={() => setVin(t.vin)}
                className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:border-brand-500/50 hover:text-brand-500"
              >
                {t.note}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-gray-800 bg-gradient-to-tr from-gray-900 via-gray-950 to-gray-900 p-6 shadow-2xl sm:p-7 lg:col-span-7">
        <div className="mb-5 flex items-center gap-3 border-b border-gray-800 pb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-600/20 text-brand-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </span>
          <div>
            <div className="text-xs font-extrabold text-white">شناسنامه فنی وسیله نقلیه (کارت خودرو)</div>
            <div className="text-[10px] text-gray-500">
              سیستم انطباق قطعات با دیتابیس ایران‌خودرو و سایپا
            </div>
          </div>
        </div>

        <div className="mb-4 space-y-3">
          <label className="block text-xs font-bold text-gray-300">
            شماره شناسایی ۱۷ رقمی خودرو (VIN):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="مثال: NAS411100P1452098"
              maxLength={17}
              dir="ltr"
              className="flex-1 rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 font-mono text-xs tracking-widest text-amber-400 shadow-inner outline-none placeholder:text-gray-600 focus:ring-2 focus:ring-brand-500/50 sm:text-sm"
            />
            <select
              value={platform ?? ""}
              onChange={(e) => setPlatform((e.target.value || null) as Platform)}
              className="shrink-0 cursor-pointer rounded-2xl border border-gray-700 bg-gray-900 px-3 py-3 text-xs font-bold text-gray-300 outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="">بدون مقایسه</option>
              <option value="ikco">قطعه ایران‌خودرو</option>
              <option value="saipa">قطعه سایپا</option>
            </select>
          </div>
        </div>

        <div className="min-h-[92px] space-y-3 rounded-2xl border border-gray-800 bg-gray-900/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-gray-500">نتیجه کدگشایی شاسی:</span>
            {style && result ? (
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${style.badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                <span>{style.label}</span>
              </span>
            ) : (
              <span className="text-[11px] text-gray-600">در انتظار ورود شماره شاسی…</span>
            )}
          </div>

          {result && style && (
            <div className={`space-y-3 rounded-xl border p-3 ${style.box}`}>
              <p className="text-xs font-semibold leading-relaxed text-gray-200">
                {result.message}
              </p>
              {result.ok && (
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-lg border border-gray-700 bg-gray-950/80 px-2.5 py-1 font-medium text-gray-300">
                    پلتفرم شناسایی‌شده: {result.make === "ikco" ? "ایران‌خودرو" : "سایپا"}
                  </span>
                  <a
                    href={`/catalog?make=${result.make === "ikco" ? "ikco" : "saipa"}`}
                    className="rounded-lg border border-emerald-800/60 bg-emerald-950/60 px-2.5 py-1 font-bold text-emerald-300 transition hover:bg-emerald-900/60"
                  >
                    مشاهده قطعات سازگار این پلتفرم ←
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
