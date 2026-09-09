import type { MetadataRoute } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface Category {
  slug: string;
}
interface HierarchyModel {
  slug: string;
}
interface HierarchyMake {
  slug: string;
  models: HierarchyModel[];
}
interface ProductPage {
  items: { id: number; slug: string }[];
  total: number;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/catalog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  // مسیرهای SEO برنامه‌ای: /parts/{make}/{model}/{category}
  const [hierarchyRes, categoriesRes] = await Promise.all([
    fetch(`${API_BASE}/api/v1/vehicles/hierarchy`, { next: { revalidate: 3600 } }).catch(() => null),
    fetch(`${API_BASE}/api/v1/catalog/categories`, { next: { revalidate: 3600 } }).catch(() => null),
  ]);
  const hierarchy: HierarchyMake[] | null = hierarchyRes?.ok ? await hierarchyRes.json() : null;
  const categories: Category[] | null = categoriesRes?.ok ? await categoriesRes.json() : null;

  if (hierarchy && categories) {
    for (const make of hierarchy) {
      for (const model of make.models) {
        for (const category of categories) {
          entries.push({
            url: `${SITE}/parts/${make.slug}/${model.slug}/${category.slug}`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.7,
          });
        }
      }
    }
  }

  // صفحات محصول — تا ۱۰ صفحه (۲۴۰ قطعه؛ کافی برای MVP)
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${API_BASE}/api/v1/catalog/products?page=${page}`).catch(() => null);
    if (!res?.ok) break;
    const body: ProductPage = await res.json();
    for (const p of body.items) {
      entries.push({
        url: `${SITE}/product/${p.id}/${p.slug}`,
        lastModified: now,
        changeFrequency: "hourly", // بازاری که ساعتی قیمت می‌شود
        priority: 0.8,
      });
    }
    if (body.items.length < 24) break;
  }

  return entries;
}
