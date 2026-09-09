"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useCart } from "@/stores/cart";

/** هدر فروشگاه — جستجو، سبد با نشان تعداد، ورود پنل ادمین. */
export function StoreHeader() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const count = useCart((s) => s.items.reduce((n, it) => n + it.qty, 0));

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <a href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-amber-500 text-base font-black text-white shadow-md shadow-brand-500/20">
            یدک
          </span>
          <span className="hidden text-lg font-black text-white sm:inline">یدک‌پـرو</span>
        </a>

        <form
          className="relative hidden flex-1 md:block"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(q.trim() ? `/catalog?q=${encodeURIComponent(q.trim())}` : "/catalog");
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی نام قطعه یا کد فنی..."
            className="w-full rounded-2xl border border-gray-800 bg-gray-900 py-2.5 pe-4 ps-10 text-xs text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/40"
          />
          <svg
            className="absolute start-3.5 top-3 h-4 w-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </form>

        <nav className="ms-auto flex items-center gap-2 text-xs font-bold">
          <a
            href="/catalog"
            className="hidden rounded-xl px-3 py-2 text-gray-300 transition hover:bg-gray-800 hover:text-white sm:inline"
          >
            کاتالوگ قطعات
          </a>
          <a
            href="/admin"
            className="rounded-xl border border-amber-700/50 bg-amber-500/10 px-3 py-2 text-amber-500 transition hover:bg-amber-500/20"
          >
            پنل مدیریت
          </a>
          <a
            href="/cart"
            className="relative flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-gray-950 transition hover:bg-white"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M17 17a2 2 0 100 4 2 2 0 000-4zM9 19a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="hidden sm:inline">سبد خرید</span>
            {count > 0 && (
              <span className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-black text-white">
                {new Intl.NumberFormat("fa-IR").format(count)}
              </span>
            )}
          </a>
        </nav>
      </div>
    </header>
  );
}
