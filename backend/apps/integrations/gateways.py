"""Payment gateway integrations.

Two implementations:
- MockGateway: full local loop with no external dependency — the payment page
  is a frontend page and the "callback" is the /checkout/mock-pay endpoint.
- ZibalGateway: real gateway (sandbox merchant "zibal" needs no account).

Selection via PAYMENT_PROVIDER env (mock | zibal).
"""
from typing import Protocol

import httpx
from django.conf import settings

ZIBAL_BASE_URL = "https://gateway.zibal.ir/v1"


class PaymentGateway(Protocol):
    """Common shape of every payment provider."""

    def request_payment(self, amount_rial: int, order_number: str, callback_url: str) -> tuple[str, str]:
        """Start a payment. Returns (payment_url, track_id)."""
        ...

    def verify(self, track_id: str) -> dict:
        """Verify a payment. Returns {status: int, paid: bool, ref_id: str}."""
        ...


class MockGateway:
    """Local mock — payments live in a module-level dict keyed by track_id.

    The flow: request_payment returns a frontend mock-payment page URL with
    track_id + order number in the query string. That page (or the test) calls
    POST /checkout/mock-pay {track_id, success} to simulate the bank callback.
    """

    # track_id -> {"paid": bool, "ref_id": str}
    payments: dict = {}
    _next_id = 0

    def request_payment(self, amount_rial: int, order_number: str, callback_url: str) -> tuple[str, str]:
        MockGateway._next_id += 1
        track_id = f"mock-{MockGateway._next_id}"
        MockGateway.payments[track_id] = {"paid": False, "ref_id": "", "amount_rial": amount_rial}
        url = (
            f"{settings.FRONTEND_URL}/mock-payment"
            f"?track_id={track_id}&order={order_number}"
        )
        return url, track_id

    def verify(self, track_id: str) -> dict:
        payment = MockGateway.payments.get(track_id)
        if payment is None:
            return {"status": 404, "paid": False, "ref_id": ""}
        if payment["paid"]:
            return {"status": 100, "paid": True, "ref_id": payment["ref_id"]}
        return {"status": -1, "paid": False, "ref_id": ""}

    @classmethod
    def mark_paid(cls, track_id: str, success: bool) -> str | None:
        """Called by the /checkout/mock-pay endpoint to simulate the bank."""
        payment = cls.payments.get(track_id)
        if payment is None:
            return None
        if success:
            payment["paid"] = True
            payment["ref_id"] = f"ref-{track_id}"
        return track_id


class ZibalGateway:
    """Zibal — https://gateway.zibal.ir — sandbox merchant is "zibal"."""

    def __init__(self, merchant: str | None = None):
        self.merchant = merchant or settings.ZIBAL_MERCHANT

    def request_payment(self, amount_rial: int, order_number: str, callback_url: str) -> tuple[str, str]:
        response = httpx.post(
            f"{ZIBAL_BASE_URL}/request",
            json={
                "merchant": self.merchant,
                "amount": amount_rial,
                "callbackUrl": callback_url,
                "orderId": order_number,
            },
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        if data.get("result") != 100 or not data.get("trackId"):
            raise ValueError(f"Zibal request failed: {data}")
        track_id = str(data["trackId"])
        payment_url = f"https://gateway.zibal.ir/start/{track_id}"
        return payment_url, track_id

    def verify(self, track_id: str) -> dict:
        response = httpx.post(
            f"{ZIBAL_BASE_URL}/verify",
            json={"merchant": self.merchant, "trackId": track_id},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        paid = data.get("result") == 100 and data.get("paid", False) is True
        return {
            "status": data.get("result", -1),
            "paid": paid,
            "ref_id": str(data.get("refNumber", "")),
        }


def get_gateway() -> PaymentGateway:
    provider = settings.PAYMENT_PROVIDER
    if provider == "zibal":
        return ZibalGateway()
    return MockGateway()
