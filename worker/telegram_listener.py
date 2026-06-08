# -*- coding: utf-8 -*-
"""
telegram_listener.py — يراقب قنوات Telegram بحسابك الشخصي
ويستخرج الوظائف تلقائياً ويحفظها في المنصة
"""
import asyncio
import hashlib
import logging
import os
import re
from datetime import datetime, timedelta, timezone as tz
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), "admin_frontend", ".env"))

import httpx

logger = logging.getLogger(__name__)

SUPABASE_URL  = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
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

# ── فلتر محلي قبل الاستخراج (يوفّر تحميل غير ضروري) ───────────────────────
# كلمات دالة على وجود وظيفة — يجب أن تظهر واحدة على الأقل
_JOB_KEYWORDS = [
    "وظيف", "شاغر", "مطلوب", "توظيف", "تعيين", "فرصة عمل",
    "نبحث عن", "نرحب بـ", "للتقديم", "أرسل سيرتك", "ارسل cv",
    "cv على", "سيرة ذاتية", "راتب", "الراتب",
    "hr@", "jobs@", "careers@", "recruitment",
    "hiring", "job", "vacancy", "position", "required",
    "فرصة وظيفية", "وظائف شاغرة", "فرص عمل",
    "مدير", "محاسب", "مهندس", "مبرمج", "مصمم", "محامي",
    "مسوّق", "مندوب", "سكرتير", "موظف", "أخصائي",
    "مشرف", "مدير", "رئيس قسم", "تقني", "فني",
]

# رسائل واضحة لا علاقة لها بالوظائف — تُتجاهل فوراً بدون AI
_SKIP_PATTERNS = [
    r"whatsapp\.com/channel",
    r"t\.me/\+",           # دعوة لقناة تيليقرام
    r"قناة\s+وظائف\s+واتساب",
    r"اشترك في قناتنا",
    r"تابعونا على",
    r"رابط القناة",
    r"انضم إلى قناة",
    r"شارك مع أصدقائك",
    r"^[\U0001F300-\U0001FFFF\s]+$",  # إيموجي فقط
]
_SKIP_RE = re.compile("|".join(_SKIP_PATTERNS), re.IGNORECASE)

def _is_likely_job(text: str) -> bool:
    """فلتر محلي — يتحقق بدون AI هل الرسالة تحتوي وظيفة."""
    # تجاهل رسائل الترويج الواضحة
    if _SKIP_RE.search(text):
        return False
    t = text.lower()
    return any(kw in t for kw in _JOB_KEYWORDS)


# ── استخراج الوظائف ذكياً بدون AI ─────────────────────────────────────────────

# أنماط استخراج المسمى الوظيفي — بالترتيب (الأول = الأقوى)
_JOB_TITLE_PATTERNS = [
    # مطلوب [مسمى] — أقوى نمط
    r"(?:مطلوب|مطلوب موظف|مطلوب موظفة|مطلوب للعمل|نبحث عن|نحتاج|نرحب بـ)\s+([^\n،,]{3,60})",
    # [مسمى] مطلوب — النمط العكسي
    r"([^\n،,]{3,60})\s+مطلوب(?:\s+للعمل)?",
    # توظيف [مسمى] 
    r"(?:توظيف|تعيين|فرصة عمل)\s+([^\n،,]{3,60})",
    # [مسمى] في [شركة]
    r"^([^\n،,]{3,60})\s*[:|-]\s*",
    # وصف وظيفي: [مسمى]
    r"(?:المسمى\s*(?:الوظيفي)?\s*[:\-]|الوظيفة\s*[:\-]|مسمى\s*(?:الوظيفة)?\s*[:\-])\s*([^\n،,]{3,60})",
    # هاشتاقات #وظائف_مسمى
    r"#وظائف[_\s]*([^\s#\n]{3,40})",
    # أول سطر ليس رابط وليس مؤهلاً — غالباً هو المسمى
    r"^([^\n\d]{3,60}?)(?:[\.\n]|$)",
]

_COMPANY_PATTERNS = [
    r"(?:شركة|مؤسسة|مجموعة|بنك|مستشفى|جامعة)\s+([^\s،,.\n]{2,30}(?:\s+[^\s،,.\n]{2,30}){0,3})",
    r"(?:في\s+|بـ\s+|بشركة\s+|لمجموعة\s+)([^\s،,.\n]{2,30}(?:\s+[^\s،,.\n]{2,30}){0,3})",
    r"(?:للعمل\s+(?:في|بـ|بشركة|بمؤسسة|بمجموعة)\s*)([^\n،,]{3,50})",
]

_LINK_PATTERNS = [
    r"https?://(?:www\.)?(?:t\.co|bit\.ly|lnkd\.in|careers?\.[^\s]+|jobs?\.[^\s]+|[^\s]{3,50}\.(?:com|sa|org|net)/[^\s]{2,100})",
]

_QUAL_PREFIXES = ("دبلوم", "بكالوريوس", "ماجستير", "دكتوراه", "شهادة", "حملة", "مؤهل", "خبرة", "راتب")

_GENERIC_TITLES = {
    "وظائف", "وظيفة", "فرصة عمل", "فرص عمل", "موظف", "موظفة", "موظفين",
    "وظائف شاغرة", "وظائف نسائية", "وظائف للنساء", "وظائف للجنسين",
    "وظائف السعودية", "وظائف الرياض", "وظائف جدة",
}


def _extract_jobs_smart(text: str) -> list[dict]:
    """
    يستخرج الوظائف من نص التليجرام ذكياً بدون AI.
    يعيد: [{title_ar, company, application_email, link_url, description_ar}]
    """
    results: list[dict] = []
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # 1. استخراج الإيميلات من النص كامل
    emails = list(set(_EMAIL_RE.findall(text)))

    # 2. استخراج الروابط
    links = []
    for pat in _LINK_PATTERNS:
        links.extend(re.findall(pat, text))
    link = links[0] if links else None

    # 3. محاولة استخراج المسمى الوظيفي
    titles_found = []
    company_found = ""
    description = text.strip()

    # 3أ. أولاً: البحث عن المسمى عبر الأنماط القوية
    for pat in _JOB_TITLE_PATTERNS:
        matches = re.findall(pat, text, re.MULTILINE)
        for m in matches:
            title = m.strip().rstrip("،,.#:- ")
            if len(title) < 3 or len(title) > 60:
                continue
            if any(title.startswith(p) for p in _QUAL_PREFIXES):
                continue
            if title in _GENERIC_TITLES:
                continue
            titles_found.append(title)

    # 3ب. البحث عن شركة
    for pat in _COMPANY_PATTERNS:
        match = re.search(pat, text)
        if match:
            c = match.group(1).strip().rstrip("،,.")
            if 2 <= len(c) <= 40:
                company_found = c
                break

    # 3ج. إذا ما لقينا مسمى — نجرب نأخذ أول سطر طويل
    if not titles_found:
        for line in lines:
            if len(line) < 10:
                continue
            if _EMAIL_RE.search(line):
                continue
            if line.startswith("@"):
                continue
            if "http" in line:
                continue
            # نظف من الهاشتاقات
            clean = re.sub(r"#\w+", "", line).strip()
            if 5 <= len(clean) <= 80 and not any(clean.startswith(p) for p in _QUAL_PREFIXES):
                titles_found.append(clean)
                break

    # 4. لكل مسمى وجدناه، ننشئ كائن وظيفة
    for title in titles_found[:3]:  # حد أقصى 3 وظائف
        # تنظيف العنوان من الزوائد
        title = re.sub(r"^[•\-*#\s]+|[•\-*#\s]+$", "", title).strip()
        title = re.sub(r"\s+", " ", title)
        # إزالة كلمات مطلوب/توظيف من بداية العنوان
        title = re.sub(r"^(?:مطلوب|توظيف|تعيين|فرصة عمل|وظيفة)\s+", "", title).strip()

        if not title or len(title) < 3 or title in _GENERIC_TITLES:
            continue

        job = {
            "title_ar": title,
            "company": company_found or None,
            "application_email": emails[0] if emails else None,
            "link_url": link,
            "description_ar": description[:1000],
        }
        # تجنب التكرار
        if any(j["title_ar"] == title for j in results):
            continue
        results.append(job)

    return results


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


async def _msg_exists(msg_uid: str) -> bool:
    """يتحقق هل أي وظيفة من هذه الرسالة محفوظة (uid_0, uid_1, ...)"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return False
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/admin_jobs",
                params={"tweet_uid": f"like.{msg_uid}%", "select": "id", "limit": "1"},
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
                    "is_active":         False,
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


# ── فلتر وظائف التمهير والتدريب التعاوني ─────────────────────────────────
_TAMHEER_KEYWORDS = [
    "تمهير", "tamheer",
    "تدريب تعاوني", "التدريب التعاوني", "تعاوني",
    "cooperative training", "co-op",
    "تدريب طلاب", "برنامج تدريبي للطلاب",
    "متدرب", "متدربة",
]

def _is_tamheer(title: str) -> bool:
    t = title.lower()
    return any(kw in t for kw in _TAMHEER_KEYWORDS)


# ── معالجة رسالة جديدة ───────────────────────────────────────────────────
async def process_message(text: str, channel_title: str, channel_id: str, msg_id: int):
    text = text.strip()
    if len(text) < 30:
        logger.info("[TG] ⏭️ نص قصير جداً (%d حرف) من %s", len(text), channel_title)
        return

    # ── فلتر محلي — بدون AI ───────────────────────────────────────────────
    # قنوات الوظائف المتخصصة: لا نحتاج فلتراً لأن القناة كلها وظائف
    _is_job_channel = any(kw in channel_title for kw in ["وظائف", "توظيف", "وظيف", "تعيين", "شواغر", "jobs", "careers", "hiring"])
    if not _is_job_channel and not _is_likely_job(text):
        logger.info("[TG] ⏭️ فلتر محلي: لا تبدو وظيفة من %s", channel_title)
        return

    uid_base = f"{channel_id}:{msg_id}:{text[:100]}"
    uid = hashlib.md5(uid_base.encode()).hexdigest()

    if await _msg_exists(uid):
        logger.info("[TG] ⏭️ مكرر — تجاهل من %s", channel_title)
        return

    logger.info("[TG] 🔍 استخراج ذكي من %s: %s...", channel_title, text[:60].replace("\n", " "))
    jobs = _extract_jobs_smart(text)
    if not jobs:
        logger.info("[TG] ❌ لم يجد وظائف في رسالة من %s", channel_title)
        return
    logger.info("[TG] ✅ وجد %d وظيفة من %s", len(jobs), channel_title)

    saved = 0
    for i, job in enumerate(jobs):
        title = job.get("title_ar", "").strip()
        if not title:
            continue

        # فلتر تمهير والتدريب التعاوني — لا تُحفظ في DB ولا تُنشر
        if _is_tamheer(title):
            logger.info("[TG] 🚫 تمهير/تدريب — تجاهل: %s", title)
            continue

        # فلتر: مسمى يبدأ بمؤهل تعليمي — هذا شرط وليس وظيفة
        _QUAL_PREFIXES = ("دبلوم", "بكالوريوس", "ماجستير", "دكتوراه", "شهادة", "حملة", "مؤهل")
        if any(title.startswith(p) for p in _QUAL_PREFIXES):
            logger.info("[TG] 🚫 مسمى يبدو مؤهلاً تعليمياً — تجاهل: %s", title)
            continue

        # فلتر: مسميات عامة جداً لا تصف وظيفة حقيقية
        _GENERIC_TITLES = {
            "موظف تقنية معلومات", "موظفة تقنية معلومات",
            "وظائف تقنية", "وظيفة تقنية",
            "وظائف هندسية", "وظيفة هندسية",
            "وظائف إدارية", "وظيفة إدارية",
            "وظائف", "وظيفة", "فرصة عمل", "فرص عمل",
            "موظف", "موظفة",
        }
        if title in _GENERIC_TITLES:
            logger.info("[TG] 🚫 مسمى عام جداً — تجاهل: %s", title)
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
            logger.info(f"[TG] حُفظت في DB: {title} من {channel_title}")

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

    # ── قائمة القنوات فقط (بدون جلب تاريخي) ────────────────────
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
    except Exception as e:
        logger.warning("[TG-Listener] تعذّر جلب القنوات: %s", e)

    # النشر يُدار الآن عبر Supabase Edge Function (tg-poster) + pg_cron
    await client.run_until_disconnected()


if __name__ == "__main__":
    logging.basicConfig(
        format="%(asctime)s %(levelname)s %(message)s",
        level=logging.INFO,
    )
    logger.info("🚀 تشغيل Telegram Listener مباشرة...")
    asyncio.run(run_listener())
