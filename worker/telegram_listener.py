# -*- coding: utf-8 -*-
"""
telegram_listener.py — يراقب قنوات Telegram بحسابك الشخصي
ويستخرج الوظائف تلقائياً ويحفظها في المنصة
"""
import asyncio
import hashlib
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone as tz

import httpx

logger = logging.getLogger(__name__)

SUPABASE_URL  = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
GEMINI_KEY    = os.getenv("GEMINI_API_KEY", "")
BOT_TOKEN     = os.getenv("TELEGRAM_BOT_TOKEN", "")
JOB_CHANNEL   = os.getenv("TELEGRAM_JOB_CHANNEL_ID", "")
ADMIN_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

_SB_HEADERS = lambda: {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
]

# ── Gemini: استخراج الوظائف ────────────────────────────────────────────────
async def _extract_jobs_gemini(text: str) -> list[dict]:
    if not GEMINI_KEY:
        return []

    prompt = f"""أنت نظام استخراج وظائف متخصص في السوق السعودي والخليجي.
النص التالي جاء من قناة Telegram. مهمتك استخراج أي فرصة عمل أو وظيفة أو طلب توظيف.

كن متساهلاً في التفسير — استخرج الوظيفة حتى لو كانت:
- قصيرة أو بدون تفاصيل كثيرة
- مكتوبة بأسلوب غير رسمي
- تحتوي على مسمى وظيفي فقط مع رقم تواصل أو إيميل
- إعلان توظيف بسيط

لكل وظيفة أرجع:
{{
  "title_ar": "المسمى الوظيفي بالعربية — اخترع مسمى معقول إذا لم يُذكر صراحة",
  "company": "اسم الشركة أو المنشأة أو فارغ",
  "description_ar": "أي تفاصيل متاحة عن الوظيفة أو المتطلبات",
  "application_email": "البريد الإلكتروني للتواصل أو null",
  "specializations": "5 كلمات مفتاحية مفصولة بفاصلة",
  "link_url": "رابط التقديم أو null"
}}

أرجع [] فقط إذا كان النص لا علاقة له بالوظائف أو التوظيف إطلاقاً (مثل أخبار، إعلانات تجارية، مقاطع ترفيهية).
أرجع JSON فقط بدون أي نص إضافي.

النص:
{text[:3000]}"""

    for model in GEMINI_MODELS:
        try:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model}:generateContent?key={GEMINI_KEY}"
            )
            payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "responseMimeType": "application/json",
                },
            }
            async with httpx.AsyncClient(timeout=40) as client:
                r = await client.post(url, json=payload)
                if r.status_code != 200:
                    continue
                raw = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                match = re.search(r"\[[\s\S]*\]", raw)
                if not match:
                    return []
                jobs = json.loads(match.group())
                return jobs if isinstance(jobs, list) else []
        except Exception as e:
            logger.warning(f"Gemini {model} error: {e}")
            continue
    return []


# ── Supabase: تحقق من التكرار ─────────────────────────────────────────────
async def _job_exists(uid: str) -> bool:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/admin_jobs",
                params={"tweet_uid": f"eq.{uid}", "select": "id", "limit": "1"},
                headers=_SB_HEADERS(),
            )
            data = r.json()
            return isinstance(data, list) and len(data) > 0
    except:
        return False


# ── Supabase: حفظ وظيفة ──────────────────────────────────────────────────
async def _save_job(job: dict, uid: str, channel: str) -> str | None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{SUPABASE_URL}/rest/v1/admin_jobs",
                json={
                    "title_ar":          job.get("title_ar", "وظيفة من Telegram").strip(),
                    "company":           job.get("company", "").strip() or None,
                    "description_ar":    job.get("description_ar", "").strip() or None,
                    "application_email": job.get("application_email") or None,
                    "specializations":   job.get("specializations", "").strip() or None,
                    "link_url":          job.get("link_url") or None,
                    "is_active":         True,
                    "tweet_uid":         uid,
                    "source_account":    channel,
                },
                headers=_SB_HEADERS(),
            )
            data = r.json()
            return data[0]["id"] if isinstance(data, list) and data else None
    except:
        return None


# ── Telegram Bot: إرسال رسالة ─────────────────────────────────────────────
async def _send_tg(chat_id: str, text: str, disable_preview: bool = False):
    if not BOT_TOKEN or not chat_id:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={
                    "chat_id":                  chat_id,
                    "text":                     text,
                    "parse_mode":               "HTML",
                    "disable_web_page_preview": disable_preview,
                },
            )
    except:
        pass


# ── معالجة رسالة جديدة ───────────────────────────────────────────────────
async def process_message(text: str, channel_title: str, channel_id: str, msg_id: int):
    text = text.strip()
    if len(text) < 20:
        logger.info("[TG] ⏭️ نص قصير جداً (%d حرف) من %s", len(text), channel_title)
        return

    uid_base = f"{channel_id}:{msg_id}:{text[:100]}"
    uid = hashlib.md5(uid_base.encode()).hexdigest()

    if await _job_exists(uid):
        logger.info("[TG] ⏭️ مكرر — تجاهل من %s", channel_title)
        return

    logger.info("[TG] 🤖 إرسال لـ Gemini من %s: %s...", channel_title, text[:60].replace("\n", " "))
    jobs = await _extract_jobs_gemini(text)
    if not jobs:
        logger.info("[TG] ❌ Gemini: لم يجد وظائف في رسالة من %s", channel_title)
        return
    logger.info("[TG] ✅ Gemini: وجد %d وظيفة من %s", len(jobs), channel_title)

    saved = 0
    for i, job in enumerate(jobs):
        if not job.get("title_ar", "").strip():
            continue

        # fallback للإيميل
        if not job.get("application_email"):
            m = _EMAIL_RE.search(text)
            if m:
                job["application_email"] = m.group()

        job_uid = f"{uid}_{i}"
        job_id = await _save_job(job, job_uid, channel_title)
        if job_id:
            saved += 1
            logger.info(f"[TG] حُفظت في DB: {job['title_ar']} من {channel_title}")

    if saved:
        logger.info(f"[TG] {saved} وظيفة من {channel_title}")


# ── تشغيل المستمع ─────────────────────────────────────────────────────────
async def run_listener():
    api_id  = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")
    session  = os.getenv("TELEGRAM_SESSION_STRING")

    if not api_id or not api_hash or not session:
        logger.warning("[TG-Listener] TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION_STRING غير مضبوطة — المستمع متوقف")
        return

    try:
        from telethon import TelegramClient, events
        from telethon.sessions import StringSession
    except ImportError:
        logger.error("[TG-Listener] مكتبة telethon غير مثبتة — شغّل: pip install telethon")
        return

    client = TelegramClient(StringSession(session), int(api_id), api_hash)

    @client.on(events.NewMessage())
    async def handler(event):
        if not event.is_channel:
            return
        text = event.message.text or event.message.message or ""
        try:
            chat = await event.get_chat()
            title = getattr(chat, "title", str(chat.id))
            cid   = str(chat.id)
        except:
            title = "unknown"
            cid   = "0"

        logger.info("[TG-Listener] 📩 رسالة جديدة من: %s | الطول: %d", title, len(text))

        if not text.strip():
            return

        asyncio.create_task(
            process_message(text, title, cid, event.message.id)
        )

    await client.start()

    # ── الاشتراك في القنوات المطلوبة تلقائياً ─────────────────────
    # القنوات الثابتة + أي قنوات إضافية من متغير TELEGRAM_EXTRA_CHANNELS (مفصولة بفاصلة)
    _required_channels = ["jwkri"]
    _extra = os.getenv("TELEGRAM_EXTRA_CHANNELS", "")
    if _extra:
        _required_channels += [c.strip().lstrip("@").lstrip("https://t.me/") for c in _extra.split(",") if c.strip()]

    try:
        from telethon.tl.functions.channels import JoinChannelRequest
        for _ch in _required_channels:
            try:
                await client(JoinChannelRequest(_ch))
                logger.info("[TG-Listener] ✅ انضممت إلى قناة: %s", _ch)
            except Exception as _e:
                logger.info("[TG-Listener] قناة %s — %s", _ch, _e)
    except Exception as _e:
        logger.warning("[TG-Listener] خطأ اشتراك القنوات: %s", _e)

    # ── قائمة القنوات + جلب الرسائل التاريخية ────────────────────
    try:
        from telethon.tl.types import Channel
        from datetime import timezone as tz
        channels_entities = []
        async for dialog in client.iter_dialogs():
            if isinstance(dialog.entity, Channel) and not dialog.entity.megagroup:
                channels_entities.append(dialog.entity)

        channel_names = [c.title for c in channels_entities]
        channel_list  = "\n".join(f"  • {c}" for c in channel_names) or "  (لا توجد قنوات)"
        summary = (
            f"📡 <b>مستمع Telegram متصل</b>\n"
            f"يراقب <b>{len(channel_names)}</b> قناة:\n"
            f"{channel_list}"
        )
        logger.info("[TG-Listener] ✅ متصل — يراقب %d قناة", len(channel_names))
        await _send_tg(ADMIN_CHAT_ID, summary)

        # جلب آخر 10 أيام من كل قناة
        cutoff = datetime.now(tz.utc) - timedelta(days=30)
        for entity in channels_entities:
            try:
                logger.info("[TG-Listener] جلب رسائل قديمة: %s", entity.title)
                async for msg in client.iter_messages(entity, limit=200, offset_date=None, reverse=False):
                    if msg.date and msg.date < cutoff:
                        break
                    text = getattr(msg, "text", "") or getattr(msg, "message", "") or ""
                    if text.strip():
                        asyncio.create_task(
                            process_message(text, entity.title, str(entity.id), msg.id)
                        )
                await asyncio.sleep(1)  # تجنب rate limit
            except Exception as e:
                logger.warning("[TG-Listener] خطأ جلب %s: %s", entity.title, e)

    except Exception as e:
        logger.warning("[TG-Listener] تعذّر جلب القنوات: %s", e)

    # النشر يُدار الآن عبر Supabase Edge Function (tg-poster) + pg_cron
    await client.run_until_disconnected()
