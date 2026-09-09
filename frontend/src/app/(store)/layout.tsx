import type { ReactNode } from "react";

import { StoreFooter } from "@/components/store/footer";
import { StoreHeader } from "@/components/store/header";

/** چیدمان فروشگاه — هدر چسبان + فوتر اعتماد. */
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-gray-950 text-gray-100">
      <StoreHeader />
      <main className="flex-1">{children}</main>
      <StoreFooter />
    </div>
  );
}
