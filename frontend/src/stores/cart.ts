/**
 * سبد خرید — Zustand + persist به localStorage.
 * آیتم‌ها فقط {product_id, variant_id?, qty} هستند؛ قیمت‌ها هرگز از کلاینت
 * اعتماد نمی‌شوند — همیشه سمت سرور در checkout از قیمت‌های فعلی محاسبه می‌شوند.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  product_id: number;
  variant_id: number | null;
  qty: number;
  /** فقط برای نمایش — منبع حقیقت قیمت سرور است. */
  display?: {
    title: string;
    variant_name?: string;
    price: number;
    image?: string | null;
    max_qty: number;
  };
}

interface CartState {
  items: CartItem[];
  add: (item: CartItem) => void;
  setQty: (product_id: number, variant_id: number | null, qty: number) => void;
  remove: (product_id: number, variant_id: number | null) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      add: (item) =>
        set((s) => {
          const i = s.items.findIndex(
            (x) => x.product_id === item.product_id && x.variant_id === item.variant_id
          );
          if (i === -1) return { items: [...s.items, item] };
          // سقف تعداد را نمایشی چک می‌کنیم؛ سرور در checkout مجدد اعمال می‌کند
          const max = s.items[i].display?.max_qty ?? 99;
          const items = [...s.items];
          items[i] = { ...items[i], qty: Math.min(items[i].qty + item.qty, max) };
          return { items };
        }),

      setQty: (product_id, variant_id, qty) =>
        set((s) => ({
          items: qty <= 0
            ? s.items.filter((x) => !(x.product_id === product_id && x.variant_id === variant_id))
            : s.items.map((x) =>
                x.product_id === product_id && x.variant_id === variant_id ? { ...x, qty } : x
              ),
        })),

      remove: (product_id, variant_id) =>
        set((s) => ({
          items: s.items.filter((x) => !(x.product_id === product_id && x.variant_id === variant_id)),
        })),

      clear: () => set({ items: [] }),
    }),
    { name: "yadak_cart" }
  )
);
