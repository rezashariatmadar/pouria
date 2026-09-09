export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-10 py-12 text-center">
        <h1 className="text-4xl font-black tracking-tight text-white">
          یدک<span className="text-brand-500">‌پرو</span>
        </h1>
        <p className="mt-3 text-gray-400">
          پلتفرم تخصصی قطعات یدکی ایران‌خودرو و سایپا
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-600/15 px-4 py-1.5 text-sm text-brand-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
          اسکلت پروژه آماده است — MVP در حال ساخت
        </div>
        <dl className="mt-8 grid grid-cols-3 gap-6 text-center text-xs text-gray-500">
          <div>
            <dt className="font-mono">Next.js 15</dt>
            <dd>فرانت‌اند RTL</dd>
          </div>
          <div>
            <dt className="font-mono">Django 5</dt>
            <dd>API + داده</dd>
          </div>
          <div>
            <dt className="font-mono">PostgreSQL 16</dt>
            <dd>پایگاه داده</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
