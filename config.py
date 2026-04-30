# -*- coding: utf-8 -*-
from __future__ import annotations

import os
from urllib.parse import unquote

from dotenv import load_dotenv

load_dotenv()


def _normalize_api_token(raw: str | None) -> str:
    """Quit quotes/whitespace and one-pass URL-decode (tokens pasted from browser often include %3D)."""
    s = (raw or "").strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        s = s[1:-1].strip()
    if "%" in s:
        try:
            u = unquote(s)
            if u != s:
                s = u.strip()
        except Exception:
            pass
    return s

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://vnbaksiabcdnnnoglycr.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# وضع الويب (Webhook): استقبال التحديثات عبر HTTPS بدل الـ polling
USE_WEBHOOK = os.getenv("USE_WEBHOOK", "").strip().lower() in ("1", "true", "yes")
WEBHOOK_URL = (os.getenv("WEBHOOK_URL") or "").strip().rstrip("/")  # مثال: https://your-domain.com
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "8080"))
WEBHOOK_PATH = (os.getenv("WEBHOOK_PATH") or "webhook").strip().strip("/") or "webhook"
WEBHOOK_LISTEN = os.getenv("WEBHOOK_LISTEN", "0.0.0.0")
ADMIN_DASHBOARD_URL = (os.getenv("ADMIN_DASHBOARD_URL") or "").strip().rstrip("/")

if not SUPABASE_KEY:
    raise ValueError("أضف SUPABASE_KEY في ملف .env")
if USE_WEBHOOK and not WEBHOOK_URL:
    raise ValueError("عند تفعيل USE_WEBHOOK يجب تعيين WEBHOOK_URL في .env (رابط HTTPS العام للبوت)")

# قناة مصدر الوظائف: البوت يضيف منشوراتها كوظائف تلقائياً (البوت يجب أن يكون أدمن في القناة)
# ضع معرّف القناة (رقم سالب مثل -1001234567890) أو اتركه فارغاً لتعطيل
_jo = os.getenv("JOBS_SOURCE_CHANNEL_ID", "").strip()
JOBS_SOURCE_CHANNEL_ID = int(_jo) if _jo and _jo.lstrip("-").isdigit() else None

# مفتاح جيميني: يُستخدم في التقديم التلقائي لتوليد رسالة التغطية وقراءة السيرة من الصور (OCR)
# من https://aistudio.google.com/apikey — إن لم يُضف، التقديم يعمل برسالة عامة وبدون قراءة الصور
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
# نموذج جيميني الوحيد في البوت (لا يُقرأ من البيئة)
GEMINI_MODEL_FLASH = "gemini-2.5-flash"
GEMINI_MODEL_PRO = "gemini-2.5-flash"

# Resend (اختياري): عند تعيينه سيُستخدم بدل Gmail SMTP
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "").strip()
RESEND_FROM_NAME = os.getenv("RESEND_FROM_NAME", "Jobsa Bot").strip() or "Jobsa Bot"
RESEND_ALIAS_DOMAIN = os.getenv("RESEND_ALIAS_DOMAIN", "").strip().lower()
if not RESEND_ALIAS_DOMAIN and "@" in RESEND_FROM_EMAIL:
    RESEND_ALIAS_DOMAIN = RESEND_FROM_EMAIL.split("@", 1)[1].strip().lower()

