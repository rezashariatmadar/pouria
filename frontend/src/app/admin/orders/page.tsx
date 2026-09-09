"use client";

/**
 * کارتابل سفارش‌ها: کارت‌های آمار، فیلتر وضعیت، جستجو، جعبه استعلام VIN،
 * تغییر وضعیت، و فاکتور قابل چاپ با CSS پرینت.
 */

import { useCallback, useEffect, useState } from "react";

import { AdminShell } from "@/components/admin/shell";
import { api } from "@/lib/api-client";
import { faDateTime, faDigits, toman } from "@/lib/format";

interface OrderLine {
  title: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface AdminOrder {
  id: number;
  order_number: string;
  status: string;
  status_display: string;
  shipping_method_display: string;
  customer: { phone_number: string; full_name: string };
  vin_or_chassis: string;
  vin_verified: boolean | null;
  admin_verification_note: string;
  customer_note: string;
  shipping_address: string;
  postal_code: string;
  subtotal: number;
  shipping_cost: number;
  total_amount: number;
  payment_tracking_code: string;
  shipping_tracking_code: string;
  created_at: string;
  lines: OrderLine[];
}

const STATUS_FLOW = [
  ["pending_payment", "در انتظار پرداخت"],
  ["paid", "پرداخت‌شده"],
  ["processing", "در حال پردازش"],
  ["shipped", "ارسال‌شده"],
  ["delivered", "تحویل‌شده"],
  ["cancelled", "لغو‌شده"],
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  paid: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  processing: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  shipped: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      params.set("page", String(page));
      const body = await api.get(`/admin/orders?${params}`, true);
      setOrders(body.items);
      setStats(body.stats);
      setTotal(body.total);
    } catch (e: any) {
      setError(e?.message ?? "خطا در دریافت سفارش‌ها");
    } finally {
      setLoading(false);
    }
  }, [status, q, page]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce جستجو
    return () => clearTimeout(t);
  }, [load]);

  async function openDetail(id: number) {
    try {
      setSelected(await api.get(`/admin/orders/${id}`, true));
    } catch (e: any) {
      setError(e?.message ?? "خطا");
    }
  }

  async function changeStatus(order: AdminOrder, newStatus: string) {
    try {
      await api.post(`/admin/orders/${order.id}/status`, { status: newStatus }, true);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o))
      );
      if (selected?.id === order.id) {
        setSelected({ ...selected, status: newStatus });
        // status_display هم به‌روز کن
        const display = STATUS_FLOW.find(([v]) => v === newStatus)?.[1] ?? newStatus;
        setSelected((s) => (s ? { ...s, status_display: display } : s));
      }
      load(); // آمار کارت‌ها تغییر می‌کند
    } catch (e: any) {
      setError(e?.message ?? "خطا");
    }
  }

  const STAT_CARDS = [
    { key: "new_orders", label: "سفارش جدید", icon: "🆕" },
    { key: "awaiting_vin", label: "در انتظار استعلام VIN", icon: "🔍" },
    { key: "packing", label: "در حال بسته‌بندی", icon: "📦" },
    { key: "shipped_today", label: "ارسال‌شده", icon: "🚚" },
  ];

  return (
    <AdminShell>
      <div className="space-y-4">
        {/* کارت‌های آمار */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STAT_CARDS.map((c) => (
            <div key={c.key} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>{c.icon}</span> {c.label}
              </div>
              <div className="mt-1 text-2xl font-bold text-white">
                {faDigits(stats[c.key] ?? 0)}
              </div>
            </div>
          ))}
        </div>

        {/* فیلترها */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => { setStatus(""); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                status === "" ? "bg-brand-500 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              همه
            </button>
            {STATUS_FLOW.map(([value, label]) => (
              <button
                key={value}
                onClick={() => { setStatus(value); setPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  status === value ? "bg-brand-500 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="جستجو: شماره سفارش، موبایل، VIN…"
            className="w-64 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-brand-500 focus:outline-none"
          />
          <span className="ms-auto text-sm text-gray-500">
            {faDigits(total)} سفارش
          </span>
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        {/* جدول سفارش‌ها */}
        {loading ? (
          <p className="p-8 text-center text-gray-400">در حال بارگذاری…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-400">
                  <th className="px-3 py-2.5 text-start font-medium">شماره سفارش</th>
                  <th className="px-3 py-2.5 text-start font-medium">مشتری</th>
                  <th className="px-3 py-2.5 text-start font-medium">مبلغ</th>
                  <th className="px-3 py-2.5 text-start font-medium">VIN</th>
                  <th className="px-3 py-2.5 text-start font-medium">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => openDetail(o.id)}
                    className="cursor-pointer border-b border-gray-800/60 hover:bg-gray-800/50"
                  >
                    <td className="px-3 py-2.5 font-mono text-white" dir="ltr">{o.order_number}</td>
                    <td className="px-3 py-2.5">
                      <div className="text-gray-200">{o.customer.phone_number}</div>
                      {o.customer.full_name && (
                        <div className="text-xs text-gray-500">{o.customer.full_name}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-200" dir="ltr">{toman(o.total_amount)}</td>
                    <td className="px-3 py-2.5">
                      {o.vin_or_chassis ? (
                        o.vin_verified ? (
                          <span className="text-emerald-400" title={o.admin_verification_note}>✓ تایید</span>
                        ) : (
                          <span className="text-amber-400" title="در انتظار استعلام">؟ استعلام</span>
                        )
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full border px-2.5 py-1 text-xs ${STATUS_COLORS[o.status] ?? ""}`}>
                        {o.status_display}
                      </span>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">سفارشی نیست</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* صفحه‌بندی */}
        {total > 20 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: Math.ceil(total / 20) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`h-8 w-8 rounded-lg text-sm ${
                  p === page ? "bg-brand-500 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {faDigits(p)}
              </button>
            ))}
          </div>
        )}

        {/* دیالوگ جزئیات */}
        {selected && (
          <OrderDetailDialog
            order={selected}
            onClose={() => setSelected(null)}
            onStatus={(s) => changeStatus(selected, s)}
          />
        )}
      </div>
    </AdminShell>
  );
}

// ---------- Detail dialog with VIN box + invoice print ----------

function OrderDetailDialog({
  order,
  onClose,
  onStatus,
}: {
  order: AdminOrder;
  onClose: () => void;
  onStatus: (s: string) => void;
}) {
  const [vinNote, setVinNote] = useState(order.admin_verification_note);
  const [vinBusy, setVinBusy] = useState(false);
  const [vinState, setVinState] = useState<string | null>(null);

  async function verify(verified: boolean) {
    setVinBusy(true);
    try {
      await api.post(
        `/admin/orders/${order.id}/vin-verify`,
        { verified, note: vinNote },
        true
      );
      setVinState(verified ? "confirmed" : "contact");
    } catch (e: any) {
      setVinState(`خطا: ${e?.message ?? ""}`);
    } finally {
      setVinBusy(false);
    }
  }

  const vinVerified = order.vin_verified || vinState === "confirmed";
  const vinNeedsContact = vinState === "contact";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="invoice-dialog max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* سرصفحه */}
        <div className="mb-4 flex items-start justify-between print:mb-2">
          <div>
            <h2 className="text-lg font-bold text-white print:text-black" dir="ltr">
              {order.order_number}
            </h2>
            <p className="text-sm text-gray-500">{faDateTime(order.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <span className={`rounded-full border px-2.5 py-1 text-xs ${STATUS_COLORS[order.status] ?? ""}`}>
              {order.status_display}
            </span>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800">✕</button>
          </div>
        </div>

        {/* جعبه استعلام VIN — قلب دوم یدک‌پرو */}
        {order.vin_or_chassis && (
          <div className={`mb-4 rounded-xl border p-4 print:hidden ${
            vinVerified
              ? "border-emerald-500/40 bg-emerald-500/5"
              : vinNeedsContact
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-gray-700 bg-gray-800/50"
          }`}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-bold text-gray-200">استعلام شاسی (VIN)</span>
              {vinVerified && <span className="text-emerald-400">✓ تایید کارشناس</span>}
              {vinNeedsContact && <span className="text-amber-400">⚠ نیاز به تماس</span>}
            </div>
            <div className="mb-3 rounded-lg bg-gray-950 px-3 py-2 font-mono text-sm tracking-widest text-gray-200" dir="ltr">
              {order.vin_or_chassis}
            </div>
            <textarea
              value={vinNote}
              onChange={(e) => setVinNote(e.target.value)}
              placeholder="یادداشت استعلام: با تیپ ۵ سازگار است / VIN با خودرو مطابقت ندارد…"
              rows={2}
              className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-brand-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => verify(true)}
                disabled={vinBusy}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                ✓ تایید سازگاری
              </button>
              <button
                onClick={() => verify(false)}
                disabled={vinBusy}
                className="rounded-lg border border-amber-500/50 px-4 py-2 text-sm text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
              >
                ⚠ نیاز به تماس با مشتری
              </button>
            </div>
          </div>
        )}

        {/* اطلاعات مشتری و ارسال */}
        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-gray-800/50 p-3">
            <div className="text-xs text-gray-500">مشتری</div>
            <div className="mt-1 text-gray-200" dir="ltr">{order.customer.phone_number}</div>
            {order.customer.full_name && <div className="text-gray-400">{order.customer.full_name}</div>}
          </div>
          <div className="rounded-lg bg-gray-800/50 p-3">
            <div className="text-xs text-gray-500">روش ارسال</div>
            <div className="mt-1 text-gray-200">{order.shipping_method_display}</div>
          </div>
          {order.shipping_address && (
            <div className="col-span-2 rounded-lg bg-gray-800/50 p-3 print:bg-white">
              <div className="text-xs text-gray-500">آدرس</div>
              <div className="mt-1 text-gray-200 print:text-black">{order.shipping_address}</div>
              {order.postal_code && (
                <div className="text-gray-500" dir="ltr">کد پستی: {order.postal_code}</div>
              )}
            </div>
          )}
        </div>

        {/* اقلام (فاکتور) */}
        <table className="mb-4 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-xs text-gray-500">
              <th className="py-2 text-start font-medium">قطعه</th>
              <th className="py-2 text-center font-medium">تعداد</th>
              <th className="py-2 text-start font-medium">قیمت واحد</th>
              <th className="py-2 text-start font-medium">جمع</th>
            </tr>
          </thead>
          <tbody className="text-gray-200 print:text-black">
            {order.lines.map((line, i) => (
              <tr key={i} className="border-b border-gray-800/60 print:border-gray-300">
                <td className="py-2">{line.title}</td>
                <td className="py-2 text-center">{faDigits(line.quantity)}</td>
                <td className="py-2" dir="ltr">{toman(line.unit_price)}</td>
                <td className="py-2" dir="ltr">{toman(line.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-2 text-start text-gray-500 print:text-black">جمع اقلام</td>
              <td className="pt-2 text-gray-300 print:text-black" dir="ltr">{toman(order.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="text-start text-gray-500 print:text-black">هزینه ارسال</td>
              <td className="text-gray-300 print:text-black" dir="ltr">{toman(order.shipping_cost)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="text-start font-bold text-white print:text-black">مبلغ کل</td>
              <td className="font-bold text-white print:text-black" dir="ltr">{toman(order.total_amount)}</td>
            </tr>
          </tfoot>
        </table>

        {order.customer_note && (
          <div className="mb-4 rounded-lg bg-amber-500/5 p-3 text-sm text-amber-200/90">
            <span className="font-bold">یادداشت مشتری: </span>{order.customer_note}
          </div>
        )}

        {/* اقدامات */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <label className="text-sm text-gray-400">تغییر وضعیت:</label>
          <select
            value={order.status}
            onChange={(e) => onStatus(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          >
            {STATUS_FLOW.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {order.shipping_tracking_code && (
            <span className="text-sm text-gray-400" dir="ltr">
              کد رهگیری: {order.shipping_tracking_code}
            </span>
          )}
          <button
            onClick={() => window.print()}
            className="ms-auto rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-brand-500"
          >
            🖨 چاپ فاکتور
          </button>
        </div>

        {vinState && vinState.startsWith("خطا") && (
          <p className="mt-3 text-sm text-red-400">{vinState}</p>
        )}
      </div>
    </div>
  );
}
