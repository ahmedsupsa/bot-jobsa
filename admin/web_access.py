# -*- coding: utf-8 -*-
import base64
import hashlib
import hmac
import json
import os
import time


def _b64u_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64u_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + pad).encode("ascii"))


def _secret() -> bytes:
    s = (os.getenv("ADMIN_SECRET") or "change-me-in-production").encode("utf-8")
    return s


def build_gate_token(admin_telegram_id: int, ttl_seconds: int = 300) -> str:
    """
    توكن دخول مؤقت للوحة الأدمن.
    صالح افتراضياً 5 دقائق.
    """
    payload = {
        "aid": int(admin_telegram_id),
        "exp": int(time.time()) + int(ttl_seconds),
    }
    body = _b64u_encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8"))
    sig = hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{_b64u_encode(sig)}"


def verify_gate_token(token: str) -> dict | None:
    if not token or "." not in token:
        return None
    body, sig = token.split(".", 1)
    expected = _b64u_encode(hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        payload = json.loads(_b64u_decode(body).decode("utf-8"))
    except Exception:
        return None
    exp = int(payload.get("exp") or 0)
    if exp < int(time.time()):
        return None
    return payload
