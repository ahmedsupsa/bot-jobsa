# -*- coding: utf-8 -*-
import os
from dotenv import load_dotenv

load_dotenv()

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

if not BOT_TOKEN:
    raise ValueError("أضف BOT_TOKEN في ملف .env")
if not SUPABASE_KEY:
    raise ValueError("أضف SUPABASE_KEY في ملف .env")
if USE_WEBHOOK and not WEBHOOK_URL:
    raise ValueError("عند تفعيل USE_WEBHOOK يجب تعيين WEBHOOK_URL في .env (رابط HTTPS العام للبوت)")
