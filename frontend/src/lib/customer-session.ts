/**
 * نشست مشتری (OTP) — توکن در sessionStorage (ادمین جدا، در localStorage).
 * ماژول مستقل از کامپوننت‌ها تا api-client هم بتواند آن را بخواند.
 */

const CUSTOMER_KEY = "yadak_customer";

export interface CustomerSession {
  access: string;
  refresh: string;
  phone: string;
}

/** خواندن نشست مشتری — فقط سمت کلاینت (sessionStorage). */
export function getCustomer(): CustomerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CUSTOMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.access && parsed?.phone) return parsed as CustomerSession;
  } catch {
    // JSON خراب — نادیده بگیر
  }
  return null;
}

export function setCustomer(session: CustomerSession) {
  sessionStorage.setItem(CUSTOMER_KEY, JSON.stringify(session));
}

export function clearCustomer() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CUSTOMER_KEY);
}
