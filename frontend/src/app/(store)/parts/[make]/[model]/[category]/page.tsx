import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { faDigits } from "@/lib/format";
import { ProductCard, type StoreProduct } from "@/components/store/product-card";

export const revalidate = 60;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Category {
  id: number;
  name: string;
  slug: string;
}

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

interface ProductPage {
  items: StoreProduct[];
  total: number;
}

interface PageProps {
  params: Promise<{ make: string; model: string; category: string }>;
}

/**
 * fetch با کش ISR — برخلاف api.get (no-store) تا با revalidate=60 مسیر هم‌خوان باشد.
 * خطا → مقدار پیش‌فرض (لیست خالی)؛ فقط خطای HTTP در پاسخ JSON parse می‌شود.
 */
async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const resp = await fetch(`${API_BASE}/api/v1${path}`, {
      next: { revalidate: 60 },
    });
    if (!resp.ok) return fallback;
    return (await resp.json()) as T;
  } catch {
    return fallback;
  }
}

/** مسیر سئو /parts/{make}/{model}/{category} — RSC با ISR ۶۰ ثانیه‌ای. */
export default async function PartsPage({ params }: PageProps) {
  const { make, model, category } = await params;

  const [hierarchy, categories, productsPage]: [HierarchyMake[], Category[], ProductPage] =
    await Promise.all([
      fetchJson<HierarchyMake[]>("/vehicles/hierarchy", []),
      fetchJson<Category[]>("/catalog/categories", []),
      fetchJson<ProductPage>(
        `/catalog/products?make=${encodeURIComponent(make)}&model=${encodeURIComponent(
          model
        )}&category=${encodeURIComponent(category)}`,
        { items: [], total: 0 }
      ),
    ]);

  // فقط دسته ناشناخته ۴۰۴ می‌شود؛ برند/مدل اشتباه → لیست خالی نمایش داده می‌شود.
  const catKnown = (categories ?? []).some((c: Category) => c.slug === category);
  if (!catKnown) notFound();

  const makeName = hierarchy?.find((m: HierarchyMake) => m.slug === make)?.name ?? make;
  const modelObj = hierarchy
    ?.find((m: HierarchyMake) => m.slug === make)
    ?.models.find((m: HierarchyModel) => m.slug === model);
  const modelName = modelObj?.name ?? model;
  const categoryName =
    (categories ?? []).find((c: Category) => c.slug === category)?.name ?? category;

  const products = productsPage.items ?? [];

  // JSON-LD BreadcrumbList — مسیر: صفحه اصلی / کاتالوگ / خودرو / مدل / دسته
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "صفحه اصلی", item: `${API_BASE}/` },
      { "@type": "ListItem", position: 2, name: "کاتالوگ قطعات", item: `${API_BASE}/catalog` },
      {
        "@type": "ListItem",
        position: 3,
        name: makeName,
        item: `${API_BASE}/catalog?make=${make}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: modelName,
        item: `${API_BASE}/catalog?make=${make}&model=${model}`,
      },
      {
        "@type": "ListItem",
        position: 5,
        name: categoryName,
        item: `${API_BASE}/parts/${make}/${model}/${category}`,
      },
    ],
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      {/* مسیر راهنما */}
      <nav className="mb-5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <Link href="/" className="transition hover:text-brand-500">
          صفحه اصلی
        </Link>
        <span>/</span>
        <Link href="/catalog" className="transition hover:text-brand-500">
          کاتالوگ
        </Link>
        <span>/</span>
        <Link href={`/catalog?make=${make}`} className="transition hover:text-brand-500">
          {makeName}
        </Link>
        <span>/</span>
        <Link href={`/catalog?make=${make}&model=${model}`} className="transition hover:text-brand-500">
          {modelName}
        </Link>
        <span>/</span>
        <span className="font-bold text-gray-300">{categoryName}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-xl font-black text-white sm:text-2xl">
          قطعات {categoryName} {makeName} {modelName}
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          <span className="font-black text-gray-300">{faDigits(productsPage.total ?? 0)}</span> قطعه
          فعال و سازگار — قیمت‌های لحظه‌ای با تایید شماره شاسی قبل از ارسال
        </p>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p: StoreProduct) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800 text-2xl">
            🔍
          </div>
          <h3 className="text-sm font-black text-white">
            فعلاً قطعه‌ای برای {categoryName} {modelName} ثبت نشده است
          </h3>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-gray-500">
            از کاتالوگ تعاملی با فیلترهای بیشتر استفاده کنید یا کد فنی را برای کارشناسان ما
            بفرستید.
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <p className="text-xs text-gray-400">
          می‌خواهید فیلترها را تعاملی تغییر دهید؟ (دسته، برند، موجودی، مرتب‌سازی)
        </p>
        <Link
          href={`/catalog?make=${make}&model=${model}&category=${category}`}
          className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-brand-600"
        >
          مشاهده در کاتالوگ تعاملی ←
        </Link>
      </div>
    </div>
  );
}

/** متادیتای فارسی از نام‌های نمایشی برند/مدل/دسته. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { make, model, category } = await params;

  const [hierarchy, categories]: [HierarchyMake[], Category[]] = await Promise.all([
    fetchJson<HierarchyMake[]>("/vehicles/hierarchy", []),
    fetchJson<Category[]>("/catalog/categories", []),
  ]);

  const makeName = hierarchy?.find((m: HierarchyMake) => m.slug === make)?.name ?? make;
  const modelName =
    hierarchy
      ?.find((m: HierarchyMake) => m.slug === make)
      ?.models.find((m: HierarchyModel) => m.slug === model)?.name ?? model;
  const categoryName =
    (categories ?? []).find((c: Category) => c.slug === category)?.name ?? category;

  const title = `قطعات ${categoryName} ${makeName} ${modelName}`;
  return {
    title,
    description: `خرید آنلاین قطعات ${categoryName} ${makeName} ${modelName} با قیمت روز، ضمانت اصالت و تایید شماره شاسی در یدک‌پرو`,
    alternates: { canonical: `/parts/${make}/${model}/${category}` },
    openGraph: { title, type: "website" },
  };
}
