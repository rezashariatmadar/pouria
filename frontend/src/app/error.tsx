"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gray-950 px-4 text-center">
      <div className="text-6xl">⚠️</div>
      <h1 className="text-2xl font-bold text-white">خطایی رخ داد</h1>
      <p className="max-w-md text-gray-400">
        مشکلی در نمایش این صفحه پیش آمد. لطفاً دوباره تلاش کنید.
      </p>
      {error.digest && <p className="font-mono text-xs text-gray-600" dir="ltr">{error.digest}</p>}
      <button
        onClick={reset}
        className="rounded-lg bg-brand-500 px-5 py-2.5 font-bold text-white transition hover:bg-brand-600"
      >
        تلاش مجدد
      </button>
    </main>
  );
}
