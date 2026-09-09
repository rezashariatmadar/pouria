"""SMS provider integrations.

- ConsoleSms: prints to stdout (dev / tests).
- KavenegarSms: real provider via its verify/lookup endpoint.

Selection via SMS_PROVIDER env (console | kavenegar).
"""
import os
from typing import Protocol

import httpx
from django.conf import settings

KAVENEGAR_BASE_URL = "https://api.kavenegar.com/v1"


class SmsProvider(Protocol):
    """Common shape of every SMS provider."""

    def send_otp(self, phone: str, code: str) -> None:
        ...

    def send_order_confirmation(self, phone: str, order_number: str) -> None:
        ...


class ConsoleSms:
    """Dev provider — codes land in the server log, clearly formatted."""

    def send_otp(self, phone: str, code: str) -> None:
        print(f"\n=== SMS (dev) === شماره: {phone} — کد ورود: {code}\n")

    def send_order_confirmation(self, phone: str, order_number: str) -> None:
        print(f"\n=== SMS (dev) === شماره: {phone} — سفارش {order_number} با موفقیت ثبت و پرداخت شد.\n")


class KavenegarSmsError(Exception):
    pass


class KavenegarSms:
    """Kavenegar verify/lookup — templates must be pre-registered in the panel."""

    def __init__(self, api_key: str | None = None, otp_template: str | None = None):
        self.api_key = api_key or settings.KAVENEGAR_API_KEY
        self.otp_template = otp_template or settings.KAVENEGAR_OTP_TEMPLATE
        # Not part of base settings yet — read env directly so this module
        # works without touching config/settings (owned by another task).
        self.order_template = os.environ.get("KAVENEGAR_ORDER_TEMPLATE", "yadak-order")

    def _lookup(self, phone: str, template: str, token: str) -> None:
        if not self.api_key:
            raise KavenegargSmsError("KAVENEGAR_API_KEY is not set")
        response = httpx.get(
            f"{KAVENEGAR_BASE_URL}/{self.api_key}/verify/lookup.json",
            params={"receptor": phone, "token": token, "template": template},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        if data.get("return", {}).get("status") != 200:
            raise KavenegarSmsError(f"Kavenegar lookup failed: {data}")

    def send_otp(self, phone: str, code: str) -> None:
        self._lookup(phone, self.otp_template, code)

    def send_order_confirmation(self, phone: str, order_number: str) -> None:
        self._lookup(phone, self.order_template, order_number)


def get_sms() -> SmsProvider:
    if settings.SMS_PROVIDER == "kavenegar":
        return KavenegarSms()
    return ConsoleSms()
