# -*- coding: utf-8 -*-
"""
telegram_listener.py — يراقب قنوات Telegram بحسابك الشخصي
ويستخرج الوظائف تلقائياً ويحفظها في ملف pending_jobs.json
"""
import asyncio
import hashlib
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone as tz
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), "admin_frontend", ".env"))

logger = logging.getLogger(__name__)

BOT_TOKEN     = os.getenv("TELEGRAM_BOT_TOKEN", "")
JOB_CHANNEL   = os.getenv("TELEGRAM_JOB_CHANNEL_ID", "")
ADMIN_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")



# ── ملفات محلية للتخزين المؤقت ──────────────────────────────────────────
_DATA_DIR = os.path.join(os.path.dirname(__file__))
_PENDING_FILE = os.path.join(_DATA_DIR, "pending_jobs.json")
_SEEN_FILE = os.path.join(_DATA_DIR, "seen_uids.json")

def _load_json(path: str, default=None):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return default if default is not None else []

def _save_json(path: str, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _msg_exists(msg_uid: str) -> bool:
    """يتحقق هل هذا UID موجود مسبقاً في seen_uids.json"""
    seen = set(_load_json(_SEEN_FILE, []))
    return msg_uid in seen


def _mark_seen(msg_uid: str):
    seen = set(_load_json(_SEEN_FILE, []))
    seen.add(msg_uid)
    _save_json(_SEEN_FILE, list(seen))


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


# ── معالجة رسالة جديدة — تحفظ كل الرسائل بدون فلتر ──────────────────────
async def process_message(text: str, channel_title: str, channel_id: str, msg_id: int):
    text = text.strip()
    if len(text) < 10:
        return

    uid_base = f"{channel_id}:{msg_id}:{text[:100]}"
    uid = hashlib.md5(uid_base.encode()).hexdigest()

    if _msg_exists(uid):
        return

    # حفظ الرسالة كاملة بدون استخراج
    entry = {
        "id": uid,
        "title_ar": text[:80].replace("\n", " ").strip(),
        "company": None,
        "description_ar": text[:5000],
        "application_email": None,
        "link_url": None,
        "source_account": channel_title,
        "fetched_at": datetime.now(tz.utc).isoformat(),
        "status": "pending",
    }

    pending = _load_json(_PENDING_FILE, [])
    if any(e.get("id") == uid for e in pending):
        return
    pending.append(entry)
    _save_json(_PENDING_FILE, pending)
    _mark_seen(uid)

    logger.info("[TG] 💾 رسالة من %s — %d حرف", channel_title, len(text))


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

    # معرّف قناة البوت بدون بادئة -100 (لمقارنة موحّدة)
    def _norm_cid(cid: str) -> str:
        return cid.lstrip("-").removeprefix("100")

    _job_channel_norm = _norm_cid(JOB_CHANNEL) if JOB_CHANNEL else None

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

        # تجاهل قناة البوت نفسها لتفادي الحلقة اللانهائية
        if _job_channel_norm and _norm_cid(cid) == _job_channel_norm:
            return

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

    # ── قائمة القنوات + جلب آخر 7 أيام ──────────────────────────
    try:
        from telethon.tl.types import Channel
        channels_entities = []
        async for dialog in client.iter_dialogs():
            if isinstance(dialog.entity, Channel) and not dialog.entity.megagroup:
                if _job_channel_norm and _norm_cid(str(dialog.entity.id)) == _job_channel_norm:
                    continue
                channels_entities.append(dialog.entity)

        channel_names = [c.title for c in channels_entities]
        channel_list  = "\n".join(f"  • {c}" for c in channel_names) or "  (لا توجد قنوات)"
        summary = (
            f"Telegram Listener connected\n"
            f"Watching {len(channel_names)} channels:\n"
            f"{channel_list}"
        )
        logger.info("[TG-Listener] ✅ متصل — يراقب %d قناة", len(channel_names))
        await _send_tg(ADMIN_CHAT_ID, summary)

        # ── جلب آخر 7 أيام من كل قناة ──────────────────────────
        cutoff = datetime.now(tz.utc) - timedelta(days=7)
        logger.info("[TG-Listener] 🔄 بدء جلب آخر 7 أيام من %d قناة...", len(channels_entities))

        for ch in channels_entities:
            ch_title = getattr(ch, "title", str(ch.id))
            ch_id = str(ch.id)
            try:
                count = 0
                async for msg in client.iter_messages(ch, offset_date=cutoff, reverse=False, limit=200):
                    text = msg.text or msg.message or ""
                    if not text.strip() or len(text.strip()) < 30:
                        continue
                    await process_message(text.strip(), ch_title, ch_id, msg.id)
                    count += 1
                    if count % 20 == 0:
                        await asyncio.sleep(0.5)  # تجنب rate limit
                logger.info("[TG-Listener] 📥 قناة %s: فحص %d رسالة", ch_title, count)
            except Exception as e:
                logger.warning("[TG-Listener] ⚠️ قناة %s: خطأ في الجلب — %s", ch_title, e)

        logger.info("[TG-Listener] ✅ انتهى جلب آخر 7 أيام")
        await _send_tg(ADMIN_CHAT_ID, f"✅ انتهى جلب آخر 7 أيام من {len(channels_entities)} قناة")
    except Exception as e:
        logger.warning("[TG-Listener] تعذّر جلب القنوات: %s", e)

    # ── الاستماع للرسائل الجديدة ────────────────────────────────
    await client.run_until_disconnected()


if __name__ == "__main__":
    logging.basicConfig(
        format="%(asctime)s %(levelname)s %(message)s",
        level=logging.INFO,
    )
    logger.info("🚀 تشغيل Telegram Listener مباشرة...")
    asyncio.run(run_listener())
