import Link from "next/link";

/** ۴۰۴ صفحه قطعه — زمانی که notFound() در PDP صدا زده شود. */

export default function ProductNotFound() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-3xl bg-brand-500/10 border border-orange-500/30 flex items-center justify-center text-3xl mb-5">
        🔧
      </div>
      <h1 className="text-xl font-black text-gray-100 mb-2">قطعه پیدا نشد</h1>
      <p className="text-sm text-gray-400 leading-relaxed mb-8 max-w-md">
        این قطعه حذف شده یا آدرس آن اشتباه است. می‌توانید کاتالوگ قطعات را مرور کنید یا با
        پشتیبانی تماس بگیرید تا قطعه مورد نظرتان را پیدا کنیم.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/catalog"
          className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-sm font-bold transition shadow-lg shadow-orange-500/30"
        >
          مرور کاتالوگ قطعات
        </Link>
        <Link
          href="/"
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-2xl text-sm font-bold transition"
        >
          بازگشت به خانه
        </Link>
      </div>
    </main>
  );
}
