import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted Vazirmatn (OFL license) — Google Fonts is unreachable from Iran,
// so the font is vendored in-repo and served by Next.js itself.
const vazirmatn = localFont({
  src: "../fonts/vazirmatn-variable.woff2",
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "یدک‌پرو | قطعات یدکی ایران‌خودرو و سایپا",
    template: "%s | یدک‌پرو",
  },
  description:
    "خرید آنلاین قطعات یدکی اصلی خودروهای ایران‌خودرو و سایپا با تایید شاسی، قیمت روز و ارسال سریع به سراسر ایران",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
