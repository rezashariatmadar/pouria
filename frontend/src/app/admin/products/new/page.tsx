"use client";

import { AdminShell } from "@/components/admin/shell";
import { ProductForm } from "@/components/admin/product-form";

export default function NewProductPage() {
  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-bold text-white">قطعه جدید</h1>
      <ProductForm />
    </AdminShell>
  );
}
