const WHATSAPP_FALLBACK = "https://wa.me/989120000000";

/** فوتر فروشگاه — خطوط اعتماد و راه‌های ارتباطی. */
export function StoreFooter() {
  const wa = process.env.NEXT_PUBLIC_WHATSAPP ?? WHATSAPP_FALLBACK;

  return (
    <footer className="mt-16 border-t border-gray-800 bg-gray-950">
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-4 text-xs lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              🛡
            </span>
            <div>
              <div className="font-extrabold text-gray-100">ضمانت اصالت کالا</div>
              <div className="mt-0.5 text-[11px] text-gray-500">پلمپ و کد رهگیری</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
              ⚡
            </span>
            <div>
              <div className="font-extrabold text-gray-100">ارسال سریع</div>
              <div className="mt-0.5 text-[11px] text-gray-500">۲ ساعته در تهران</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              ✔
            </span>
            <div>
              <div className="font-extrabold text-gray-100">تایید شماره شاسی</div>
              <div className="mt-0.5 text-[11px] text-gray-500">تطابق ۱۰۰٪ قبل از ارسال</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
              🚚
            </span>
            <div>
              <div className="font-extrabold text-gray-100">ارسال به سراسر کشور</div>
              <div className="mt-0.5 text-[11px] text-gray-500">تیپاکس و چاپار</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 border-t border-gray-800 pt-8 text-xs sm:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 text-[11px] font-black text-white">
                یدک
              </span>
              یدک‌پـرو
            </div>
            <p className="leading-relaxed text-gray-500">
              مرجع تخصصی تامین و توزیع مستقیم لوازم یدکی خودروهای ایران‌خودرو و سایپا؛ تمامی قطعات
              با ضمانت اصالت فیزیکی و تایید شماره شاسی عرضه می‌شوند.
            </p>
          </div>
          <div>
            <div className="mb-3 font-extrabold text-gray-200">دسترسی سریع</div>
            <ul className="space-y-2 text-gray-500">
              <li>
                <a href="/" className="transition hover:text-brand-500">
                  صفحه اصلی
                </a>
              </li>
              <li>
                <a href="/catalog" className="transition hover:text-brand-500">
                  کاتالوگ قطعات
                </a>
              </li>
              <li>
                <a href="/catalog?cat=brakes" className="transition hover:text-brand-500">
                  قطعات ترمز
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="mb-3 font-extrabold text-gray-200">ارتباط با ما</div>
            <ul className="space-y-2 text-gray-500">
              <li>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 font-bold text-emerald-400 transition hover:bg-emerald-900/50"
                >
                  <span>💬 پشتیبانی و استعلام در واتساپ</span>
                </a>
              </li>
              <li>پاسخگویی: شنبه تا پنجشنبه، ۹ تا ۱۸</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 text-center text-[11px] text-gray-600">
          © یدک‌پرو — خرید مطمئن قطعات اصلی با تایید شاسی
        </div>
      </div>
    </footer>
  );
}
