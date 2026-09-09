/** API client — fetch + JWT. Admin token را در localStorage نگه می‌داریم (سینگل‌superuser MVP).
 *
 * Customer tokens (M4): access در حافظه، refresh در httpOnly cookie از طریق /auth/token.
 */

import { clearCustomer, getCustomer } from "@/lib/customer-session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const ADMIN_TOKEN_KEY = "yadak_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function parse(resp: Response): Promise<any> {
  if (resp.status === 204) return null;
  const text = await resp.text();
  const body = text ? JSON.parse(text) : null;
  if (!resp.ok) {
    // پیام‌های خطای نینجا: {"detail": "..."} — فارسی را مستقیم نشان بده
    const detail = body?.detail ?? body?.message ?? `خطای ${resp.status}`;
    throw new ApiError(resp.status, String(detail));
  }
  return body;
}

/**
 * حالت احراز هویت: false = عمومی، true/"admin" = توکن ادمین (localStorage)،
 * "customer" = توکن OTP مشتری (sessionStorage — lib/customer-session).
 */
export type AuthMode = false | true | "admin" | "customer";

async function request(method: string, path: string, body?: unknown, auth: AuthMode = false): Promise<any> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const isAdmin = auth === true || auth === "admin";
  if (isAdmin) {
    const token = getAdminToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } else if (auth === "customer") {
    const token = getCustomer()?.access ?? null;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let resp = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  // توکن منقضی یا نامعتبر؟ پاک کن و بفرست به لاگین (M4: refresh endpoint برای مشتری‌ها)
  if (resp.status === 401 && auth) {
    if (isAdmin) {
      setAdminToken(null);
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new ApiError(401, "نشست شما منقضی شد — دوباره وارد شوید");
    }
    clearCustomer();
    throw new ApiError(401, "نشست شما منقضی شد — دوباره وارد شوید");
  }

  return parse(resp);
}

export const api = {
  get: (path: string, auth: AuthMode = false) => request("GET", path, undefined, auth),
  post: (path: string, body?: unknown, auth: AuthMode = false) => request("POST", path, body, auth),
  patch: (path: string, body?: unknown, auth: AuthMode = false) => request("PATCH", path, body, auth),
  auth: {
    adminLogin: (username: string, password: string) =>
      request("POST", "/auth/admin/login", { username, password }),
  },
};

/** تایپ‌های مشترک API. */
export interface FastTableRow {
  product_id: number;
  title: string;
  brand: string;
  code: string;
  price: number;
  stock: number;
  is_call_for_price: boolean;
  low_threshold: number;
  variant_id: number | null;
}

export function parseFastTableRow(r: any[]): FastTableRow {
  return {
    product_id: r[0], title: r[1], brand: r[2], code: r[3], price: r[4],
    stock: r[5], is_call_for_price: r[6], low_threshold: r[7], variant_id: r[8],
  };
}
