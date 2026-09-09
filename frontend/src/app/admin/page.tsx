"use client";

/**
 * جدول سریع قیمت/موجودی — قلب یدک‌پرو.
 * پورت UX پروتوتایپ اعتبارسنجی‌شده: ذخیره گروهی با Ctrl+S، ناوبری کیبورد RTL،
 * هایلایت کم‌موجودی، همگام‌سازی «ناموجودها» با ویرایش موجودی، شمارنده تغییرات.
 *
 * ردیف‌های variant_id != null تنوع‌های چپ/راست/جفت زیر قطعه والدند — همان گرید کیبوردی.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdminShell } from "@/components/admin/shell";
import { api, parseFastTableRow, type FastTableRow } from "@/lib/api-client";
import { faDigits } from "@/lib/format";

type Cell =
  | { kind: "price"; row: FastTableRow }
  | { kind: "stock"; row: FastTableRow }
  | { kind: "call"; row: FastTableRow };

/** dirty-set: «product_id:variant_id|-» → {price?, stock?, is_call_for_price?} */
type EditMap = Map<string, { price?: number; stock?: number; is_call_for_price?: boolean }>;

const rowKey = (r: FastTableRow) => `${r.product_id}:${r.variant_id ?? "-"}`;

export default function FastTable() {
  const [rows, setRows] = useState<FastTableRow[]>([]);
  const [edits, setEdits] = useState<EditMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: 0, c: 1 }); // [row, col] col: 0=stock 1=price
  const [filter, setFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "out" | "low">("all");
  const [bulkOpen, setBulkOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const dirtyCount = edits.size;

  // ---------- Load ----------

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await api.get("/admin/products/fast-table", true);
      setRows(body.rows.map(parseFastTableRow));
      setEdits(new Map());
    } catch (err: any) {
      setError(err?.message ?? "خطا در دریافت لیست");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---------- Effective values (base + dirty overlay) ----------

  const eff = useMemo(() => {
    const map = new Map<string, FastTableRow>();
    for (const r of rows) {
      const e = edits.get(rowKey(r));
      map.set(rowKey(r), e ? { ...r, ...e } : r);
    }
    return map;
  }, [rows, edits]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const out: FastTableRow[] = [];
    for (const r of rows) {
      const e = eff.get(rowKey(r))!;
      if (q && !`${r.title} ${r.brand} ${r.code}`.toLowerCase().includes(q)) continue;
      if (stockFilter === "out" && e.stock > 0) continue;
      if (stockFilter === "low" && e.stock > e.low_threshold) continue;
      out.push(e);
    }
    return out;
  }, [rows, eff, filter, stockFilter]);

  // ویرایش موجودی هم‌زمان ویو ناموجودها را هم به‌روز می‌کند (چون visible از eff می‌سازد)

  // ---------- Dirty tracking ----------

  function applyEdit(row: FastTableRow, patch: Partial<FastTableRow>) {
    setEdits((prev) => {
      const next = new Map(prev);
      const key = rowKey(row);
      const base = next.get(key) ?? {};
      const merged = { ...base, ...patch };
      // اگر با مقدار اصلی برابر شد، از dirty-set حذف (شمارنده دقیق)
      const orig = rows.find((r) => rowKey(r) === key)!;
      if (
        (merged.price === undefined || merged.price === orig.price) &&
        (merged.stock === undefined || merged.stock === orig.stock) &&
        (merged.is_call_for_price === undefined ||
          merged.is_call_for_price === orig.is_call_for_price)
      ) {
        next.delete(key);
      } else {
        next.set(key, merged);
      }
      return next;
    });
  }

  // ---------- Save (Ctrl+S / دکمه) ----------

  const save = useCallback(async () => {
    if (edits.size === 0) return;
    setSaving(true);
    setError(null);
    const items: any[] = [];
    for (const [key, e] of edits) {
      const [pid, vid] = key.split(":");
      items.push({
        id: Number(pid),
        variant_id: vid === "-" ? null : Number(vid),
        ...(e.price !== undefined && { price: e.price }),
        ...(e.stock !== undefined && { stock: e.stock }),
        ...(e.is_call_for_price !== undefined && { is_call_for_price: e.is_call_for_price }),
      });
    }
    try {
      await api.patch("/admin/products/batch-update", items, true);
      // به‌روزرسانی محلی: dirtyها را روی rows اعمال کن و خالی کن
      setRows((prev) =>
        prev.map((r) => {
          const e = edits.get(rowKey(r));
          return e ? { ...r, ...e } : r;
        })
      );
      setEdits(new Map());
    } catch (err: any) {
      setError(err?.message ?? "خطا در ذخیره"); // rollback: edits دست‌نخورده می‌ماند
    } finally {
      setSaving(false);
    }
  }, [edits]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // ---------- Keyboard grid nav (RTL) ----------
  // ↑/↓: ردیف بعد/قبل در همان ستون — ←: فیلد بعدی — →: فیلد قبل — Enter: ردیف بعد

  function focusCell(r: number, c: number) {
    if (r < 0 || r >= visible.length || c < 0 || c > 1) return;
    setFocus({ r, c });
    const cell = gridRef.current?.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
    const input = cell?.querySelector("input");
    input?.focus();
    input?.select();
  }

  function onGridKeyDown(e: React.KeyboardEvent, r: number, c: number) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusCell(r + 1, c);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusCell(r - 1, c);
    } else if (e.key === "Enter") {
      e.preventDefault();
      focusCell(r + 1, c);
    } else if (e.key === "ArrowLeft") {
      // RTL: چپ = فیلد بعدی (قیمت → موجودی → تاگل)
      e.preventDefault();
      if (c === 1) focusCell(r, 0);
      else if (c === 0) {
        const cb = gridRef.current?.querySelector<HTMLInputElement>(
          `td[data-r="${r}"][data-c="2"] input[type="checkbox"]`
        );
        cb?.focus();
      }
    } else if (e.key === "ArrowRight") {
      // RTL: راست = فیلد قبلی
      e.preventDefault();
      if (c === 0) focusCell(r, 1);
    }
  }

  // ---------- Render ----------

  if (loading) {
    return (
      <AdminShell>
        <p className="p-8 text-center text-gray-400">در حال بارگذاری…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
    <div className="space-y-3">
      {/* نوار ابزار */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="جستجو: عنوان، برند، کد…"
          className="w-64 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-brand-500 focus:outline-none"
        />
        <div className="flex overflow-hidden rounded-lg border border-gray-700 text-sm">
          {(
            [
              ["all", "همه"],
              ["out", "ناموجودها"],
              ["low", "کم‌موجودی"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStockFilter(val)}
              className={`px-3 py-2 transition ${
                stockFilter === val ? "bg-brand-500 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setBulkOpen(true)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:border-brand-500"
        >
          قیمت‌گذاری درصدی گروهی
        </button>

        <div className="ms-auto flex items-center gap-3">
          {dirtyCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-400">
              {faDigits(dirtyCount)} تغییر ذخیره‌نشده
            </span>
          )}
          <button
            onClick={save}
            disabled={dirtyCount === 0 || saving}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-40"
          >
            {saving ? "در حال ذخیره…" : "ذخیره همه (Ctrl+S)"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      {/* جدول */}
      <div
        ref={gridRef}
        className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-850/50 text-xs text-gray-400">
              <th className="px-3 py-2.5 text-start font-medium">قطعه</th>
              <th className="px-3 py-2.5 text-start font-medium">قیمت (تومان)</th>
              <th className="px-3 py-2.5 text-start font-medium">موجودی</th>
              <th className="px-3 py-2.5 text-start font-medium">تماس بگیر</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, r) => {
              const isVariant = row.variant_id !== null;
              const key = rowKey(row);
              const edited = edits.has(key);
              const low = row.stock > 0 && row.stock <= row.low_threshold;
              const out = row.stock === 0;
              return (
                <tr
                  key={key}
                  className={`border-b border-gray-800/60 ${
                    out ? "bg-gray-800/30 opacity-60" : low ? "bg-amber-500/5" : ""
                  }`}
                >
                  <td className="px-3 py-1.5">
                    {isVariant ? (
                      <span className="text-gray-400">
                        {row.title}{" "}
                        <span className="text-xs text-gray-500">({row.code})</span>
                      </span>
                    ) : (
                      <div>
                        <div className={edited ? "font-bold text-brand-400" : "font-bold text-white"}>
                          {row.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          {row.brand} · {row.code || "—"}
                        </div>
                      </div>
                    )}
                  </td>
                  <td data-r={r} data-c="1" className="px-3 py-1">
                    <input
                      inputMode="numeric"
                      disabled={row.is_call_for_price}
                      value={row.is_call_for_price ? "—" : row.price === 0 ? "" : faDigits(row.price)}
                      onFocus={(e) => {
                        setFocus({ r, c: 1 });
                        e.currentTarget.select();
                      }}
                      onKeyDown={(e) => onGridKeyDown(e, r, 1)}
                      onChange={(e) => {
                        // ارقام فارسی/لاتین → عدد
                        const persian = "۰۱۲۳۴۵۶۷۸۹";
                        const latin = e.target.value.replace(/[۰-۹]/g, (d) =>
                          String(persian.indexOf(d))
                        );
                        const num = Number(latin.replace(/[^0-9]/g, ""));
                        applyEdit(row, { price: Number.isFinite(num) ? num : 0 });
                      }}
                      className={`w-32 rounded border bg-gray-800 px-2 py-1 text-left tabular-nums outline-none ${
                        edited ? "border-brand-500" : "border-transparent"
                      } focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-gray-500`}
                      dir="ltr"
                    />
                  </td>
                  <td data-r={r} data-c="0" className="px-3 py-1">
                    <input
                      inputMode="numeric"
                      value={row.stock === 0 ? "" : faDigits(row.stock)}
                      onFocus={(e) => {
                        setFocus({ r, c: 0 });
                        e.currentTarget.select();
                      }}
                      onKeyDown={(e) => onGridKeyDown(e, r, 0)}
                      onChange={(e) => {
                        const persian = "۰۱۲۳۴۵۶۷۸۹";
                        const latin = e.target.value.replace(/[۰-۹]/g, (d) =>
                          String(persian.indexOf(d))
                        );
                        const num = Number(latin.replace(/[^0-9]/g, ""));
                        applyEdit(row, { stock: Number.isFinite(num) ? num : 0 });
                      }}
                      className={`w-20 rounded border bg-gray-800 px-2 py-1 text-center tabular-nums outline-none ${
                        out ? "text-red-400" : low ? "text-amber-400" : "text-white"
                      } ${edited ? "border-brand-500" : "border-transparent"} focus:border-brand-500`}
                      dir="ltr"
                    />
                  </td>
                  <td data-r={r} data-c="2" className="px-3 py-1.5">
                    {isVariant ? null : (
                      <input
                        type="checkbox"
                        checked={row.is_call_for_price}
                        onChange={(e) => applyEdit(row, { is_call_for_price: e.target.checked })}
                        onFocus={() => setFocus({ r, c: 2 })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "ArrowDown") {
                            e.preventDefault();
                            focusCell(r + 1, 1);
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            focusCell(r - 1, 1);
                          }
                        }}
                        className="h-4 w-4 accent-brand-500"
                        title="تماس بگیرید"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500">موردی مطابق فیلتر نیست</p>
        )}
      </div>

      {/* دیالوگ درصد گروهی */}
      {bulkOpen && (
        <BulkPercentageDialog
          brands={[...new Set(rows.map((r) => r.brand))]}
          onClose={() => setBulkOpen(false)}
          onDone={(msg) => {
            setBulkOpen(false);
            if (msg) setError(msg); // موفقیت را به شکل toast-ish نشان می‌دهیم
            load();
          }}
        />
      )}
    </div>
    </AdminShell>
  );
}

// ---------- Bulk percentage dialog ----------

function BulkPercentageDialog({
  brands,
  onClose,
  onDone,
}: {
  brands: string[];
  onClose: () => void;
  onDone: (msg: string | null) => void;
}) {
  const [percentage, setPercentage] = useState("10");
  const [brand, setBrand] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.post(
        "/admin/products/bulk-percentage",
        { percentage: Number(percentage), brand: brand || undefined },
        true
      );
      onDone(`قیمت ${faDigits(res.updated)} قطعه به‌روز شد`);
    } catch (e: any) {
      setErr(e?.message ?? "خطا");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-bold text-white">قیمت‌گذاری درصدی گروهی</h2>
        <p className="text-xs text-gray-400">
          درصد مثبت = افزایش، منفی = کاهش. گرد شده به نزدیک‌ترین ۱٬۰۰۰ تومان. تنوع‌های قیمت صریح دست نمی‌خورند.
        </p>
        <label className="block space-y-1">
          <span className="text-sm text-gray-300">درصد</span>
          <input
            inputMode="decimal"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            dir="ltr"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-gray-300">برند</span>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">همه برندها</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
          >
            انصراف
          </button>
          <button
            onClick={apply}
            disabled={busy || !Number.isFinite(Number(percentage))}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-40"
          >
            {busy ? "در حال اعمال…" : "اعمال"}
          </button>
        </div>
      </div>
    </div>
  );
}
