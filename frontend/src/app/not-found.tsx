import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gray-950 px-4 text-center">
      <div className="text-6xl">🔎</div>
      <h1 className="text-2xl font-bold text-white">صفحه پیدا نشد</h1>
      <p className="max-w-md text-gray-400">
        آدرسی که دنبال آن هستید وجود ندارد یا جابه‌جا شده است.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-500 px-5 py-2.5 font-bold text-white transition hover:bg-brand-600"
        >
          صفحه اصلی
        </Link>
        <Link
          href="/catalog"
          className="rounded-lg border border-gray-700 px-5 py-2.5 text-gray-200 transition hover:border-brand-500"
        >
          فروشگاه قطعات
        </Link>
      </div>
    </main>
  );
}
