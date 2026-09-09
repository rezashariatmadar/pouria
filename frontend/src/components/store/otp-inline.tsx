"use client";

/**
 * ورود/عضویت مشتری با OTP — بدون رمز عبور.
 * ۱) شماره موبایل → POST /auth/otp/send
 * ۲) کد ۶ رقمی → POST /auth/otp/verify → ذخیره توکن در sessionStorage و فراخوانی onAuthed
 * توکن‌های مشتری در sessionStorage هستند (ادمین جدا در localStorage).
 */

import { useEffect, useRef, useState, type FormEvent } from "react";

import { api, ApiError } from "@/lib/api-client";
import { faDigits } from "@/lib/format";

const PHONE_PATTERN = /^09\d{9}$/;
const OTP_KEY = "yadak_customer";

export interface CustomerSession {
  access: string;
  refresh: string;
  phone: string;
}

/** خواندن نشست مشتری — فقط سمت کلاینت (sessionStorage). */
export function getCustomer(): CustomerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(OTP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.access && parsed?.phone) return parsed as CustomerSession;
  } catch {
    // JSON خراب — نادیده بگیر
  }
  return null;
}

export function clearCustomer() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(OTP_KEY);
}

export function OtpInline({ onAuthed }: { onAuthed: (s: CustomerSession) => void }) {
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const phoneValid = PHONE_PATTERN.test(phone);

  // شمارش‌معکوس ۶۰ ثانیه‌ای ارسال مجدد
  useEffect(() => {
    if (resendLeft <= 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [resendLeft]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  function startResendTimer() {
    setResendLeft(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setResendLeft((t) => Math.max(0, t - 1)), 1000);
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (!phoneValid || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api.post("/auth/otp/send", { phone });
      setStep("code");
      setCode("");
      startResendTimer();
      setInfo("کد تایید پیامک شد");
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : (err?.message ?? "خطا در ارسال کد"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.post("/auth/otp/verify", { phone, code });
      const session: CustomerSession = {
        access: res.access,
        refresh: res.refresh,
        phone: res.phone ?? phone,
      };
      sessionStorage.setItem(OTP_KEY, JSON.stringify(session));
      onAuthed(session);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : (err?.message ?? "کد تایید نشد"));
    } finally {
      setBusy(false);
    }
  }

  const digitsOnly = (v: string) => v.replace(/[^0-9]/g, "");
  // تبدیل ارقام فارسی/عربی ورودی کاربر به لاتین
  const faToEn = (v: string) =>
    v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
     .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

  return (
    <form
      onSubmit={step === "phone" ? sendCode : verifyCode}
      className="mx-auto w-full max-w-sm space-y-5 rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl"
    >
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 text-2xl">
          📱
        </div>
        <h2 className="text-lg font-bold text-white">
          {step === "phone" ? "ورود / عضویت" : "کد تایید را وارد کنید"}
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          {step === "phone"
            ? "برای ادامه خرید شماره موبایل خود را وارد کنید"
            : `کد ۶ رقمی ارسال‌شده به ${phone}`}
        </p>
      </div>

      {step === "phone" ? (
        <label className="block space-y-1.5">
          <span className="text-sm text-gray-300">شماره موبایل</span>
          <input
            value={phone}
            onChange={(e) => setPhone(digitsOnly(faToEn(e.target.value)).slice(0, 11))}
            onBlur={() => setPhoneTouched(true)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="۰۹۱۲۳۴۵۶۷۸۹"
            dir="ltr"
            required
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-center tracking-widest text-white placeholder:text-gray-600 outline-none focus:border-brand-500"
          />
          {phoneTouched && phone.length > 0 && !phoneValid && (
            <span className="block text-xs text-red-400">
              شماره موبایل معتبر نیست — با ۰۹ شروع شود و ۱۱ رقم باشد
            </span>
          )}
          {phoneValid && (
            <span className="block text-xs text-emerald-400">شماره معتبر است</span>
          )}
        </label>
      ) : (
        <>
          <label className="block space-y-1.5">
            <span className="text-sm text-gray-300">کد تایید ۶ رقمی</span>
            <input
              value={code}
              onChange={(e) => setCode(digitsOnly(faToEn(e.target.value)).slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="––––––"
              dir="ltr"
              required
              autoFocus
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-center text-2xl tracking-[0.5em] text-white placeholder:text-gray-600 outline-none focus:border-brand-500"
            />
          </label>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
                setInfo(null);
              }}
              className="text-gray-400 hover:text-gray-200"
            >
              ← تغییر شماره
            </button>
            <span className={resendLeft > 0 ? "text-gray-500" : "text-brand-400"}>
              {resendLeft > 0
                ? `ارسال مجدد تا ${faDigits(resendLeft)} ثانیه دیگر`
                : ""}
            </span>
            {resendLeft === 0 && (
              <button
                type="button"
                onClick={() => sendCode()}
                disabled={busy}
                className="text-brand-400 hover:text-brand-300 disabled:opacity-50"
              >
                ارسال مجدد کد
              </button>
            )}
          </div>
        </>
      )}

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      {info && step === "code" && !error && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{info}</p>
      )}

      <button
        type="submit"
        disabled={busy || (step === "phone" ? !phoneValid : code.length !== 6)}
        className="w-full rounded-lg bg-brand-500 py-2.5 font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
      >
        {busy
          ? "لطفاً صبر کنید…"
          : step === "phone"
            ? "دریافت کد"
            : "تایید"}
      </button>
    </form>
  );
}
