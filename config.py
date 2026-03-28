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

BOT_TOKEN = os.getenv("BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://vnbaksiabcdnnnoglycr.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# أدمن البوت: أرقام تليجرام مفصولة بفاصلة (مثلاً 123456789,987654321)
ADMIN_TELEGRAM_IDS: list[int] = []
_raw = os.getenv("ADMIN_TELEGRAM_IDS", "").strip()
if _raw:
    try:
        ADMIN_TELEGRAM_IDS = [int(x.strip()) for x in _raw.split(",") if x.strip()]
    except ValueError:
        pass

# وضع الويب (Webhook): استقبال التحديثات عبر HTTPS بدل الـ polling
USE_WEBHOOK = os.getenv("USE_WEBHOOK", "").strip().lower() in ("1", "true", "yes")
WEBHOOK_URL = (os.getenv("WEBHOOK_URL") or "").strip().rstrip("/")  # مثال: https://your-domain.com
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "8080"))
WEBHOOK_PATH = (os.getenv("WEBHOOK_PATH") or "webhook").strip().strip("/") or "webhook"
WEBHOOK_LISTEN = os.getenv("WEBHOOK_LISTEN", "0.0.0.0")
ADMIN_DASHBOARD_URL = (os.getenv("ADMIN_DASHBOARD_URL") or "").strip().rstrip("/")

if not BOT_TOKEN:
    raise ValueError("أضف BOT_TOKEN في ملف .env")
if not SUPABASE_KEY:
    raise ValueError("أضف SUPABASE_KEY في ملف .env")
if USE_WEBHOOK and not WEBHOOK_URL:
    raise ValueError("عند تفعيل USE_WEBHOOK يجب تعيين WEBHOOK_URL في .env (رابط HTTPS العام للبوت)")

# قناة مصدر الوظائف: البوت يضيف منشوراتها كوظائف تلقائياً (البوت يجب أن يكون أدمن في القناة)
# ضع معرّف القناة (رقم سالب مثل -1001234567890) أو اتركه فارغاً لتعطيل
_jo = os.getenv("JOBS_SOURCE_CHANNEL_ID", "").strip()
JOBS_SOURCE_CHANNEL_ID = int(_jo) if _jo and _jo.lstrip("-").isdigit() else None

# Twitter/X jobs ingest (optional)
# OAuth 1.0a (من Keys and tokens): الأربعة معاً يفعّلون التوقيع بدل Bearer.
X_OAUTH1_API_KEY = _normalize_api_token(os.getenv("X_OAUTH1_API_KEY"))
X_OAUTH1_API_SECRET = _normalize_api_token(os.getenv("X_OAUTH1_API_SECRET"))
X_OAUTH1_ACCESS_TOKEN = _normalize_api_token(os.getenv("X_OAUTH1_ACCESS_TOKEN"))
X_OAUTH1_ACCESS_TOKEN_SECRET = _normalize_api_token(os.getenv("X_OAUTH1_ACCESS_TOKEN_SECRET"))
X_BEARER_TOKEN = _normalize_api_token(os.getenv("X_BEARER_TOKEN"))
X_USER_ACCESS_TOKEN = _normalize_api_token(os.getenv("X_USER_ACCESS_TOKEN"))
TWITTER_JOB_QUERY = (
    os.getenv("TWITTER_JOB_QUERY", "").strip()
    or '(وظيفة OR وظائف OR "فرصة وظيفية" OR مطلوب) (email OR ايميل OR careers OR apply) -is:retweet -is:reply'
)
TWITTER_REQUIRE_EMAIL = os.getenv("TWITTER_REQUIRE_EMAIL", "true").strip().lower() in ("1", "true", "yes")
TWITTER_ALLOW_LINK_APPLY = os.getenv("TWITTER_ALLOW_LINK_APPLY", "false").strip().lower() in ("1", "true", "yes")
TWITTER_MIN_SIGNAL_SCORE = int(os.getenv("TWITTER_MIN_SIGNAL_SCORE", "3") or "3")
_tw_target = os.getenv("TWITTER_TARGET_CHANNEL_ID", "").strip()
TWITTER_TARGET_CHANNEL_ID = (
    int(_tw_target)
    if _tw_target and _tw_target.lstrip("-").isdigit()
    else JOBS_SOURCE_CHANNEL_ID
)


def twitter_x_ingest_configured() -> bool:
    """هل يوجد أي طريقة مصادقة + قناة هدف لدورة وظائف X؟"""
    if TWITTER_TARGET_CHANNEL_ID is None:
        return False
    if (
        X_OAUTH1_API_KEY
        and X_OAUTH1_API_SECRET
        and X_OAUTH1_ACCESS_TOKEN
        and X_OAUTH1_ACCESS_TOKEN_SECRET
    ):
        return True
    if X_USER_ACCESS_TOKEN or X_BEARER_TOKEN:
        return True
    return False


# مفتاح جيميني: يُستخدم في التقديم التلقائي لتوليد رسالة التغطية وقراءة السيرة من الصور (OCR)
# من https://aistudio.google.com/apikey — إن لم يُضف، التقديم يعمل برسالة عامة وبدون قراءة الصور
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
# نموذج جيميني الوحيد في البوت (لا يُقرأ من البيئة)
GEMINI_MODEL_FLASH = "gemini-2.5-flash"
GEMINI_MODEL_PRO = "gemini-2.5-flash"

# تويتر: تجاهل تغريدة إن وُجد كلمة من القائمة (مفصولة بفاصلة، مطابقة جزئية غير حساسة لحالة الأحرف)
_texc = os.getenv("TWITTER_EXCLUDE_SUBSTRINGS", "").strip()
TWITTER_EXCLUDE_SUBSTRINGS: list[str] = [x.strip().lower() for x in _texc.split(",") if x.strip()]

# Resend (اختياري): عند تعيينه سيُستخدم بدل Gmail SMTP
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "").strip()
RESEND_FROM_NAME = os.getenv("RESEND_FROM_NAME", "Jobsa Bot").strip() or "Jobsa Bot"
RESEND_ALIAS_DOMAIN = os.getenv("RESEND_ALIAS_DOMAIN", "").strip().lower()
if not RESEND_ALIAS_DOMAIN and "@" in RESEND_FROM_EMAIL:
    RESEND_ALIAS_DOMAIN = RESEND_FROM_EMAIL.split("@", 1)[1].strip().lower()

