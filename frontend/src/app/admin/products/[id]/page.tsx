"use client";

import { useEffect, useState } from "react";

import { AdminShell } from "@/components/admin/shell";
import { ProductForm, type ProductDraft } from "@/components/admin/product-form";
import { api } from "@/lib/api-client";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const [initial, setInitial] = useState<ProductDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<number | null>(null);

  useEffect(() => {
    params.then(({ id: idStr }) => {
      const pid = Number(idStr);
      setId(pid);
      api
        .get(`/admin/products/${pid}`, true)
        .then((p: any) => {
          setInitial({
            title: p.title,
            brand: p.brand,
            category_slug: p.category_slug,
            part_number: p.part_number ?? "",
            isaco_code: p.isaco_code ?? "",
            price: p.price,
            stock: p.stock,
            is_call_for_price: p.is_call_for_price,
            max_order_quantity: p.max_order_quantity,
            low_stock_threshold: p.low_stock_threshold,
            warranty_text: p.warranty_text,
            is_genuine: p.is_genuine,
            description: p.description ?? "",
            model_slugs: p.model_slugs ?? [],
            variants: (p.variants ?? []).map((v: any) => ({
              id: v.id,
              name: v.name,
              sku_modifier: v.sku_modifier ?? "",
              price_override: v.price_override,
              stock: v.stock,
              is_default: v.is_default,
            })),
          });
        })
        .catch((e: any) => setError(e?.message ?? "خطا در دریافت قطعه"));
    });
  }, [params]);

  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-bold text-white">ویرایش قطعه</h1>
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      {initial ? (
        <ProductForm productId={id ?? undefined} initial={initial} />
      ) : (
        !error && <p className="text-gray-400">در حال بارگذاری…</p>
      )}
    </AdminShell>
  );
}
