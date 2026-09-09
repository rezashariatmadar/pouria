"""OTP login tests: send/verify happy path, rate limit, wrong code, attempts."""
import json

import pytest
from django.test import Client

from apps.accounts.api import _hash_code
from apps.accounts.models import OtpCode
from apps.orders.models import Customer

pytestmark = pytest.mark.django_db

PHONE = "09121234567"


def _post(client, url, data):
    return client.post(url, data=json.dumps(data), content_type="application/json")


@pytest.fixture(autouse=True)
def _clear_mock_gateway():
    from apps.integrations.gateways import MockGateway

    MockGateway.payments = {}
    MockGateway._next_id = 0


def test_otp_send_creates_hashed_code(capsys):
    client = Client()
    resp = _post(client, "/api/v1/auth/otp/send", {"phone": PHONE})
    assert resp.status_code == 200
    body = resp.json()
    assert body["sent"] is True
    assert body["expires_in_seconds"] == 120

    otp = OtpCode.objects.get(phone_number=PHONE)
    # only the hash is stored — never the code itself
    assert len(otp.code_hash) == 64
    assert otp.attempts == 0

    # ConsoleSms printed the code for dev
    out = capsys.readouterr().out
    assert "SMS" in out
    code = out.split("کد ورود: ")[1].strip().split("\n")[0]
    assert code.isdigit() and len(code) == 6
    assert otp.code_hash == _hash_code(PHONE, code)


def test_otp_send_rejects_invalid_phone():
    client = Client()
    for bad in ["0912123456", "9121234567", "0912123456a", "091212345678", ""]:
        resp = _post(client, "/api/v1/auth/otp/send", {"phone": bad})
        assert resp.status_code == 400, bad


def test_otp_rate_limit_blocks_fourth_send():
    client = Client()
    for _ in range(3):
        resp = _post(client, "/api/v1/auth/otp/send", {"phone": PHONE})
        assert resp.status_code == 200
    resp = _post(client, "/api/v1/auth/otp/send", {"phone": PHONE})
    assert resp.status_code == 429
    assert OtpCode.objects.filter(phone_number=PHONE).count() == 3


def test_otp_verify_happy_path_issues_tokens():
    client = Client()
    assert _post(client, "/api/v1/auth/otp/send", {"phone": PHONE}).status_code == 200

    otp = OtpCode.objects.get(phone_number=PHONE)
    # recover the code via a matching hash (ConsoleSms keeps dev honest)
    code = None
    for i in range(1000000):
        if _hash_code(PHONE, f"{i:06d}") == otp.code_hash:
            code = f"{i:06d}"
            break
    assert code is not None

    resp = _post(client, "/api/v1/auth/otp/verify", {"phone": PHONE, "code": code})
    assert resp.status_code == 200
    body = resp.json()
    assert body["phone"] == PHONE
    assert body["access"] and body["refresh"]

    # customer created, OTP consumed
    assert Customer.objects.filter(phone_number=PHONE).exists()
    assert not OtpCode.objects.filter(phone_number=PHONE).exists()


def test_otp_verify_wrong_code_rejected():
    client = Client()
    _post(client, "/api/v1/auth/otp/send", {"phone": PHONE})

    resp = _post(client, "/api/v1/auth/otp/verify", {"phone": PHONE, "code": "000000"})
    assert resp.status_code == 400
    otp = OtpCode.objects.get(phone_number=PHONE)
    assert otp.attempts == 1
    assert not Customer.objects.filter(phone_number=PHONE).exists()


def test_otp_verify_max_attempts_exhausts_code():
    client = Client()
    _post(client, "/api/v1/auth/otp/send", {"phone": PHONE})
    for _ in range(5):
        resp = _post(client, "/api/v1/auth/otp/verify", {"phone": PHONE, "code": "000000"})
        assert resp.status_code == 400
    # 6th attempt — even with the right code — is locked out
    otp = OtpCode.objects.get(phone_number=PHONE)
    code = next(
        f"{i:06d}" for i in range(1000000) if _hash_code(PHONE, f"{i:06d}") == otp.code_hash
    )
    resp = _post(client, "/api/v1/auth/otp/verify", {"phone": PHONE, "code": code})
    assert resp.status_code == 429


def test_otp_verify_without_send_fails():
    client = Client()
    resp = _post(client, "/api/v1/auth/otp/verify", {"phone": PHONE, "code": "123456"})
    assert resp.status_code == 400
