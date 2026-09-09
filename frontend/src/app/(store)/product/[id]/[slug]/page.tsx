import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Gallery } from "@/components/store/gallery";
import { BuyBox } from "@/components/store/add-to-cart";
import { SpecsTabs, type CompatibilityEntry } from "@/components/store/specs-tabs";

/**
 * صفحه جزئیات قطعه (PDP) — RSC: فچ سمت سرور + JSON-LD؛ جزایر کلاینت:
 * گالری، باکس خرید (تنوع/تعداد/VIN/نوار چسبان) و تب‌ها.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface VariantOut {
  id: number;
  name: string;
  price: number;
  stock: number;
  is_default: boolean;
}

interface ProductDetail {
  id: number;
  title: string;
  slug: string;
  brand: string;
  category: string;
  part_number: string;
  isaco_code: string;
  price: number;
  stock: number;
  is_call_for_price: boolean;
  is_genuine: boolean;
  image: string | null;
  variants: VariantOut[];
  description: string;
  warranty_text: string;
  max_order_quantity: number;
  compatibility: CompatibilityEntry[];
  gallery: string[];
  meta_title: string;
  meta_description: string | null;
}

async function fetchProduct(id: number): Promise<ProductDetail | null> {
  try {
    // no-store: قیمت/موجودی PDP باید لحظه‌ای باشد (رزروهای ۱۵ دقیقه‌ای هر لحظه
    // تغییر می‌کنند و بک‌اند نمی‌تواند کش ISR نکست را باطل کند).
    const resp = await fetch(`${API_BASE}/api/v1/catalog/products/${id}`, {
      cache: "no-store",
    });
    if (!resp.ok) return null;
    return (await resp.json()) as ProductDetail;
  } catch {
    return null;
  }
}

/** پلتفرم VIN از سازگاری: فقط ikco / فقط saipa / هر دو یا هیچ = null */
function platformFromCompatibility(compat: CompatibilityEntry[]): "ikco" | "saipa" | null {
  const hasIkco = compat.some((c) => c.make === "ایران‌خودرو");
  const hasSaipa = compat.some((c) => c.make === "سایپا");
  if (hasIkco && !hasSaipa) return "ikco";
  if (hasSaipa && !hasIkco) return "saipa";
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProduct(Number(id));
  if (!product) return { title: "قطعه پیدا نشد" };

  const description =
    product.meta_description?.trim() || product.description.slice(0, 120) || product.title;

  return {
    title: product.meta_title || product.title,
    description,
    openGraph: {
      title: product.meta_title || product.title,
      description,
      images: product.gallery[0] ?? undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();

  const product = await fetchProduct(productId);
  if (!product) notFound();

  // گالری: آرایه API وگرنه تک‌تصویر اصلی
  const galleryImages = product.gallery.length > 0 ? product.gallery : product.image ? [product.image] : [];

  // اولین سازگاری برای breadcrumb (فروشگاه > خودروساز > مدل > دسته)
  const firstCompat = product.compatibility[0];
  const breadcrumbName = firstCompat
    ? `${firstCompat.make} ${firstCompat.model}`
    : product.category;
  const makeName = firstCompat?.make ?? "";

  // قیمت/موجودی برای JSON-LD: تنوع پیش‌فرض وگرنه خود قطعه
  const defaultVariant =
    product.variants.find((v) => v.is_default) ?? product.variants[0] ?? null;
  const ldPrice = defaultVariant ? defaultVariant.price : product.price;
  const ldStock = defaultVariant ? defaultVariant.stock : product.stock;
  const mpn = product.part_number || product.isaco_code || undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.title,
        ...(mpn ? { mpn } : {}),
        ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
        ...(galleryImages[0] ? { image: galleryImages[0] } : {}),
        description: product.meta_description || product.description.slice(0, 200),
        offers: {
          "@type": "Offer",
          priceCurrency: "IRR",
          price: ldPrice * 10, // تومان → ریال (IRR)
          availability: ldStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "فروشگاه", item: "/catalog" },
          ...(makeName
            ? [{ "@type": "ListItem", position: 2, name: makeName, item: "/catalog" }]
            : []),
          { "@type": "ListItem", position: makeName ? 3 : 2, name: product.category },
          {
            "@type": "ListItem",
            position: makeName ? 4 : 3,
            name: product.title,
            item: `/product/${product.id}/${product.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ستون راست/وسط: گالری، تنوع، مشخصات */}
      <div className="lg:col-span-2 space-y-6">
        {/* breadcrumb */}
        <nav className="flex flex-wrap items-center gap-2 text-xs text-gray-400 font-medium pt-4">
          <Link href="/" className="hover:text-gray-100 transition">
            خانه
          </Link>
          <span>/</span>
          <Link href="/catalog" className="hover:text-gray-100 transition">
            فروشگاه
          </Link>
          <span>/</span>
          <span>{breadcrumbName}</span>
          <span>/</span>
          <span className="text-gray-100 font-bold">{product.title}</span>
        </nav>

        <div className="bg-white rounded-3xl border border-gray-200/90 p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-7">
          <Gallery images={galleryImages} title={product.title} />

          <div className="space-y-4">
            <div>
              <span className="inline-block bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-lg mb-2">
                {product.category}
              </span>
              <h1 className="text-base sm:text-lg font-black text-gray-900 leading-snug">
                {product.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1 font-mono">
                {product.part_number && <span>کد فنی: {product.part_number}</span>}
                {product.isaco_code && (
                  <>
                    <span>•</span>
                    <span>ایساکو: {product.isaco_code}</span>
                  </>
                )}
                {product.is_genuine && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-700 font-sans font-bold">اصالت تضمین‌شده</span>
                  </>
                )}
              </div>
            </div>

            {product.compatibility.length > 0 && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 space-y-1.5 shadow-2xs">
                <div className="font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>سازگاری ۱۰۰٪ تایید شده با خودروهای زیر:</span>
                </div>
                <div className="text-[11px] text-emerald-700 leading-relaxed pr-6">
                  {product.compatibility
                    .map((c) => `${c.make} ${c.model}${c.trims.length ? ` (${c.trims.join("، ")})` : ""}`)
                    .join(" • ")}
                </div>
              </div>
            )}

            {/* اطلاعات فشرده بدون تنوع — برای محصولات بدون تنوع، باکس خرید قیمت را نشان می‌دهد */}
            {product.variants.length === 0 && !product.is_call_for_price && (
              <div className="text-xs text-gray-600 border-t border-gray-100 pt-3">
                قیمت و موجودی در باکس خرید سمت چپ نمایش داده می‌شود.
              </div>
            )}
          </div>
        </div>

        <SpecsTabs
          title={product.title}
          description={product.description}
          brand={product.brand}
          category={product.category}
          partNumber={product.part_number}
          isacoCode={product.isaco_code}
          isGenuine={product.is_genuine}
          warrantyText={product.warranty_text}
          compatibility={product.compatibility}
        />
      </div>

      {/* ستون چپ: باکس خرید */}
      <aside className="space-y-6">
        <BuyBox
          data={{
            id: product.id,
            title: product.title,
            slug: product.slug,
            image: product.image,
            price: product.price,
            stock: product.stock,
            is_call_for_price: product.is_call_for_price,
            max_order_quantity: product.max_order_quantity,
            variants: product.variants,
            platform: platformFromCompatibility(product.compatibility),
          }}
        />
      </aside>
    </main>
  );
}
