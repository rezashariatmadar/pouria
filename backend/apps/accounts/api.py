"""Auth endpoints: admin login + customer OTP login (M4)."""
import hashlib
import re
import secrets

from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.integrations.sms import get_sms
from apps.orders.models import Customer
from .models import OtpCode

router = Router(tags=["auth"])

User = get_user_model()

PHONE_RE = re.compile(r"^09\d{9}$")
OTP_CODE_TTL_MINUTES = 2
OTP_RATE_LIMIT = 3
OTP_RATE_WINDOW_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


class AdminLoginIn(Schema):
    username: str
    password: str


class TokenPairOut(Schema):
    access: str
    refresh: str
    username: str


class CustomerTokenOut(Schema):
    access: str
    refresh: str
    phone: str


class OtpSendIn(Schema):
    phone: str


class OtpVerifyIn(Schema):
    phone: str
    code: str


def _hash_code(phone: str, code: str) -> str:
    return hashlib.sha256(f"{phone}:{code}".encode()).hexdigest()


@router.post("/auth/admin/login", response=TokenPairOut)
def admin_login(request, payload: AdminLoginIn):
    user = authenticate(request, username=payload.username, password=payload.password)
    if user is None or not user.is_staff:
        raise HttpError(401, "نام کاربری یا رمز عبور اشتباه است")
    refresh = RefreshToken.for_user(user)
    return TokenPairOut(
        access=str(refresh.access_token),
        refresh=str(refresh),
        username=user.username,
    )


@router.post("/auth/otp/send")
def otp_send(request, payload: OtpSendIn):
    phone = payload.phone.strip()
    if not PHONE_RE.match(phone):
        raise HttpError(400, "شماره موبایل معتبر نیست (مثال: 09121234567)")

    window_start = timezone.now() - timezone.timedelta(minutes=OTP_RATE_WINDOW_MINUTES)
    recent_count = OtpCode.objects.filter(
        phone_number=phone, created_at__gte=window_start
    ).count()
    if recent_count >= OTP_RATE_LIMIT:
        raise HttpError(429, "درخواست کد بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید")

    code = f"{secrets.randbelow(1000000):06d}"
    OtpCode.objects.create(
        phone_number=phone,
        code_hash=_hash_code(phone, code),
        expires_at=timezone.now() + timezone.timedelta(minutes=OTP_CODE_TTL_MINUTES),
    )
    get_sms().send_otp(phone, code)
    return {"sent": True, "expires_in_seconds": OTP_CODE_TTL_MINUTES * 60}


@router.post("/auth/otp/verify", response=CustomerTokenOut)
def otp_verify(request, payload: OtpVerifyIn):
    phone = payload.phone.strip()
    if not PHONE_RE.match(phone):
        raise HttpError(400, "شماره موبایل معتبر نیست")

    otp = OtpCode.objects.filter(phone_number=phone).order_by("-created_at").first()
    if otp is None:
        raise HttpError(400, "کدی برای این شماره ارسال نشده است")

    if otp.attempts >= OTP_MAX_ATTEMPTS:
        raise HttpError(429, "تعداد تلاش‌های ناموفق زیاد است؛ کد جدید بگیرید")
    otp.attempts += 1
    otp.save(update_fields=["attempts"])

    if timezone.now() > otp.expires_at:
        raise HttpError(400, "کد منقضی شده است؛ کد جدید بگیرید")

    if otp.code_hash != _hash_code(phone, payload.code.strip()):
        raise HttpError(400, "کد وارد شده اشتباه است")

    # با موفقیت، کد مصرف می‌شود.
    otp.delete()

    customer, _ = Customer.objects.get_or_create(phone_number=phone)

    # JWT از روی کاربر سیستم صادر می‌شود (username = شماره موبایل) تا
    # JWTAuth استاندارد بتواند توکن را تایید کند؛ خود مشتری رکورد Customer است.
    user, created = User.objects.get_or_create(username=phone, defaults={"is_staff": False})
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])

    refresh = RefreshToken.for_user(user)
    return CustomerTokenOut(
        access=str(refresh.access_token),
        refresh=str(refresh),
        phone=customer.phone_number,
    )
