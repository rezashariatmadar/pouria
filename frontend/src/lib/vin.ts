/**
 * دیکدر VIN/شاسی — منطق مشترک پروتوتایپ اعتبارسنجی‌شده.
 * پیشوندهای واقعی شاسی‌های ایران‌خودرو/سایپا + سه خروجی:
 * نامعتبر (قرمز) / ناهم‌پلتفرم (کهربایی) / مطابق (سبز).
 */

export const VIN_PATTERN = /^(NAAP|NAAB|NAS)/;

/** پیشوند شاسی → پلتفرم سازنده. */
export const VIN_PREFIX_MAKE: Record<string, "ikco" | "saipa"> = {
  NAAP: "ikco", // پلتفرم ۲۰۶/۲۰۷/پارس/رانا (پژو)
  NAAB: "ikco", // پلتفرم سمند/دنا/تارا (EF7)
  NAS: "saipa", // پلتفرم سایپا (کوئیک/ساینا/شاهین/تیبا)
};

export interface VinResult {
  ok: boolean;
  level: "invalid" | "mismatch" | "match";
  make?: "ikco" | "saipa";
  message: string;
}

/** اعتبارسنجی خام — پیشوند معتبر؟ طول منطقی؟ */
export function validateVin(vin: string): VinResult {
  const v = vin.trim().toUpperCase();
  if (!v) return { ok: false, level: "invalid", message: "" };
  if (!VIN_PATTERN.test(v)) {
    return {
      ok: false,
      level: "invalid",
      message: "قالب شاسی معتبر نیست — شاسی‌های ایران‌خودرو/سایپا با NAAP/NAAB/NAS شروع می‌شوند",
    };
  }
  const make = VIN_PREFIX_MAKE[v.slice(0, 4)];
  return {
    ok: true,
    level: "match",
    make,
    message: make === "ikco" ? "شاسی پلتفرم ایران‌خودرو است" : "شاسی پلتفرم سایپا است",
  };
}

/** اعتبارسنجی نسبت به قطعه: پلتفرم VIN با برندهای سازگار قطعه بخواند؟ */
export function validateVinForPlatform(vin: string, platform: "ikco" | "saipa" | null): VinResult {
  const base = validateVin(vin);
  if (!base.ok) return base;
  if (platform && base.make !== platform) {
    return {
      ok: true,
      level: "mismatch",
      make: base.make,
      message:
        "⚠️ این شاسی متعلق به پلتفرم " +
        (base.make === "ikco" ? "ایران‌خودرو" : "سایپا") +
        " است، اما این قطعه برای " +
        (platform === "ikco" ? "ایران‌خودرو" : "سایپا") +
        " است — لطفاً قبل از خرید استعلام بگیرید",
    };
  }
  return base;
}

/** سه VIN آزمایشی پروتوتایپ — برای دکمه‌های تست سریع. */
export const TEST_VINS = [
  { vin: "NAS411100P1452098", note: "کوئیک — سایپا (مطابق)" },
  { vin: "NAAP411000P123456", note: "۲۰۶ — ایران‌خودرو" },
  { vin: "IRN411100P999999", note: "قالب نامعتبر" },
] as const;
