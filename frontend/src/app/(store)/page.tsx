import { api } from "@/lib/api-client";
import { faDigits } from "@/lib/format";
import { ProductCard, type StoreProduct } from "@/components/store/product-card";
import { VehicleSelector } from "@/components/store/vehicle-selector";
import { VinDecoder } from "@/components/store/vin-decoder";

interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

interface ProductPage {
  items: StoreProduct[];
  total: number;
}

const WHATSAPP_FALLBACK = "https://wa.me/989120000000";

const CATEGORY_ICONS: Record<string, { glyph: string; cls: string; hint: string }> = {
  brakes: { glyph: "🛞", cls: "bg-brand-500/10 text-brand-500", hint: "لنت، دیسک، کاسه" },
  suspension: { glyph: "⚙", cls: "bg-blue-500/10 text-blue-400", hint: "کمک‌فنر، طبق، سیبک" },
  clutch: { glyph: "⭕", cls: "bg-emerald-500/10 text-emerald-400", hint: "دیسک و صفحه" },
  cooling: { glyph: "🌡", cls: "bg-cyan-500/10 text-cyan-400", hint: "رادیاتور، واترپمپ" },
  electrical: { glyph: "⚡", cls: "bg-amber-500/10 text-amber-400", hint: "کوئل، سنسور، شمع" },
  body: { glyph: "💡", cls: "bg-violet-500/10 text-violet-400", hint: "چراغ، آینه، سپر" },
  consumable: { glyph: "🛠", cls: "bg-gray-500/10 text-gray-300", hint: "روغن و فیلترها" },
};

const TRUST_BADGES = [
  { glyph: "🛡", cls: "bg-amber-500/10 text-amber-500", title: "ضمانت اصالت کالا", hint: "پلمپ ایساکو و کروز" },
  { glyph: "⚡", cls: "bg-cyan-500/10 text-cyan-400", title: "ارسال ۲ ساعته در تهران", hint: "پیک موتوری و وانت فوری" },
  { glyph: "✔", cls: "bg-emerald-500/10 text-emerald-400", title: "استعلام شماره شاسی", hint: "تطابق ۱۰۰٪ قبل از بسته‌بندی" },
  { glyph: "🚚", cls: "bg-violet-500/10 text-violet-400", title: "ارسال به سراسر کشور", hint: "تیپاکس، چاپار و باربری" },
];

/** صفحه اصلی — هیرو + انتخاب خودرو + دیکدر شاسی + دسته‌ها + قطعات منتخب. */
export default async function HomePage() {
  const [categories, productsPage]: [Category[], ProductPage] = await Promise.all([
    api.get("/catalog/categories").catch(() => [] as Category[]),
    api.get("/catalog/products?page=1").catch(() => ({ items: [], total: 0 }) as ProductPage),
  ]);

  const featured = (productsPage.items ?? []).slice(0, 4);
  const wa = process.env.NEXT_PUBLIC_WHATSAPP ?? WHATSAPP_FALLBACK;

  return (
    <div>
      {/* هیرو */}
      <section className="relative overflow-hidden border-b border-gray-800 bg-gray-950 px-4 py-12 sm:py-16">
        <div className="pointer-events-none absolute -start-24 -top-24 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -end-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-5xl space-y-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1.5 text-xs font-bold text-brand-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
            <span>بزرگ‌ترین کاتالوگ آنلاین قطعات اصلی ایران‌خودرو و سایپا</span>
          </div>

          <h1 className="text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl sm:leading-snug lg:text-5xl">
            قطعه دقیق اتومبیلت را با قیمت لحظه‌ای و{" "}
            <span className="bg-gradient-to-r from-brand-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent">
              تضمین اصالت
            </span>{" "}
            پیدا کن
          </h1>

          <p className="mx-auto max-w-2xl text-xs leading-relaxed text-gray-400 sm:text-sm">
            دیگر نگران خرید قطعه اشتباه یا تقلبی نباشید؛ اتومبیل خود را انتخاب کنید تا تمامی
            قطعات سازگار به همراه قیمت روز برای شما فیلتر شوند.
          </p>

          <div className="mt-8">
            <VehicleSelector />
          </div>
        </div>
      </section>

      {/* نشان‌های اعتماد */}
      <section className="mx-auto -mt-6 max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-lg lg:grid-cols-4">
          {TRUST_BADGES.map((b) => (
            <div key={b.title} className="flex items-center gap-3.5 p-2">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl ${b.cls}`}
              >
                {b.glyph}
              </span>
              <div>
                <div className="text-xs font-extrabold text-gray-100">{b.title}</div>
                <div className="mt-0.5 text-[11px] text-gray-500">{b.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* دیکدر VIN */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl sm:p-8">
          <VinDecoder />
        </div>
      </section>

      {/* دسته‌بندی‌ها */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">دسته‌بندی‌های تخصصی قطعات خودرو</h2>
            <p className="mt-0.5 text-xs text-gray-500">انتخاب سریع بر اساس سیستم فنی اتومبیل</p>
          </div>
          <a href="/catalog" className="text-xs font-bold text-brand-500 transition hover:text-brand-600">
            مشاهده همه دسته‌ها ←
          </a>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {(categories ?? []).slice(0, 6).map((c: Category) => {
            const meta = CATEGORY_ICONS[c.slug] ?? {
              glyph: "🔧",
              cls: "bg-gray-500/10 text-gray-300",
              hint: "قطعات این دسته",
            };
            return (
              <a
                key={c.slug}
                href={`/catalog?cat=${c.slug}`}
                className="group rounded-3xl border border-gray-800 bg-gray-900 p-4 text-center transition hover:border-brand-500/60 hover:shadow-lg"
              >
                <span
                  className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl transition group-hover:scale-110 ${meta.cls}`}
                >
                  {meta.glyph}
                </span>
                <div className="text-xs font-extrabold text-gray-100">{c.name}</div>
                <div className="mt-0.5 text-[11px] text-gray-500">{meta.hint}</div>
              </a>
            );
          })}
        </div>
      </section>

      {/* قطعات منتخب */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">قطعات منتخب آماده ارسال</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {faDigits(productsPage.total ?? 0)} قطعه فعال در کاتالوگ یدک‌پرو
            </p>
          </div>
          <a href="/catalog" className="text-xs font-bold text-brand-500 transition hover:text-brand-600">
            مشاهده همه ←
          </a>
        </div>

        {featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p: StoreProduct) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-sm font-bold text-gray-300">
              در حال حاضر قطعه‌ای برای نمایش وجود ندارد.
            </p>
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-800/60 bg-emerald-950/50 px-4 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-900/50"
            >
              💬 استعلام قطعه در واتساپ
            </a>
          </div>
        )}
      </section>

      {/* پشتیبانی واتساپ */}
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-emerald-900/50 bg-gradient-to-l from-emerald-950/40 to-gray-900 p-6">
          <div>
            <div className="text-sm font-black text-white">قطعه‌ای پیدا نشد؟</div>
            <p className="mt-1 text-xs text-gray-400">
              کد فنی یا شماره شاسی را برای کارشناسان ما در واتساپ بفرستید — سریع استعلام می‌گیریم.
            </p>
          </div>
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-extrabold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500"
          >
            💬 گفتگو در واتساپ
          </a>
        </div>
      </section>
    </div>
  );
}
