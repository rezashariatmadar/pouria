"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api-client";

/** ساختار GET /vehicles/hierarchy. */
interface HierarchyTrim {
  id: number;
  name: string;
  slug: string;
}
interface HierarchyModel {
  id: number;
  name: string;
  slug: string;
  trims: HierarchyTrim[];
}
interface HierarchyMake {
  id: number;
  name: string;
  slug: string;
  models: HierarchyModel[];
}

/** ویجت سه‌مرحله‌ای انتخاب خودرو — برند → مدل → تیپ، لینک به کاتالوگ فیلترشده. */
export function VehicleSelector() {
  const router = useRouter();
  const [makes, setMakes] = useState<HierarchyMake[] | null>(null);
  const [error, setError] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");

  useEffect(() => {
    api
      .get("/vehicles/hierarchy")
      .then((data: HierarchyMake[]) => setMakes(data))
      .catch(() => setError(true));
  }, []);

  const models = useMemo(
    () => makes?.find((m) => m.slug === make)?.models ?? [],
    [makes, make]
  );
  const trims = useMemo(
    () => models.find((m) => m.slug === model)?.trims ?? [],
    [models, model]
  );

  function onMakeChange(v: string) {
    setMake(v);
    setModel("");
    setTrim("");
  }
  function onModelChange(v: string) {
    setModel(v);
    setTrim("");
  }

  /** رفتن به کاتالوگ با فیلترهای انتخاب‌شده (تا عمق انتخاب کاربر). */
  function go() {
    const params = new URLSearchParams();
    if (make) params.set("make", make);
    if (model) params.set("model", model);
    if (trim) params.set("trim", trim);
    router.push(`/catalog${params.size ? `?${params.toString()}` : ""}`);
  }

  const selectCls =
    "w-full cursor-pointer rounded-2xl border border-gray-300 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 shadow-xs outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40";

  return (
    <div className="rounded-3xl border border-gray-700/60 bg-white p-5 text-slate-800 shadow-2xl sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-500/30">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </span>
          <div>
            <div className="text-sm font-bold text-slate-900">
              انتخاب هوشمند خودرو (فیلتر قطعات ۱۰۰٪ سازگار)
            </div>
            <div className="text-[11px] text-slate-500">
              برای مشاهده فقط قطعات مناسب اتومبیل خود، ۳ مرحله زیر را انتخاب کنید
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800">
          خطا در دریافت لیست خودروها — لطفاً صفحه را دوباره بارگذاری کنید یا از کاتالوگ کامل
          استفاده کنید.
        </div>
      ) : !makes ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[62px] animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>۱. شرکت خودروساز</span>
              <span className="text-[10px] font-normal text-brand-600">مرحله اول</span>
            </label>
            <select value={make} onChange={(e) => onMakeChange(e.target.value)} className={selectCls}>
              <option value="">انتخاب کنید…</option>
              {makes.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>۲. مدل اتومبیل</span>
              <span className="text-[10px] font-normal text-brand-600">مرحله دوم</span>
            </label>
            <select
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={!make}
              className={`${selectCls} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <option value="">{make ? "انتخاب کنید…" : "ابتدا برند را انتخاب کنید"}</option>
              {models.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>۳. تیپ و موتور</span>
              <span className="text-[10px] font-normal text-brand-600">مرحله سوم</span>
            </label>
            <select
              value={trim}
              onChange={(e) => setTrim(e.target.value)}
              disabled={!model}
              className={`${selectCls} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <option value="">{model ? "همه تیپ‌ها" : "ابتدا مدل را انتخاب کنید"}</option>
              {trims.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
        <a
          href="/catalog"
          className="text-xs font-bold text-slate-500 underline transition hover:text-brand-600"
        >
          مشاهده کاتالوگ همه قطعات
        </a>
        <button
          onClick={go}
          disabled={!make}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-amber-500 px-7 py-3 text-xs font-extrabold text-white shadow-lg shadow-brand-500/30 transition hover:from-brand-700 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:text-sm"
        >
          <span>مشاهده و خرید قطعات سازگار</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
