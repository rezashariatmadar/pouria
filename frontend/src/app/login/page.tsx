"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { api, setAdminToken } from "@/lib/api-client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { access, refresh } = await api.auth.adminLogin(username, password);
      setAdminToken(access);
      localStorage.setItem("yadak_admin_refresh", refresh);
      router.push("/admin");
    } catch (err: any) {
      setError(err?.message ?? "خطا در ورود");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-950 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl"
      >
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 text-2xl">
            🛠️
          </div>
          <h1 className="text-xl font-bold text-white">ورود به پنل مدیریت یدک‌پرو</h1>
          <p className="mt-1 text-sm text-gray-400">فقط برای کاربران مجاز</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm text-gray-300">نام کاربری</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            dir="ltr"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-brand-500"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-gray-300">رمز عبور</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            dir="ltr"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-brand-500"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-brand-500 py-2.5 font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? "در حال ورود…" : "ورود"}
        </button>
      </form>
    </main>
  );
}
