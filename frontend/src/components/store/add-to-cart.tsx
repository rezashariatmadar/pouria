"use client";

/**
 * AddToCart: دکمه افزودن به سبد + اعلان رزرو ۱۵ دقیقه‌ای + توست موفقیت با لینک سبد.
 * BuyBox: جزیره کلاینت کل باکس خرید — تنوع/تعداد/VIN/نوار چسبان را هم‌آهنگ نگه می‌دارد.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { toman } from "@/lib/format";
import { useCart } from "@/stores/cart";
import { VariantPicker, type VariantInfo } from "./variant-picker";
import { QtyStepper } from "./qty-stepper";
import { VinScanner } from "./vin-scanner";
import { StickyBar } from "./sticky-bar";

export const WHATSAPP_NUMBER = "989121111111";

export function whatsappUrl(title: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`سلام، درباره «${title}» سوال داشتم`)}`;
}

export interface BuyBoxData {
  id: number;
  title: string;
  slug: string;
  image: string | null;
  price: number;
  stock: number;
  is_call_for_price: boolean;
  max_order_quantity: number;
  variants: VariantInfo[];
  platform: "ikco" | "saipa" | null;
}

export function BuyBox({ data }: { data: BuyBoxData }) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  const [scrollPastHero, setScrollPastHero] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedVariant, setSelectedVariant] = useState<VariantInfo | null>(() => {
    if (data.variants.length === 0) return null;
    return data.variants.find((v) => v.is_default) ?? data.variants.find((v) => v.stock > 0) ?? null;
  });
  const [qty, setQty] = useState(1);

  const unitPrice = selectedVariant ? selectedVariant.price : data.price;
  const stock = selectedVariant ? selectedVariant.stock : data.stock;
  const maxQty = Math.min(stock, data.max_order_quantity);
  const outOfStock = stock <= 0;
  const addDisabled = outOfStock || data.is_call_for_price;

  // انتخاب تنوع → اگر تعداد فعلی از سقف جدید بیشتر شد، اصلاح کن
  const handleSelectVariant = (v: VariantInfo) => {
    setSelectedVariant(v);
    // تنوع جدید → تعداد را به ۱ برمی‌گردانیم تا از سقف موجودی جدید عبور نکند
    setQty(1);
  };

  // نوار چسبان موبایل: بعد از رد شدن از هیرو (گالری/سرصفحه) ظاهر شود
  useEffect(() => {
    const onScroll = () => setScrollPastHero(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const handleAdd = () => {
    if (addDisabled) return;
    add({
      product_id: data.id,
      variant_id: selectedVariant?.id ?? null,
      qty,
      display: {
        title: data.title,
        variant_name: selectedVariant?.name,
        price: unitPrice,
        image: data.image,
        max_qty: Math.max(1, maxQty),
      },
    });
    setAdded(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setAdded(false), 4000);
  };

  return (
    <>
      <div className="bg-white rounded-3xl border-2 border-gray-200 p-6 shadow-xl space-y-5 sticky top-24">
        {/* قیمت */}
        <div className="space-y-1">
          <div className="text-xs text-gray-400 font-medium">
            {data.is_call_for_price ? "قیمت:" : "قیمت قطعی روز:"}
          </div>
          {data.is_call_for_price ? (
            <div className="text-2xl font-black text-gray-900">تماس بگیرید</div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-gray-900">{toman(unitPrice * qty)}</span>
              {qty > 1 && (
                <span className="text-[11px] text-gray-400">
                  ({qty} × {toman(unitPrice)})
                </span>
              )}
            </div>
          )}
          {!data.is_call_for_price && (
            <div className="text-[11px] flex items-center gap-1.5 font-bold pt-1">
              {outOfStock ? (
                <span className="text-rose-600">
                  <span className="inline-block w-2 h-2 rounded-full bg-rose-500 ml-1.5" />
                  فعلاً ناموجود — با تماس، زمان ورود را استعلام کنید
                </span>
              ) : (
                <span className="text-emerald-600">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-1.5" />
                  موجودی انبار: {new Intl.NumberFormat("fa-IR").format(stock)} عدد (تحویل فوری)
                </span>
              )}
            </div>
          )}
        </div>

        <VariantPicker
          variants={data.variants}
          selectedId={selectedVariant?.id ?? null}
          onSelect={handleSelectVariant}
        />

        {!data.is_call_for_price && (
          <QtyStepper qty={qty} max={Math.max(1, maxQty)} onChange={setQty} />
        )}

        <VinScanner platform={data.platform} />

        {/* دکمه افزودن / تماس بگیرید */}
        <div className="space-y-2">
          {data.is_call_for_price ? (
            <>
              <div className="w-full py-4 rounded-2xl bg-gray-100 border border-gray-200 text-sm font-bold text-gray-600 text-center">
                قیمت این قطعه تلفنی است — تماس بگیرید
              </div>
              <a
                href={whatsappUrl(data.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                استعلام قیمت در واتساپ
              </a>
            </>
          ) : outOfStock ? (
            <div className="w-full py-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm font-bold text-rose-700 text-center">
              این {data.variants.length > 0 ? "تنوع" : "قطعه"} فعلاً ناموجود است
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleAdd}
                className="w-full py-4 bg-gradient-to-l from-brand-600 to-amber-500 hover:from-brand-700 hover:to-amber-600 active:scale-[0.99] text-white rounded-2xl text-xs sm:text-sm font-black transition shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2.5"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                <span>افزودن به سبد خرید و پرداخت آنلاین</span>
              </button>

              <div className="text-[10px] text-center text-gray-400 flex items-center justify-center gap-1.5 pt-1">
                <svg
                  className="w-3.5 h-3.5 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span>پس از پرداخت، موجودی تا ۱۵ دقیقه برای شما رزرو می‌شود</span>
              </div>
            </>
          )}

          {added && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
              <span>به سبد اضافه شد</span>
              <Link href="/cart" className="text-emerald-700 underline shrink-0">
                مشاهده سبد خرید
              </Link>
            </div>
          )}
        </div>

        {/* نشان‌های اعتماد */}
        <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-[10px] text-gray-600 font-semibold">
          <div className="flex items-center gap-1.5 p-2 bg-gray-50 rounded-xl">
            <span className="text-brand-500">🛡️</span>
            <span>۷ روز ضمانت بازگشت</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 bg-gray-50 rounded-xl">
            <span className="text-blue-500">⚡</span>
            <span>ارسال ۲ ساعته تهران</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 bg-gray-50 rounded-xl">
            <span className="text-emerald-500">✓</span>
            <span>ضمانت اصالت فیزیکی</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 bg-gray-50 rounded-xl">
            <span className="text-purple-500">📞</span>
            <span>مشاوره رایگان فنی</span>
          </div>
        </div>

        <a
          href={whatsappUrl(data.title)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
        >
          مشاوره تخصصی در واتساپ
        </a>
      </div>

      {!data.is_call_for_price && !outOfStock && (
        <StickyBar price={unitPrice} qty={qty} onAdd={handleAdd} visible={scrollPastHero} />
      )}
    </>
  );
}
