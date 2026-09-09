"use client";

/**
 * فرم قطعه: هم برای ساخت و هم ویرایش.
 * تاگل «این قطعه تنوع دارد» بین قیمت واحدی ↔ ردیف‌های راست/چپ/جفت جابه‌جا می‌کند.
 * سازگاری: انتخاب مدل (همه تیپ‌ها) — تیپ خاص در v2.
 */

import { useEffect, useState, type FormEvent } from "react";

import { api } from "@/lib/api-client";
import { faDigits } from "@/lib/format";

export interface VariantDraft {
  id?: number;
  name: string;
  sku_modifier: string;
  price_override: number | null;
  stock: number;
  is_default: boolean;
}

export interface ProductDraft {
  title: string;
  brand: string;
  category_slug: string;
  part_number: string;
  isaco_code: string;
  price: number;
  stock: number;
  is_call_for_price: boolean;
  max_order_quantity: number;
  low_stock_threshold: number;
  warranty_text: string;
  is_genuine: boolean;
  description: string;
  model_slugs: string[];
  variants: VariantDraft[];
}

const EMPTY: ProductDraft = {
  title: "",
  brand: "",
  category_slug: "",
  part_number: "",
  isaco_code: "",
  price: 0,
  stock: 0,
  is_call_for_price: false,
  max_order_quantity: 5,
  low_stock_threshold: 2,
  warranty_text: "ضمانت اصالت و سلامت فیزیکی",
  is_genuine: true,
  description: "",
  model_slugs: [],
  variants: [],
};

interface CategoryInfo {
  slug: string;
  name: string;
}
interface ModelInfo {
  slug: string;
  name: string;
  make_name: string;
}

const DEFAULT_VARIANTS: VariantDraft[] = [
  { name: "سمت راست", sku_modifier: "R", price_override: null, stock: 0, is_default: true },
  { name: "سمت چپ", sku_modifier: "L", price_override: null, stock: 0, is_default: false },
  { name: "جفت (راست + چپ)", sku_modifier: "PAIR", price_override: null, stock: 0, is_default: false },
];

export function ProductForm({ productId, initial }: { productId?: number; initial?: Partial<ProductDraft> }) {
  const [draft, setDraft] = useState<ProductDraft>({ ...EMPTY, ...initial });
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [hasVariants, setHasVariants] = useState((initial?.variants?.length ?? 0) > 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/catalog/categories").then((cats: any) => setCategories(cats)).catch(() => {});
    api.get("/vehicles/hierarchy").then((h: any) => {
      const m: ModelInfo[] = [];
      for (const make of h) for (const model of make.models) m.push({ slug: model.slug, name: model.name, make_name: make.name });
      setModels(m);
    }).catch(() => {});
  }, []);

  function set<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function toggleModel(slug: string) {
    set("model_slugs", draft.model_slugs.includes(slug)
      ? draft.model_slugs.filter((s) => s !== slug)
      : [...draft.model_slugs, slug]);
  }

  function setVariant(i: number, patch: Partial<VariantDraft>) {
    setDraft((d) => {
      const variants = d.variants.map((v, j) => (j === i ? { ...v, ...patch } : v));
      return { ...d, variants };
    });
    setSaved(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.category_slug) return setError("دسته‌بندی را انتخاب کنید");
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...draft,
        // قیمت و موجودی سطح قطعه وقتی تنوع داریم فقط در تنوع‌ها معنا دارد —
        // در سمت بک‌اند تنوع‌ها مرجع موجودی‌اند.
        variants: hasVariants ? draft.variants : [],
      };
      const res = productId
        ? await api.patch(`/admin/products/${productId}`, payload, true)
        : await api.post("/admin/products", payload, true);
      setSaved(true);
      if (!productId) {
        window.location.href = `/admin/products/${res.id}`;
      }
    } catch (err: any) {
      setError(err?.message ?? "خطا در ذخیره");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-brand-500 focus:outline-none";
  const labelCls = "block space-y-1.5";
  const spanCls = "text-sm text-gray-300";

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          <span className={spanCls}>عنوان قطعه *</span>
          <input value={draft.title} onChange={(e) => set("title", e.target.value)} required className={inputCls} />
        </label>
        <label className={labelCls}>
          <span className={spanCls}>برند (هر برند یک قطعه جدا) *</span>
          <input value={draft.brand} onChange={(e) => set("brand", e.target.value)} required className={inputCls} />
        </label>
        <label className={labelCls}>
          <span className={spanCls}>دسته‌بندی *</span>
          <select value={draft.category_slug} onChange={(e) => set("category_slug", e.target.value)} required className={inputCls}>
            <option value="">انتخاب کنید…</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className={labelCls}>
            <span className={spanCls}>شماره فنی</span>
            <input value={draft.part_number} onChange={(e) => set("part_number", e.target.value)} dir="ltr" className={inputCls} />
          </label>
          <label className={labelCls}>
            <span className={spanCls}>کد ایساکو</span>
            <input value={draft.isaco_code} onChange={(e) => set("isaco_code", e.target.value)} dir="ltr" className={inputCls} />
          </label>
        </div>
      </div>

      <fieldset className="rounded-xl border border-gray-800 p-4">
        <legend className="px-1 text-sm font-bold text-gray-200">قیمت و موجودی</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={labelCls}>
            <span className={spanCls}>قیمت پایه (تومان)</span>
            <input
              inputMode="numeric"
              value={draft.price || ""}
              onChange={(e) => set("price", Number(e.target.value.replace(/\D/g, "")) || 0)}
              disabled={draft.is_call_for_price || hasVariants}
              dir="ltr"
              className={`${inputCls} disabled:opacity-40`}
            />
          </label>
          <label className={labelCls}>
            <span className={spanCls}>{hasVariants ? "موجودی (نادیده)" : "موجودی"}</span>
            <input
              inputMode="numeric"
              value={draft.stock || ""}
              onChange={(e) => set("stock", Number(e.target.value.replace(/\D/g, "")) || 0)}
              disabled={hasVariants}
              dir="ltr"
              className={`${inputCls} disabled:opacity-40`}
            />
          </label>
          <label className={`${labelCls} flex flex-col justify-end pb-2`}>
            <span className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={draft.is_call_for_price}
                onChange={(e) => set("is_call_for_price", e.target.checked)}
                className="h-4 w-4 accent-brand-500"
              />
              تماس بگیرید (بدون قیمت)
            </span>
          </label>
        </div>
        {draft.is_call_for_price && (
          <p className="mt-2 text-xs text-amber-400">قطعه «تماس بگیرید» در فروشگاه قیمت نشان نمی‌دهد.</p>
        )}
      </fieldset>

      {/* تنوع‌ها */}
      <fieldset className="rounded-xl border border-gray-800 p-4">
        <legend className="px-1 text-sm font-bold text-gray-200">تنوع‌ها (راست / چپ / جفت)</legend>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={hasVariants}
            onChange={(e) => {
              const on = e.target.checked;
              setHasVariants(on);
              if (on && draft.variants.length === 0) set("variants", DEFAULT_VARIANTS);
              if (!on) set("variants", []);
            }}
            className="h-4 w-4 accent-brand-500"
          />
          این قطعه تنوع دارد (مثل چراغ چپ/راست)
        </label>

        {hasVariants && (
          <div className="mt-3 space-y-2">
            {draft.variants.map((v, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_2rem] items-center gap-2">
                <input
                  value={v.name}
                  onChange={(e) => setVariant(i, { name: e.target.value })}
                  placeholder="نام تنوع"
                  className={inputCls}
                />
                <input
                  value={v.sku_modifier}
                  onChange={(e) => setVariant(i, { sku_modifier: e.target.value })}
                  placeholder="کد"
                  dir="ltr"
                  className={inputCls}
                />
                <input
                  inputMode="numeric"
                  value={v.price_override ?? ""}
                  onChange={(e) =>
                    setVariant(i, {
                      price_override: e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")) || 0,
                    })
                  }
                  placeholder={`بدون قیمت → ${draft.price ? faDigits(draft.price) : "قیمت پایه"}`}
                  dir="ltr"
                  className={inputCls}
                />
                <input
                  inputMode="numeric"
                  value={v.stock || ""}
                  onChange={(e) => setVariant(i, { stock: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                  placeholder="موجودی"
                  dir="ltr"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => set("variants", draft.variants.filter((_, j) => j !== i))}
                  className="rounded-lg border border-gray-700 px-2 py-2 text-red-400 hover:border-red-500/50"
                  title="حذف تنوع"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set("variants", [...draft.variants, { id: undefined, name: "", sku_modifier: "", price_override: null, stock: 0, is_default: false }])}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-brand-500"
            >
              + افزودن تنوع
            </button>
          </div>
        )}
      </fieldset>

      {/* سازگاری */}
      <fieldset className="rounded-xl border border-gray-800 p-4">
        <legend className="px-1 text-sm font-bold text-gray-200">سازگاری خودرو (حداقل یک مدل)</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {models.map((m) => (
            <label key={m.slug} className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={draft.model_slugs.includes(m.slug)}
                onChange={() => toggleModel(m.slug)}
                className="h-4 w-4 accent-brand-500"
              />
              <span>
                {m.name} <span className="text-xs text-gray-500">({m.make_name})</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* تنظیمات فروش */}
      <fieldset className="rounded-xl border border-gray-800 p-4">
        <legend className="px-1 text-sm font-bold text-gray-200">تنظیمات فروش</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={labelCls}>
            <span className={spanCls}>حداکثر تعداد در سفارش</span>
            <input
              inputMode="numeric"
              value={draft.max_order_quantity}
              onChange={(e) => set("max_order_quantity", Number(e.target.value.replace(/\D/g, "")) || 1)}
              dir="ltr"
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            <span className={spanCls}>آستانه کم‌موجودی</span>
            <input
              inputMode="numeric"
              value={draft.low_stock_threshold}
              onChange={(e) => set("low_stock_threshold", Number(e.target.value.replace(/\D/g, "")) || 0)}
              dir="ltr"
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            <span className={spanCls}>متن ضمانت</span>
            <input value={draft.warranty_text} onChange={(e) => set("warranty_text", e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={draft.is_genuine}
            onChange={(e) => set("is_genuine", e.target.checked)}
            className="h-4 w-4 accent-brand-500"
          />
          قطعه شرکتی/اصلی است (نه پارتی بومی)
        </label>
      </fieldset>

      <label className={labelCls}>
        <span className={spanCls}>توضیحات</span>
        <textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          rows={4}
          className={inputCls}
        />
      </label>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      {saved && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">ذخیره شد ✓</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-500 px-6 py-2.5 font-bold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? "در حال ذخیره…" : "ذخیره قطعه"}
        </button>
        <a href="/admin" className="rounded-lg border border-gray-700 px-6 py-2.5 text-gray-300 hover:bg-gray-800">
          بازگشت به جدول
        </a>
      </div>
    </form>
  );
}
