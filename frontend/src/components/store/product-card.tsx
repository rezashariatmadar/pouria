import { toman } from "@/lib/format";

/** آستانه موجودی کم — پیش‌فرض مدل داده (low_stock_threshold=2). */
export const LOW_STOCK_THRESHOLD = 2;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** URL تصویر — پاسخ API یا مطلق است (http) یا نسبی (media/products/...). */
export function resolveImageUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return `${API_BASE}/${src.replace(/^\/+/, "")}`;
}

/** فرم مشترک قطعه در لیست/کاتالوگ — زیرمجموعه ProductListOut بک‌اند. */
export interface StoreProduct {
  id: number;
  title: string;
  slug: string;
  brand: string;
  category?: string;
  price: number;
  stock: number;
  is_call_for_price: boolean;
  is_genuine?: boolean;
  image: string | null;
}

function stockBadge(p: StoreProduct) {
  if (p.stock <= 0)
    return { label: "ناموجود", cls: "bg-red-950/90 text-red-300 border border-red-800/60" };
  if (p.stock <= LOW_STOCK_THRESHOLD)
    return {
      label: "آخرین موجودی‌ها",
      cls: "bg-amber-950/90 text-amber-300 border border-amber-800/60",
    };
  return { label: "موجود", cls: "bg-emerald-950/90 text-emerald-300 border border-emerald-800/60" };
}

/** کارت قطعه — هم در RSC (صفحه اصلی/مسیر سئو) و هم در کاتالوگ کلاینت. */
export function ProductCard({ product }: { product: StoreProduct }) {
  const badge = stockBadge(product);
  const href = `/product/${product.id}/${product.slug}`;

  return (
    <a
      href={href}
      className="group flex flex-col overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 shadow-sm transition hover:border-brand-500/60 hover:shadow-xl hover:shadow-brand-500/10"
    >
      <div className="relative aspect-[4/3] bg-gray-950">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveImageUrl(product.image)}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-gray-700">
            🔧
          </div>
        )}
        <span
          className={`absolute top-2.5 start-2.5 rounded-lg px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}
        >
          {badge.label}
        </span>
        {product.is_genuine && (
          <span className="absolute top-2.5 end-2.5 rounded-lg border border-brand-500/40 bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold text-brand-500">
            اصل
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.brand && (
          <span className="w-fit rounded-lg bg-gray-800 px-2 py-0.5 text-[10px] font-bold text-gray-300">
            {product.brand}
          </span>
        )}
        <h3 className="line-clamp-2 text-xs font-bold leading-relaxed text-gray-100 sm:text-sm">
          {product.title}
        </h3>
        <div className="mt-auto pt-2">
          {product.is_call_for_price ? (
            <span className="text-sm font-black text-amber-400">تماس بگیرید</span>
          ) : (
            <span className="text-sm font-black text-brand-500">{toman(product.price)}</span>
          )}
        </div>
      </div>
    </a>
  );
}
