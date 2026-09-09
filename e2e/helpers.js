/**
 * Shared helpers for the YadakPro E2E suite.
 *
 * - Direct backend API access (admin login, fast-table, orders) so tests can
 *   seed/verify state without going through the UI every time.
 * - OTP extraction: the backend prints the SMS code to its console, which the
 *   test runner cannot read. OtpCode stores only sha256(f"{phone}:{code}"), so
 *   we brute-force the 6-digit space through the Django shell against the
 *   newest row for the phone (~1s).
 * - Persian number formatting matching the app's lib/format.ts.
 */
const { execFileSync } = require("child_process");

const API_BASE = process.env.E2E_API_URL || "http://localhost:8000";
const ADMIN_USERNAME = "pouria";
const ADMIN_PASSWORD = "YadakSm0ke!";

const BACKEND_DIR = "/home/dante/Work/pouria/backend";
const DJANGO_PY = `${BACKEND_DIR}/.venv/bin/python`;
const DJANGO_MANAGE = `${BACKEND_DIR}/manage.py`;
const DB_URL = "sqlite:////tmp/yadak-smoke.sqlite";

/** Persian digits with grouping — same as frontend lib/format.ts faDigits(). */
const faNumber = new Intl.NumberFormat("fa-IR", { useGrouping: true });
const faDigits = (n) => faNumber.format(n);
/** «۸۹۰٬۰۰۰ تومان» — same as frontend lib/format.ts toman(). */
const toman = (n) => `${faNumber.format(n)} تومان`;

/** Minimal typed fetch against the Django API. */
async function apiFetch(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  const data = text ? JSON.parse(text) : null;
  if (!resp.ok) {
    throw new Error(`${method} ${path} → HTTP ${resp.status}: ${text.slice(0, 300)}`);
  }
  return data;
}

/** POST /auth/admin/login → { access, refresh, username }. */
async function adminLogin() {
  return apiFetch("/auth/admin/login", {
    method: "POST",
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  });
}

/** GET /admin/products/fast-table parsed into row objects. */
async function fastTableRows(token) {
  const t = token || (await adminLogin()).access;
  const body = await apiFetch("/admin/products/fast-table", { token: t });
  return body.rows.map((r) => ({
    product_id: r[0],
    title: r[1],
    brand: r[2],
    code: r[3],
    price: r[4],
    stock: r[5],
    is_call_for_price: r[6],
    low_threshold: r[7],
    variant_id: r[8],
  }));
}

/**
 * Recover the OTP code the backend just "SMS-ed" for `phone`.
 * OtpCode.code_hash = sha256(f"{phone}:{code}") — try 000000..999999.
 */
function getOtpCode(phone) {
  const script = `
import hashlib
from apps.accounts.models import OtpCode
phone = ${JSON.stringify(phone)}
otp = OtpCode.objects.filter(phone_number=phone).order_by("-created_at").first()
code = None
if otp is not None:
    target = otp.code_hash
    for i in range(1000000):
        c = "%06d" % i
        if hashlib.sha256((phone + ":" + c).encode()).hexdigest() == target:
            code = c
            break
print("OTP=" + str(code))
`;
  const out = execFileSync(DJANGO_PY, [DJANGO_MANAGE, "shell", "--settings=config.settings.dev", "-c", script], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: DB_URL },
    timeout: 120_000,
  }).toString();
  const m = out.match(/OTP=(\d{6})/);
  if (!m) throw new Error(`could not extract OTP for ${phone}; shell said:\n${out}`);
  return m[1];
}

/**
 * Delete every still-active cart hold (test residue: a failed checkout run
 * leaves its 15-minute hold behind, which lowers `available` for the next run).
 */
function clearActiveHolds() {
  const script = `
from django.utils import timezone
from apps.orders.models import CartHold
deleted, _ = CartHold.objects.filter(expires_at__gt=timezone.now()).delete()
print("DELETED=" + str(deleted))
`;
  const out = execFileSync(DJANGO_PY, [DJANGO_MANAGE, "shell", "--settings=config.settings.dev", "-c", script], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: DB_URL },
    timeout: 60_000,
  }).toString();
  return Number(out.match(/DELETED=(\d+)/)?.[1] ?? 0);
}

module.exports = {
  API_BASE,
  faDigits,
  toman,
  apiFetch,
  adminLogin,
  fastTableRows,
  getOtpCode,
  clearActiveHolds,
};
