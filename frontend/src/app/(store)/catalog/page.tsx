"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "@/lib/api-client";
import { faDigits } from "@/lib/format";
import { ProductCard, type StoreProduct } from "@/components/store/product-card";
import { CategoryChips } from "@/components/store/category-chips";

const PAGE_SIZE = 24;
const WHATSAPP_FALLBACK = "https://wa.me/989120000000";
const MAX_PAGE_BUTTONS = 7;

interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

interface ProductPage {
  items: StoreProduct[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

type SortKey = "default" | "price-asc" | "price-desc";

/** صفحه کاتالوگ — فیلترهای سروری (خودرو/دسته/جستجو) + فیلترهای کلاینت (برند/موجودی/مرتب‌سازی). */
export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-10 text-xs text-gray-500">در حال بارگذاری کاتالوگ…</div>}>
      <CatalogInner />
    </Suspense>
  );
}

function CatalogInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ---- فیلترهای سروری (URL) ----
  const make = searchParams.get("make") ?? "";
  const model = searchParams.get("model") ?? "";
  const trim = searchParams.get("trim") ?? "";
  const cat = searchParams.get("cat") ?? searchParams.get("category") ?? "";
  const q = searchParams.get("q") ?? "";

  // ---- وضعیت کلاینت ----
  const [data, setData] = useState<ProductPage | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("default");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allBrands, setAllBrands] = useState<string[]>([]);

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  /** اعمال فیلترهای سروری روی URL و ریست صفحه. */
  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      // تغییر فیلتر = برگشت به صفحه اول؛ قدم‌های آبشاری خودرو را هم پاک کن
      if (key === "make") {
        params.delete("model");
        params.delete("trim");
      }
      if (key === "model") params.delete("trim");
      params.delete("page");
      router.push(`/catalog${params.size ? `?${params.toString()}` : ""}`);
    },
    [router, searchParams]
  );

  const gotoPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (p > 1) params.set("page", String(p));
      else params.delete("page");
      router.push(`/catalog${params.size ? `?${params.toString()}` : ""}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router, searchParams]
  );

  // ---- بارگذاری دسته‌ها (یک‌بار) ----
  useEffect(() => {
    api
      .get("/catalog/categories")
      .then((d: Category[]) => setCategories(d ?? []))
      .catch(() => setCategories([]));
  }, []);

  // ---- بارگذاری صفحه فعلی محصولات ----
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (make) params.set("make", make);
    if (model) params.set("model", model);
    if (trim) params.set("trim", trim);
    if (cat) params.set("category", cat);
    if (q) params.set("q", q);
    params.set("page", String(page));
    api
      .get(`/catalog/products?${params.toString()}`)
      .then((d: ProductPage) => {
        setData(d);
        // برندهای صفحه جاری — منبع اولیه چک‌باکس‌ها
        const pageBrands = [...new Set((d.items ?? []).map((p) => p.brand).filter(Boolean))];
        setBrands(pageBrands);
        setSelectedBrands((prev) =>
          prev.length ? prev.filter((b) => pageBrands.includes(b)) : pageBrands
        );
      })
      .catch((e: Error) => setError(e.message || "خطا در دریافت قطعات"))
      .finally(() => setLoading(false));
  }, [make, model, trim, cat, q, page]);

  // ---- برندهای صفحه اول بدون فیلتر (فقط یک‌بار) — برای گزینه‌های کامل‌تر ----
  useEffect(() => {
    api
      .get("/catalog/products?page=1")
      .then((d: ProductPage) => {
        setAllBrands([...new Set((d.items ?? []).map((p) => p.brand).filter(Boolean))]);
      })
      .catch(() => setAllBrands([]));
  }, []);

  const brandOptions = useMemo(
    () => [...new Set([...allBrands, ...brands])],
    [allBrands, brands]
  );

  // ---- اعمال فیلترهای سمت کلاینت روی آیتم‌های صفحه ----
  const visible = useMemo(() => {
    let items = data?.items ?? [];
    if (inStockOnly) items = items.filter((p) => p.stock > 0);
    if (selectedBrands.length) items = items.filter((p) => selectedBrands.includes(p.brand));
    if (sort === "price-asc") items = [...items].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") items = [...items].sort((a, b) => b.price - a.price);
    return items;
  }, [data, inStockOnly, selectedBrands, sort]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasAnyFilter = Boolean(make || model || trim || cat || q);

  /** شماره صفحات نمایشی حول صفحه فعال (حداکثر ۷ دکمه). */
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(page - Math.floor(MAX_PAGE_BUTTONS / 2), totalPages - MAX_PAGE_BUTTONS + 1));
    const end = Math.min(totalPages, start + MAX_PAGE_BUTTONS - 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  function resetFilters() {
    setSelectedBrands(brands);
    setInStockOnly(false);
    setSort("default");
    router.push(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog");
  }

  const wa = process.env.NEXT_PUBLIC_WHATSAPP ?? WHATSAPP_FALLBACK;

  return (
    <div>
      {/* نوار فیلتر فعال خودرو */}
      {(make || model || trim || q) && (
        <div className="border-b border-gray-800 bg-gradient-to-l from-brand-600 to-amber-500 px-4 py-3 text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 font-bold">
              <span className="text-amber-100">فیلتر فعال:</span>
              {q && (
                <span className="rounded-xl bg-gray-950 px-3 py-1 font-mono text-xs text-white">
                  «{q}»
                </span>
              )}
              {make && (
                <button
                  onClick={() => setParam("make", null)}
                  className="rounded-xl bg-gray-950 px-3 py-1 text-xs text-white"
                >
                  خودرو: {make} ✕
                </button>
              )}
              {model && (
                <button
                  onClick={() => setParam("model", null)}
                  className="rounded-xl bg-gray-950 px-3 py-1 text-xs text-white"
                >
                  مدل: {model} ✕
                </button>
              )}
              {trim && (
                <button
                  onClick={() => setParam("trim", null)}
                  className="rounded-xl bg-gray-950 px-3 py-1 text-xs text-white"
                >
                  تیپ: {trim} ✕
                </button>
              )}
            </div>
            <a href="/" className="text-xs font-black underline transition hover:text-gray-950">
              تغییر خودرو
            </a>
          </div>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-4">
        {/* ستون فیلترها */}
        <aside className="space-y-5">
          <div className="space-y-5 rounded-3xl border border-gray-800 bg-gray-900 p-5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 text-sm font-black text-white">
              <span>فیلترهای پیشرفته</span>
              <button
                onClick={resetFilters}
                className="text-[11px] font-bold text-brand-500 hover:underline"
              >
                حذف فیلترها
              </button>
            </div>

            <div>
              <div className="mb-2.5 text-xs font-black text-gray-200">دسته‌بندی:</div>
              <CategoryChips
                categories={categories}
                active={cat || null}
                onSelect={(slug) => setParam("cat", slug)}
              />
            </div>

            <div>
              <div className="mb-2.5 text-xs font-black text-gray-200">برند سازنده قطعه:</div>
              <div className="space-y-2 text-xs">
                {brandOptions.length === 0 && <div className="text-gray-600">—</div>}
                {brandOptions.map((b) => (
                  <label
                    key={b}
                    className="flex cursor-pointer items-center gap-2.5 text-gray-300 transition hover:text-brand-500"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(b)}
                      onChange={(e) =>
                        setSelectedBrands((prev) =>
                          e.target.checked ? [...prev, b] : prev.filter((x) => x !== b)
                        )
                      }
                      className="size-4 rounded accent-brand-500"
                    />
                    <span className="font-medium">{b}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2.5 text-xs font-black text-gray-200">وضعیت موجودی:</div>
              <label className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="size-4 rounded accent-brand-500"
                />
                <span className="font-medium">فقط کالاهای موجود</span>
              </label>
            </div>
          </div>
        </aside>

        {/* شبکه محصولات */}
        <div className="lg:col-span-3">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gray-400">
              {loading ? (
                "در حال بارگذاری…"
              ) : (
                <>
                  <span className="font-black text-white">{faDigits(total)}</span> قطعه یافت شد
                  {hasAnyFilter && " (با فیلترهای خودرو/جستجو)"}
                </>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="cursor-pointer rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-200 outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              <option value="default">مرتب‌سازی پیش‌فرض (موجود اول)</option>
              <option value="price-asc">ارزان‌ترین قیمت</option>
              <option value="price-desc">گران‌ترین قیمت</option>
            </select>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-xs font-bold text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-12">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800 text-2xl">
                🔍
              </div>
              <h3 className="text-sm font-black text-white">قطعه‌ای با این فیلترها پیدا نشد</h3>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-gray-500">
                فیلترها را ساده‌تر کنید یا کد فنی قطعه را برای کارشناسان ما بفرستید تا سریع
                استعلام بگیریم.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={resetFilters}
                  className="rounded-xl border border-gray-700 px-4 py-2 text-xs font-bold text-gray-200 transition hover:border-brand-500/50 hover:text-brand-500"
                >
                  بازنشانی فیلترها
                </button>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
                >
                  💬 استعلام در واتساپ
                </a>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {loading && !data
              ? Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="h-80 animate-pulse rounded-3xl border border-gray-800 bg-gray-900" />
                ))
              : visible.map((p) => <ProductCard key={`${p.id}-${p.slug}`} product={p} />)}
          </div>

          {/* صفحه‌بندی */}
          {!loading && totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => gotoPage(page - 1)}
                disabled={page <= 1}
                className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-300 transition hover:border-gray-700 disabled:opacity-40"
              >
                قبلی
              </button>
              {pageNumbers[0] > 1 && (
                <>
                  <button
                    onClick={() => gotoPage(1)}
                    className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-300 transition hover:border-gray-700"
                  >
                    {faDigits(1)}
                  </button>
                  {pageNumbers[0] > 2 && <span className="px-1 text-gray-600">…</span>}
                </>
              )}
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => gotoPage(p)}
                  className={
                    p === page
                      ? "rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-black text-white"
                      : "rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-xs font-bold text-gray-300 transition hover:border-gray-700"
                  }
                >
                  {faDigits(p)}
                </button>
              ))}
              {pageNumbers[pageNumbers.length - 1] < totalPages && (
                <>
                  {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                    <span className="px-1 text-gray-600">…</span>
                  )}
                  <button
                    onClick={() => gotoPage(totalPages)}
                    className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-300 transition hover:border-gray-700"
                  >
                    {faDigits(totalPages)}
                  </button>
                </>
              )}
              <button
                onClick={() => gotoPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-300 transition hover:border-gray-700 disabled:opacity-40"
              >
                بعدی
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
