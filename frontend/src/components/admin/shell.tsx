"use client";

import { useEffect, useState, type ReactNode } from "react";

import { getAdminToken, setAdminToken } from "@/lib/api-client";

const NAV = [
  { href: "/admin", label: "قیمت و موجودی" },
  { href: "/admin/products/new", label: "قطعه جدید" },
  { href: "/admin/orders", label: "سفارش‌ها" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(Boolean(getAdminToken()));
  }, []);

  if (authed === null) {
    return <div className="min-h-dvh bg-gray-950" />;
  }
  if (!authed) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="min-h-dvh bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <a href="/admin" className="flex items-center gap-2 font-bold text-white">
            <span className="text-xl">🔧</span> یدک‌پرو
          </a>
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-1.5 text-gray-300 transition hover:bg-gray-800 hover:text-white"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <button
            onClick={() => {
              setAdminToken(null);
              window.location.href = "/login";
            }}
            className="ms-auto rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-400 hover:border-red-500/50 hover:text-red-400"
          >
            خروج
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
