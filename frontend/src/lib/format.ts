/** قالب‌بندی فارسی — دقیقاً مثل پروتوتایپ اعتبارسنجی‌شده. */

const faNumber = new Intl.NumberFormat("fa-IR", { useGrouping: true });
const faNumberNoGroup = new Intl.NumberFormat("fa-IR", { useGrouping: false });

/** ۸۹۰۰۰۰ → «۸۹۰,۰۰۰ تومان» (ارقام فارسی، جداکننده هزارگان). */
export function toman(amount: number): string {
  return `${faNumber.format(amount)} تومان`;
}

/** فقط ارقام فارسی بدون واحد — برای گرید قیمت ادمین (خوانایی سریع‌تر). */
export function faDigits(n: number): string {
  return faNumber.format(n);
}

/** تاریخ سفارش به شمسی و فارسی. */
const faDate = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function faDateTime(iso: string): string {
  return faDate.format(new Date(iso));
}

/** «۲ دقیقه» باقی‌مانده رزرو سبد — برای شمارش‌معکوس ۱۵ دقیقه‌ای. */
export function minutesLeft(expiresAt: number): string {
  const secs = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const mins = Math.ceil(secs / 60);
  return `${faNumberNoGroup.format(mins)} دقیقه`;
}
