# -*- coding: utf-8 -*-
"""
Auto-Apply Worker — يعمل دورياً كل 30 دقيقة
يقدّم على الوظائف تلقائياً لكل مستخدم نشط عبر SMTP الشخصي
"""
import asyncio
import base64
import logging
import os
import re
import smtplib
import ssl
import sys
import time
from datetime import datetime, timezone, timedelta
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import hashlib
import io
import json

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv

try:
    import pdfplumber
    _PDFPLUMBER_OK = True
except ImportError:
    _PDFPLUMBER_OK = False

load_dotenv()

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

SUPABASE_URL        = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY        = os.getenv("SUPABASE_KEY", "")
GEMINI_API_KEY      = os.getenv("GEMINI_API_KEY", "")
SMTP_ENCRYPTION_KEY = os.getenv("SMTP_ENCRYPTION_KEY", "")
CYCLE_INTERVAL      = int(os.getenv("AUTO_APPLY_INTERVAL", "1800"))
WORKER_SECRET       = os.getenv("WORKER_SECRET", "")
EDGE_FUNCTION_URL   = os.getenv("SUPABASE_WORKER_URL", "https://vnbaksiabcdnnnoglycr.supabase.co/functions/v1/worker")

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

_SEND_INTERVAL = 45
_last_send: dict[str, float] = {}

_SB_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


# ─── مساعدات Supabase ───

async def sb_get(client: httpx.AsyncClient, table: str, params: dict = {}) -> list:
    r = await client.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=_SB_HEADERS,
        params={"select": "*", **params},
    )
    return r.json() if r.is_success else []


async def sb_get_count(client: httpx.AsyncClient, table: str, params: dict = {}) -> int:
    r = await client.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers={**_SB_HEADERS, "Prefer": "count=exact"},
        params={"select": "id", **params},
    )
    rng = r.headers.get("content-range", "")
    try:
        return int(rng.split("/")[1])
    except Exception:
        return 0


# ─── تشفير / فك تشفير ───

def _decrypt_aes(encrypted: str, key_hex: str) -> str:
    """فك تشفير كلمة المرور المشفّرة بـ AES-256-GCM."""
    key = bytes.fromhex(key_hex)
    parts = encrypted.split(":")
    if len(parts) != 2:
        raise ValueError("تنسيق التشفير غير صحيح")
    iv = base64.b64decode(parts[0])
    data = base64.b64decode(parts[1])  # tag(16) + ciphertext
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(iv, data, None).decode("utf-8")


# ─── التحقق من صحة الإيميل ───

def _is_valid_email(addr: str) -> bool:
    """يقبل فقط إيميلات صحيحة بدون نص عربي أو أسماء."""
    return bool(addr and _EMAIL_RE.match(addr.strip()))


# ─── مطابقة الوظائف ───

def _strip_emojis(text: str) -> str:
    s = re.sub(r"[\U0001F300-\U0001FAFF\U0001F1E6-\U0001F1FF\u2600-\u27BF]+", "", text or "")
    return re.sub(r"\s+", " ", s).strip()


_NEUTRAL_ENDINGS_AR = {
    "شركة", "جهة", "وظيفة", "خبرة", "صناعة", "هندسة", "تجربة", "مجموعة",
    "ممارسة", "خدمة", "برمجة", "إدارة", "رعاية", "رياضة", "تجارة", "علاقة",
    "مهارة", "سلامة", "قيادة", "محاسبة", "مالية", "تقنية", "سياحة", "صحة",
    "جودة", "موارد", "بيئة", "سياسة", "طاقة", "زراعة", "حوكمة", "ريادة",
    "مقابلة", "وساطة", "رقابة", "متابعة", "مراجعة", "مراقبة",
    # مصطلحات وظيفية محايدة تنتهي بتاء — ليست مؤشراً على أنوثة الوظيفة
    "بشرية", "هندسية", "تجارية", "ادارية", "إدارية", "قانونية", "ضريبية",
    "مالية", "مصرفية", "لوجستية", "تسويقية", "تشغيلية", "أكاديمية",
    "طبية", "صيدلية", "تغذية", "بيطرية", "نفسية", "اجتماعية",
    "معمارية", "كيميائية", "فيزيائية", "بيولوجية", "جيولوجية",
    "استراتيجية", "تنظيمية", "إلكترونية", "ميكانيكية", "كهربائية",
    "مدنية", "بيئية", "نووية", "طيرانية", "بحرية", "عسكرية",
}


_TAMHEER_KW = (
    "تمهير", "tamheer",
)

_COOPERATIVE_KW = (
    "تدريب تعاوني", "التدريب التعاوني",
    "تعاوني", "cooperative training", "co-op",
)

def _is_tamheer_job(job: dict) -> bool:
    """يتحقق إذا كانت الوظيفة برنامج تمهير."""
    blob = " ".join([
        job.get("title_ar") or "", job.get("title_en") or "",
        job.get("description_ar") or "", job.get("description_en") or "",
    ]).lower()
    return any(k in blob for k in _TAMHEER_KW)


def _is_cooperative_job(job: dict) -> bool:
    """يتحقق إذا كانت الوظيفة تدريباً تعاونياً."""
    blob = " ".join([
        job.get("title_ar") or "", job.get("title_en") or "",
        job.get("description_ar") or "", job.get("description_en") or "",
    ]).lower()
    return any(k in blob for k in _COOPERATIVE_KW)


def _is_feminine_job(job: dict) -> bool:
    """
    يكشف الوظائف المخصصة للإناث فقط.
    يعتمد على مؤشرات صريحة — لا يرفض بسبب نهايات كلمات عادية مثل 'بشرية'.
    """
    title_ar = (job.get("title_ar") or "").strip()
    desc     = (job.get("description_ar") or "").lower()
    spec     = (job.get("specializations") or "").lower()
    combined = f"{title_ar} {desc} {spec}".lower()

    # مؤشرات صريحة فقط
    explicit_indicators = (
        "نسائية", "للإناث", "للنساء", "نساء فقط",
        "female only", "ladies only", "females only",
        "موظفة فقط", "موظفات فقط",
    )
    if any(k in combined for k in explicit_indicators):
        return True

    # كلمات في العنوان تدل صراحةً على الأنثى (وليس مجرد نهاية بتاء)
    feminine_title_words = (
        "موظفة", "موظفات", "سكرتيرة", "مديرة", "محاسبة",
        "مهندسة", "مشرفة", "مندوبة", "مدربة", "معلمة",
        "ممرضة", "طبيبة", "صيدلانية", "محللة", "مستشارة",
    )
    title_lower = title_ar.lower()
    for word in re.split(r"[\s,،/\-()]+", title_lower):
        if word in feminine_title_words:
            return True

    return False


def _job_matches_user(job: dict, field_names: list[str]) -> bool:
    """
    فلتر مبدئي خفيف — يقبل بشكل واسع ويترك القرار الدقيق للـ AI.
    يرفض فقط إذا كان التخصص معبأً ومختلفاً جذرياً (طب مقابل هندسة).
    """
    if not field_names:
        # لا تفضيلات = قدّم لكل شيء (AI سيحكم)
        return True

    spec     = (job.get("specializations") or "").lower().strip()
    title_ar = (job.get("title_ar") or "").lower()
    title_en = (job.get("title_en") or "").lower()
    desc_ar  = (job.get("description_ar") or "").lower()
    desc_en  = (job.get("description_en") or "").lower()
    blob     = f"{spec} {title_ar} {title_en} {desc_ar} {desc_en}"

    # خريطة التخصصات القريبة — مالية/محاسبة/إدارة متداخلة
    _RELATED: dict[str, list[str]] = {
        "مالية":         ["محاسب", "اقتصاد", "إدارة أعمال", "مالي", "finance", "accounting"],
        "محاسبة":        ["مالية", "مالي", "اقتصاد", "إدارة أعمال", "accounting", "finance"],
        "إدارة أعمال":   ["مالية", "محاسبة", "تسويق", "موارد بشرية", "إدارة", "business"],
        "موارد بشرية":   ["إدارة أعمال", "إدارة", "human resources", "hr", "تدريب"],
        "تسويق":         ["إعلام", "علاقات عامة", "مبيعات", "marketing", "إدارة أعمال"],
        "مبيعات":        ["تسويق", "خدمة عملاء", "sales", "إدارة أعمال"],
        "تقنية معلومات": ["برمجة", "شبكات", "it", "حاسب", "software", "هندسة حاسب"],
        "برمجة":         ["تقنية معلومات", "software", "it", "هندسة حاسب", "حاسب"],
        "هندسة":         ["هندس", "engineer", "فني", "تقني"],
        "خدمة عملاء":    ["مبيعات", "تسويق", "customer service", "support"],
        "سكرتارية":      ["إداري", "admin", "مكتبي", "تنسيق"],
        "قانون":         ["شريعة", "law", "نظام", "حقوق"],
    }

    for name in field_names:
        n = (name or "").strip().lower()
        if not n:
            continue
        # مطابقة مباشرة
        if n in blob:
            return True
        # مطابقة تقريبية (جزء من الكلمة)
        if len(n) >= 4 and any(n[:5] in w for w in blob.split()):
            return True
        # مطابقة عبر الحقول القريبة
        for related in _RELATED.get(n, []):
            if related in blob:
                return True

    # إذا التخصصات فارغة في الوظيفة — قبل (AI سيحكم)
    if not spec:
        return True

    # الوظيفة فيها تخصص ولا شيء يطابق — ترفض فقط إذا كان التخصص محدداً جداً
    # (لا نرفض كل شيء، نترك نسبة للعبور)
    return False


def _is_subscription_active(user: dict) -> bool:
    ends = user.get("subscription_ends_at") or ""
    if not ends:
        return False
    try:
        end_dt = datetime.fromisoformat(ends.replace("Z", "+00:00"))
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)
        return end_dt > datetime.now(timezone.utc)
    except Exception:
        return False


# ─── توليد رسالة التغطية ───

def _build_prompt(job_title: str, name: str, company: str, desc: str, lang: str, template: str) -> str:
    is_ar = lang == "ar"
    co_str = f" في شركة {company}" if company else ""
    desc_str = f". تفاصيل الوظيفة: {desc[:400]}" if desc else ""

    no_hallucinate_ar = (
        "تحذير صارم: لا تذكر أي أرقام أو سنوات خبرة أو برامج أو مهارات تقنية محددة لم تظهر بوضوح في السيرة الذاتية المرفقة. "
        "إذا لم تجد خبرة مباشرة بالوظيفة، اذكر المؤهل العلمي والاهتمام بالفرصة فقط دون اختراع معلومات."
    )
    no_hallucinate_en = (
        "Strict warning: Do not mention any specific years of experience, software, or technical skills "
        "that are not clearly visible in the attached CV. If no direct experience is found, mention the degree and enthusiasm only."
    )

    if template == "brief":
        if is_ar:
            return (
                f"اقرأ السيرة الذاتية واكتب رسالة تقديم موجزة جداً بالعربية (2-3 جمل فقط) "
                f"للوظيفة: {job_title}{co_str}{desc_str}. اسم المتقدم: {name}. "
                f"الأسلوب: مباشر، اذكر أبرز مهارة أو تخصص واضح من السيرة الذاتية فقط، ثم أبدِ اهتمامك. "
                f"بدون تحية، بدون إيموجي، النص فقط. {no_hallucinate_ar}"
            )
        else:
            return (
                f"Read the CV and write a very brief cover note in English (2-3 sentences) "
                f"for the position: {job_title}{co_str}{desc_str}. Applicant: {name}. "
                f"Style: direct — highlight one key skill clearly visible in the CV and express interest. "
                f"No greeting, no emoji, plain text only. {no_hallucinate_en}"
            )
    elif template == "modern":
        if is_ar:
            return (
                f"اقرأ السيرة الذاتية واكتب رسالة تقديم عصرية وودّية بالعربية (3-4 جمل) "
                f"للوظيفة: {job_title}{co_str}{desc_str}. اسم المتقدم: {name}. "
                f"الأسلوب: متحمّس، شخصي، اذكر سبباً محدداً من السيرة الذاتية يجعل هذه الفرصة مناسبة. "
                f"بدون تحية رسمية، بدون إيموجي، النص فقط. {no_hallucinate_ar}"
            )
        else:
            return (
                f"Read the CV and write a modern, friendly cover note in English (3-4 sentences) "
                f"for the role: {job_title}{co_str}{desc_str}. Applicant: {name}. "
                f"Style: enthusiastic, personal — mention a specific qualification from the CV that makes this role a fit. "
                f"No formal salutation, no emoji, plain text only. {no_hallucinate_en}"
            )
    else:  # classic
        if is_ar:
            return (
                f"اقرأ السيرة الذاتية المرفقة ثم اكتب رسالة تغطية رسمية ومنظّمة بالعربية (3-4 جمل) "
                f"للتقديم على وظيفة: {job_title}{co_str}{desc_str}. اسم المتقدم: {name}. "
                f"الأسلوب: رسمي، ابدأ بالتعريف بالنفس والمؤهل ثم اذكر خبرات أو مهارات موجودة فعلاً في السيرة الذاتية تتناسب مع الوظيفة. "
                f"بدون إيموجي، النص فقط بدون عنوان أو تحية. {no_hallucinate_ar}"
            )
        else:
            return (
                f"Read the attached CV and write a formal, structured cover letter in English (3-4 sentences) "
                f"for the position: {job_title}{co_str}{desc_str}. Applicant: {name}. "
                f"Style: professional — introduce yourself with your actual qualification, cite only experience or skills clearly present in the CV. "
                f"No emoji, plain text only, no heading or salutation. {no_hallucinate_en}"
            )


async def _parse_cv_with_ai(cv_text_local: str, cv_bytes: bytes | None, cv_mime: str) -> str | None:
    """
    تحليل السيرة الذاتية واستخراج ملخص منظّم — يُستدعى مرة واحدة فقط.
    يستخدم النص المستخرج محلياً إذا توفّر (أسرع وأوفر)، وإلا يرسل الملف لـ Gemini.
    """
    if not GEMINI_API_KEY:
        return None

    prompt_prefix = (
        "استخرج من هذه السيرة الذاتية المعلومات التالية بشكل منظّم ومختصر بالعربية:\n"
        "المؤهل العلمي والتخصص:\n"
        "سنوات الخبرة الإجمالية (رقم محدد أو 'حديث تخرج' أو 'غير محدد'):\n"
        "المستوى الوظيفي (fresh/junior/mid/senior/manager):\n"
        "الوظائف السابقة (مسمى + جهة + مدة):\n"
        "المهارات التقنية والبرامج:\n"
        "الشهادات والرخص المهنية:\n"
        "اللغات:\n"
        "اكتب فقط المعلومات الموجودة فعلاً. لا تضف تخمينات. "
        "إذا لم تجد معلومة اكتب (غير محدد). "
        "سنوات الخبرة مهمة جداً — إذا كان حديث تخرج اكتب 'سنوات الخبرة: 0 (حديث تخرج)'."
    )

    # إذا استخرجنا نصاً محلياً → نرسله نصاً (أسرع وأرخص)
    if cv_text_local and len(cv_text_local.strip()) >= 100:
        prompt = prompt_prefix + f"\n\n--- نص السيرة الذاتية ---\n{cv_text_local[:3000]}"
        parts: list[dict] = [{"text": prompt}]
    elif cv_bytes:
        parts = [
            {"inline_data": {"mime_type": cv_mime, "data": base64.b64encode(cv_bytes).decode("ascii")}},
            {"text": prompt_prefix},
        ]
    else:
        return None

    try:
        async with httpx.AsyncClient(timeout=40) as c:
            r = await c.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
                json={"contents": [{"parts": parts}]},
            )
            data = r.json()
            text = (data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text") or "").strip()
            return text or None
    except Exception as e:
        logger.warning("خطأ تحليل السيرة الذاتية: %s", e)
        return None


async def _get_or_parse_cv(
    client: httpx.AsyncClient,
    cv: dict,
    cv_bytes: bytes | None = None,
    cv_mime: str = "application/pdf",
) -> str | None:
    """
    إرجاع النص المحلَّل للسيرة الذاتية.
    الترتيب:
      1. النص المحفوظ مسبقاً في قاعدة البيانات  (أسرع)
      2. استخراج محلي بـ pdfplumber + تحليل Gemini
      3. إرسال الملف مباشرة لـ Gemini (fallback)
    """
    existing_text = (cv.get("cv_parsed_text") or "").strip()
    if existing_text:
        return existing_text

    # تأكد من وجود الـ bytes
    if not cv_bytes:
        storage_path = (cv.get("storage_path") or "").strip()
        if not storage_path:
            return None
        cv_bytes = await _download_cv(client, storage_path)
        if not cv_bytes:
            return None

    # استخراج النص محلياً أولاً (PDF فقط)
    local_text = ""
    if cv_mime == "application/pdf":
        local_text = _extract_pdf_text_local(cv_bytes)
        if local_text:
            logger.info("📄 pdfplumber: استُخرج %d حرف من السيرة الذاتية محلياً", len(local_text))

    parsed_text = await _parse_cv_with_ai(local_text, cv_bytes, cv_mime)
    if parsed_text and cv.get("id"):
        try:
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/user_cvs?id=eq.{cv['id']}",
                headers=_SB_HEADERS,
                json={"cv_parsed_text": parsed_text, "cv_parsed_at": datetime.now(timezone.utc).isoformat()},
            )
            logger.info("💾 حُفظ ملخص السيرة الذاتية cv_id=%s", cv["id"])
        except Exception as e:
            logger.warning("فشل حفظ الملخص: %s", e)

    return parsed_text


def _build_plain_text_body(name: str, field_names: list[str]) -> str:
    """قالب ثابت للحفظ في DB — بدون اسم وظيفة أو شركة (يُضافان في الـ wrapper)."""
    spec = field_names[0] if field_names else "مجال التخصص"
    return (
        f"أنا {name}، متخصص في {spec}، وأتقدم بهذه الرسالة راغباً في الانضمام إلى فريقكم.\n\n"
        f"أرفقت لكم سيرتي الذاتية الكاملة التي تتضمن تفاصيل مؤهلاتي وخبراتي، "
        f"وأتطلع إلى فرصة للتواصل معكم."
    )


async def _generate_cover_letter(
    job_title: str, name: str, company: str, desc: str, lang: str,
    cv_parsed_text: str | None = None,
    template: str = "classic",
) -> str:
    fallback_ar = f"أتقدم بكل اهتمام لشغل وظيفة {job_title}{' في ' + company if company else ''}. أنا مهتم بهذه الفرصة وأثق في قدرتي على إضافة قيمة حقيقية لفريقكم."
    fallback_en = f"I am writing to express my interest in the {job_title} position{' at ' + company if company else ''}. I am confident in my ability to contribute effectively to your team."
    if not GEMINI_API_KEY:
        return fallback_ar if lang == "ar" else fallback_en

    has_cv = bool(cv_parsed_text and cv_parsed_text.strip())
    cv_section = (
        f"\nالسيرة الذاتية:\n{cv_parsed_text}\n"
        if has_cv else
        "\nالسيرة الذاتية:\nغير متاحة — اذكر المؤهل والاهتمام بالفرصة فقط.\n"
    )
    lang_word = "عربية" if lang == "ar" else "إنجليزية"

    prompt = (
        f"أنت مساعد توظيف احترافي متخصص في كتابة رسائل التقديم الوظيفي الواقعية اعتمادًا على السيرة الذاتية فقط.\n\n"
        f"مهمتك:\n"
        f"قراءة السيرة الذاتية كاملة بدقة شديدة ثم كتابة رسالة تغطية {lang_word} رسمية قصيرة واحترافية للتقديم على الوظيفة المطلوبة بدون أي اختلاق أو مبالغة.\n\n"
        f"السيرة الذاتية هي المصدر الوحيد للحقيقة، وأي معلومة غير موجودة فيها تعتبر ممنوعة تمامًا.\n\n"
        f"التعليمات الأساسية:\n"
        f"* اكتب رسالة احترافية من 3 إلى 5 جمل فقط.\n"
        f"* ابدأ بالتعريف باسم المتقدم وتخصصه أو مؤهله الحالي.\n"
        f"* اربط بين السيرة الذاتية ومتطلبات الوظيفة بشكل واقعي فقط.\n"
        f"* استخدم لغة رسمية واضحة وبشرية.\n"
        f"* لا تستخدم إيموجي.\n"
        f"* لا تستخدم أسلوب تسويقي مبالغ فيه.\n"
        f"* لا تضف معلومات من عندك.\n"
        f"* لا تكرر وصف الوظيفة بشكل أعمى.\n"
        f"* لا تكتب مقدمة طويلة أو فلسفة.\n"
        f"* لا تضف توقيع أو معلومات تواصل.\n"
        f"* لا تستخدم كلمات توحي بخبرة قوية إذا السيرة الذاتية لا تدعم ذلك.\n\n"
        f"قيود صارمة جدًا — ممنوع تمامًا اختلاق أو افتراض أي:\n"
        f"خبرة عملية، سنوات خبرة، وظيفة سابقة، مهارة تقنية، لغة، شهادة، دورة، مشروع، تطوع، "
        f"مسؤوليات وظيفية، إنجازات، برامج أو أنظمة، أدوات تقنية، شهادات احترافية، عضويات، اعتمادات.\n\n"
        f"إذا لم يتم ذكر الشيء نصيًا داخل السيرة الذاتية: ممنوع ذكره أو التلميح له أو استنتاجه.\n\n"
        f"إذا كانت السيرة الذاتية لا تحتوي على خبرة مباشرة في الوظيفة:\n"
        f"* اذكر المؤهل الدراسي أو التخصص الموجود في السيرة الذاتية.\n"
        f"* أبدِ استعداداً صادقاً للتعلم والنمو المهني وتطوير المهارات.\n"
        f"* استخدم عبارات مثل: 'أنا مستعد للتعلم'، 'أسعى لاكتساب الخبرة'، 'لديّ شغف بالمجال'.\n"
        f"* لا تعتذر عن قلة الخبرة — قدّم الحماس بديلاً مقنعاً.\n"
        f"* كن صادقًا ومهنيًا بدون تجميل وهمي.\n\n"
        f"قاعدة إلزامية: عند الشك تجاهل المعلومة. الواقعية أهم من الإقناع.\n\n"
        f"اسم المتقدم:\n{name}\n\n"
        f"المسمى الوظيفي:\n{job_title}\n\n"
        f"الشركة:\n{company or 'غير محددة'}\n\n"
        f"وصف الوظيفة:\n{desc[:600] or 'غير متاح'}\n"
        f"{cv_section}\n"
        f"المطلوب:\n"
        f"إخراج رسالة تغطية رسمية قصيرة فقط بدون أي شرح إضافي."
    )

    parts: list[dict] = [{"text": prompt}]

    try:
        async with httpx.AsyncClient(timeout=40) as client:
            r = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
                json={"contents": [{"parts": parts}]},
            )
            data = r.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        logger.warning("Gemini error: %s", e)
        return fallback_ar if lang == "ar" else fallback_en


# ─── بناء HTML للإيميل ───

def _build_email_html(name: str, phone: str, job_title: str, company: str, cover: str, lang: str, template: str = "classic") -> str:
    is_ar = lang == "ar"
    dir_ = "rtl" if is_ar else "ltr"
    align = "right" if is_ar else "left"
    cover_html = cover.replace("\n", "<br>")
    name_lbl  = "الاسم" if is_ar else "Name"
    phone_lbl = "الجوال" if is_ar else "Phone"
    co_lbl    = "الشركة" if is_ar else "Company"
    subj_lbl  = "طلب توظيف" if is_ar else "Job Application"
    company_row = f'<tr><td style="color:#777;padding:4px 0;">{co_lbl}</td><td style="color:#222;padding:4px 0 4px 12px;" dir="ltr">{company}</td></tr>' if company else ""

    header_line = (
        f'<p style="margin:0 0 4px;color:#a78bfa;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">{subj_lbl}</p>'
        f'<h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">{job_title}</h1>'
        + (f'<p style="margin:6px 0 0;color:#888;font-size:13px;">{company}</p>' if company else "")
    )

    if template == "modern":
        return f"""<!DOCTYPE html><html dir="{dir_}" lang="{'ar' if is_ar else 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#0d0d0d;border-radius:16px 16px 0 0;padding:28px 32px;direction:{dir_};text-align:{align};">
    {header_line}
  </td></tr>
  <tr><td style="background:#fff;padding:28px 32px;direction:{dir_};text-align:{align};">
    <p style="margin:0 0 20px;color:#2c2c2c;font-size:15px;line-height:2;">{cover_html}</p>
    <hr style="border:none;border-top:1px solid #f0f0f0;margin:20px 0;">
    <p style="margin:0;color:#888;font-size:13px;">{name_lbl}: <strong style="color:#111;">{name}</strong> &nbsp;·&nbsp; {phone_lbl}: <span dir="ltr">{phone}</span></p>
  </td></tr>
  <tr><td style="background:#fafafa;border-radius:0 0 16px 16px;padding:14px 32px;direction:{dir_};text-align:{align};">
    <p style="margin:0;color:#bbb;font-size:11px;">Jobbots — التقديم التلقائي</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""

    elif template == "brief":
        lines = [l.strip() for l in cover.split("\n") if l.strip()]
        if len(lines) > 1:
            bullets = "".join(f'<li style="margin-bottom:8px;color:#333;">{l}</li>' for l in lines)
            body_content = f'<ul style="margin:0;padding-right:20px;padding-left:0;direction:{dir_};">{bullets}</ul>'
        else:
            body_content = f'<p style="margin:0;color:#333;font-size:15px;line-height:1.9;">{cover_html}</p>'
        return f"""<!DOCTYPE html><html dir="{dir_}" lang="{'ar' if is_ar else 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fff;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border:1px solid #e8e8e8;border-radius:12px;">
  <tr><td style="padding:28px 32px;direction:{dir_};text-align:{align};">
    <p style="margin:0 0 6px;color:#888;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">{subj_lbl}</p>
    <h2 style="margin:0 0 20px;color:#111;font-size:20px;font-weight:800;border-bottom:2px solid #111;padding-bottom:10px;">{job_title}</h2>
    {body_content}
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f0f0f0;">
      <table cellpadding="0" cellspacing="0"><tbody>
        <tr><td style="color:#999;font-size:12px;padding:3px 8px 3px 0;">{name_lbl}</td><td style="color:#111;font-size:12px;font-weight:600;">{name}</td></tr>
        <tr><td style="color:#999;font-size:12px;padding:3px 8px 3px 0;" dir="ltr">{phone_lbl}</td><td style="color:#111;font-size:12px;" dir="ltr">{phone}</td></tr>
        {company_row}
      </tbody></table>
    </div>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""

    else:  # classic
        return f"""<!DOCTYPE html><html dir="{dir_}" lang="{'ar' if is_ar else 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;border:1px solid #ddd;">
  <tr><td style="background:#1a1a1a;border-radius:8px 8px 0 0;padding:18px 28px;direction:{dir_};text-align:{align};">
    <p style="margin:0;color:#e5e5e5;font-size:13px;">{subj_lbl} — <strong style="color:#fff;">{job_title}</strong></p>
  </td></tr>
  <tr><td style="padding:28px;direction:{dir_};text-align:{align};">
    <p style="margin:0 0 18px;color:#1a1a1a;font-size:15px;line-height:2.0;border-right:3px solid #1a1a1a;padding-right:14px;">{cover_html}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:22px 0;">
    <table cellpadding="0" cellspacing="0" style="font-size:13px;"><tbody>
      <tr><td style="color:#666;padding:4px 10px 4px 0;">{name_lbl}</td><td style="color:#111;font-weight:600;">{name}</td></tr>
      <tr><td style="color:#666;padding:4px 10px 4px 0;">{phone_lbl}</td><td style="color:#111;" dir="ltr">{phone}</td></tr>
      {company_row}
    </tbody></table>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


# ─── إرسال عبر SMTP ───

def _send_smtp_sync(
    smtp_host: str,
    smtp_port: int,
    smtp_secure: bool,
    smtp_email: str,
    app_password: str,
    to_email: str,
    subject: str,
    html: str,
    reply_to: str,
    cv_bytes: bytes | None,
    cv_name: str | None,
    from_name: str,
) -> None:
    """إرسال الإيميل عبر SMTP المستخدم (متزامن — يُستدعى في thread منفصل)."""
    msg = MIMEMultipart("mixed")
    msg["From"] = f"{from_name} <{smtp_email}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Reply-To"] = reply_to

    msg.attach(MIMEText(html, "html", "utf-8"))

    if cv_bytes and cv_name:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(cv_bytes)
        encoders.encode_base64(part)
        safe_name = cv_name.encode("ascii", errors="replace").decode()
        part.add_header("Content-Disposition", f'attachment; filename="{safe_name}"')
        msg.attach(part)

    context = ssl.create_default_context()

    if smtp_secure:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=30) as server:
            server.login(smtp_email, app_password)
            server.sendmail(smtp_email, [to_email], msg.as_bytes())
    else:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(smtp_email, app_password)
            server.sendmail(smtp_email, [to_email], msg.as_bytes())


async def _send_smtp(
    smtp_host: str,
    smtp_port: int,
    smtp_secure: bool,
    smtp_email: str,
    app_password: str,
    to_email: str,
    subject: str,
    html: str,
    reply_to: str,
    cv_bytes: bytes | None,
    cv_name: str | None,
    from_name: str,
) -> None:
    """غلاف غير متزامن لإرسال SMTP."""
    await asyncio.to_thread(
        _send_smtp_sync,
        smtp_host, smtp_port, smtp_secure, smtp_email, app_password,
        to_email, subject, html, reply_to, cv_bytes, cv_name, from_name,
    )


async def _download_cv(client: httpx.AsyncClient, storage_path: str) -> bytes | None:
    url = f"{SUPABASE_URL}/storage/v1/object/cvs/{storage_path}"
    r = await client.get(url, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"})
    if r.is_success:
        return r.content
    return None


# ─── بصمة بيانات الوظيفة (لكشف التغيير والسماح بإعادة التقديم) ─────────────

def _job_fingerprint(title: str, email: str, desc: str) -> str:
    """SHA-256 مختصر (16 حرف) لكشف تغيير بيانات الوظيفة."""
    text = f"{title}|{email}|{desc[:500]}"
    return hashlib.sha256(text.encode()).hexdigest()[:16]


# ─── استخراج نص PDF محلياً (بدون API) ────────────────────────────────────────

def _extract_pdf_text_local(cv_bytes: bytes) -> str:
    """استخراج النص من ملف PDF محلياً باستخدام pdfplumber — أسرع وأوفر من Gemini."""
    if not _PDFPLUMBER_OK or not cv_bytes:
        return ""
    try:
        with pdfplumber.open(io.BytesIO(cv_bytes)) as pdf:
            pages: list[str] = []
            for page in pdf.pages[:12]:
                text = page.extract_text() or ""
                if text.strip():
                    pages.append(text.strip())
            return "\n\n".join(pages)
    except Exception as e:
        logger.warning("pdfplumber: %s", e)
        return ""


# ─── استخراج سنوات الخبرة من نص السيرة الذاتية ────────────────────────────

_FRESH_KW = (
    "حديث تخرج", "حديثة التخرج", "fresh graduate", "just graduated",
    "خريج حديث", "خريجة حديثة", "no experience", "لا خبرة", "بدون خبرة",
    "لا توجد خبرة", "مستجد",
)

def _extract_cv_years(cv_text: str) -> int | None:
    """
    يستخرج سنوات الخبرة الفعلية من نص السيرة الذاتية.
    يعيد: عدد صحيح، أو None إذا لم يتمكن من التحديد.
    """
    if not cv_text:
        return None
    lower = cv_text.lower()

    # حديث تخرج / بدون خبرة → 0
    for kw in _FRESH_KW:
        if kw.lower() in lower:
            return 0

    # أنماط الاستخراج — العربية والإنجليزية
    patterns = [
        r'سنوات?\s*الخبرة[^\d]*(\d+)',
        r'(\d+)\s*سنوات?\s*(?:من\s*)?(?:الخبرة|خبرة)',
        r'years?\s*of\s*experience[^\d]*(\d+)',
        r'(\d+)\s*\+?\s*years?\s*(?:of\s*)?experience',
        r'experience[:\s]+(\d+)\s*years?',
        r'(\d+)\s*years?\s*experience',
        r'خبرة\s*:?\s*(\d+)\s*سنوات?',
    ]
    candidates: list[int] = []
    for p in patterns:
        for m in re.finditer(p, lower):
            y = int(m.group(1))
            if 0 <= y <= 40:
                candidates.append(y)

    return min(candidates) if candidates else None


# ─── استخراج سنوات الخبرة المطلوبة من وصف الوظيفة ────────────────────────

def _extract_required_years(job_desc: str, job_title: str = "") -> int | None:
    """يستخرج الحد الأدنى لسنوات الخبرة المطلوبة من وصف الوظيفة."""
    text = (job_title + " " + job_desc).lower()
    patterns = [
        r'(\d+)\s*\+\s*years?',
        r'(\d+)\s*\+?\s*(?:سنوات?|years?)\s*(?:of\s*)?(?:experience|خبرة)',
        r'(?:experience|خبرة)\s*(?:of\s*|لا تقل عن\s*)?(\d+)\s*\+?\s*(?:سنوات?|years?)',
        r'خبرة\s+لا\s+تقل\s+عن\s+(\d+)',
        r'minimum\s+(\d+)\s+years?',
        r'at\s+least\s+(\d+)\s+years?',
        r'(\d+)\s*-\s*\d+\s*years?\s*(?:of\s*)?experience',
        r'خبرة\s*:?\s*(\d+)',
    ]
    candidates: list[int] = []
    for p in patterns:
        for m in re.finditer(p, text):
            y = int(m.group(1))
            if 1 <= y <= 30:
                candidates.append(y)
    return min(candidates) if candidates else None


# ─── نظام القواعد الصارمة (قبل AI) ──────────────────────────────────────────

_SENIOR_KW = (
    "senior", "sr.", "lead", "principal", "director", "head of",
    "manager", "رئيس", "قائد", "مدير", "أول", "خبير", "متقدم",
    "lead engineer", "team lead",
)

def _hard_rules_check(
    cv_text: str,
    job_desc: str,
    job_title: str,
) -> tuple[bool, str]:
    """
    فحص صارم قبل إرسال الوظيفة للـ AI.
    يعيد (should_skip: bool, reason: str)
    أي قاعدة مكسورة = رفض حتمي بغض النظر عن رأي الـ AI.
    """
    cv_years   = _extract_cv_years(cv_text) if cv_text else None
    req_years  = _extract_required_years(job_desc, job_title)

    # لا نرفض بسبب فجوة الخبرة — نقدّم لجميع الوظائف
    # (إذا لم يكن لدى المستخدم خبرة كافية، رسالة التغطية ستذكر الاستعداد للتعلم)

    # قاعدة 3: سيرة ذاتية فارغة من النص
    if cv_text and len(cv_text.strip()) < 100:
        return True, "السيرة الذاتية فارغة أو غير قابلة للقراءة"

    return False, ""


# ─── تحليل مدى ملاءمة المستخدم للوظيفة (Gemini AI) ───────────────────────────

async def _analyze_job_fit(
    job_title: str,
    company: str,
    job_desc: str,
    cv_parsed_text: str | None,
    field_names: list[str],
    certifications: list[dict],
) -> dict:
    """
    يحلل مدى ملاءمة المستخدم للوظيفة عبر Gemini.
    يعيد: {"score": int, "decision": "apply"|"skip", "reasons": list, "missing": list}

    الفلسفة: قدّم بشكل افتراضي — ارفض فقط عند حواجز صارمة وواضحة.
    """
    # Fallback = apply دائماً عند فشل الاتصال — لا نمنع التقديم بسبب مشكلة تقنية
    fallback = {"score": 70, "decision": "apply", "reasons": ["تم التقديم"], "missing": [], "status": "تم التقديم"}
    if not GEMINI_API_KEY:
        return fallback

    cert_text = "\n".join(
        f"- {c.get('type', '')}: {c.get('name', '')}" + (f" ({c['issuer']})" if c.get("issuer") else "")
        for c in certifications
    ) or "لا يوجد"

    prefs_text = "، ".join(field_names) if field_names else "غير محدد"

    prompt = (
        "أنت نظام ترشيح وتقديم وظائف ذكي. مهمتك الأساسية زيادة فرص التقديم للمستخدم.\n"
        "دورك 'مساعد تقديم' وليس 'لجنة قبول' ولا 'موظف موارد بشرية متشدد'.\n\n"

        "✅ قدّم دائماً إذا كانت الوظيفة قريبة أو ذات صلة — حتى لو:\n"
        "  - الخبرة المطلوبة أكثر مما لدى المرشح\n"
        "  - التخصص قريب وليس مطابقاً حرفياً\n"
        "  - المرشح حديث تخرج أو Senior أو Lead\n"
        "  - الوصف ناقص أو غير واضح\n"
        "  - ليست كل المهارات موجودة\n\n"

        "❌ امتنع عن التقديم (skip) فقط في هذه الحالات الواضحة جداً:\n"
        "  1. الوظيفة مخصصة لجنس معين بشكل صريح (للنساء فقط / للرجال فقط)\n"
        "  2. الوظيفة تشترط جنسية محددة والمرشح لا يملكها\n"
        "  3. شرط أساسي مستحيل: رخصة مهنية إلزامية أو شهادة طبية متخصصة غير موجودة\n"
        "  4. المجال بعيد تماماً ولا علاقة له (مثال: وظيفة طبيب لمرشح في المحاسبة)\n\n"

        "⚠️ لا ترفض أبداً بسبب:\n"
        "  - نقص سنوات الخبرة مهما كان\n"
        "  - اختلاف بسيط في التخصص\n"
        "  - كون الوظيفة Senior أو Lead أو Manager\n"
        "  - التأنيث اللغوي (كلمات مثل: بشرية، رقمية، سلامة، مراجعة، إدارية — ليست دليلاً على أن الوظيفة للنساء)\n\n"

        "التخصصات المترابطة — قبل التقديم بينها:\n"
        "  المالية ↔ المحاسبة ↔ إدارة الأعمال ↔ التسويق ↔ المبيعات ↔ خدمة العملاء\n"
        "  ↔ التحليل ↔ الإدارة ↔ الموارد البشرية ↔ التشغيل ↔ الدعم الإداري\n\n"

        "إذا كنت مترددًا بين التقديم والرفض → اختر التقديم.\n\n"

        f"=== الوظيفة ===\n"
        f"المسمى: {job_title}\n"
        f"الشركة: {company or 'غير محدد'}\n"
        f"الوصف: {job_desc[:800] or 'غير متاح'}\n\n"
        f"=== المرشح ===\n"
        f"التخصصات: {prefs_text}\n"
        f"الشهادات/الرخص: {cert_text}\n"
        f"السيرة الذاتية:\n{(cv_parsed_text or 'غير متاح')[:900]}\n\n"

        "=== الإجابة المطلوبة ===\n"
        "أعد JSON فقط بلا markdown أو شرح:\n"
        '{"decision":"apply","status":"تم التقديم","block":""}\n'
        "- decision: 'apply' أو 'skip'\n"
        "- status: نص قصير: 'تم التقديم' أو 'تم التقديم رغم نقص بسيط' أو 'تم التجاوز'\n"
        "- block: سبب التجاوز فقط إن كان skip (جملة واحدة) وإلا ''\n"
        "JSON فقط، بلا أي نص إضافي."
    )

    models = ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-2.5-flash"]
    for model in models:
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}",
                    headers={"Content-Type": "application/json"},
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                )
            if r.status_code in (429, 503, 404):
                continue
            if not r.is_success:
                continue
            raw_text = (r.json().get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [{}])[0]
                            .get("text", "")).strip()
            if not raw_text:
                continue
            m = re.search(r'\{[\s\S]*\}', raw_text)
            if not m:
                continue
            parsed = json.loads(m.group())

            ai_decision = str(parsed.get("decision", "apply")).strip().lower()
            status      = str(parsed.get("status", "تم التقديم")).strip()
            block       = str(parsed.get("block", "")).strip()

            # ارفض فقط إذا قرر AI "skip" وذكر سبباً صارماً
            if ai_decision == "skip" and block:
                return {"score": 20, "decision": "skip", "reasons": [block], "missing": [block], "status": "تم التجاوز"}

            # في كل حالة أخرى: قدّم
            return {"score": 75, "decision": "apply", "reasons": [status or "تم التقديم"], "missing": [], "status": status or "تم التقديم"}
        except Exception:
            continue
    return fallback


# ─── استدعاء Supabase Edge Function ───

async def _call_edge_function() -> dict:
    """يستدعي الـ Edge Function في Supabase ويعيد النتيجة."""
    # الـ Edge Function تحتاج JWT (eyJ...) — نستخدم SUPABASE_JWT_ANON_KEY أولاً
    jwt_key = (
        os.getenv("SUPABASE_JWT_ANON_KEY", "") or
        os.getenv("SUPABASE_ANON_KEY", "") or
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or
        SUPABASE_KEY
    )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_key}",
        "apikey": jwt_key,
    }

    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(EDGE_FUNCTION_URL, headers=headers, json={})
        r.raise_for_status()
        return r.json()


# ─── الدورة الرئيسية ───

async def run_cycle() -> None:
    logger.info("🚀 استدعاء Supabase Edge Function: %s", EDGE_FUNCTION_URL)
    try:
        result = await _call_edge_function()
        applied = result.get("applied", 0)
        users   = result.get("users", 0)
        errors  = result.get("errors", [])
        logger.info("✅ Edge Function اكتملت: %d تقديم | %d مستخدم | %d خطأ",
                    applied, users, len(errors))
        if errors:
            for err in errors[:5]:
                logger.warning("   ⚠️  %s", err)
    except httpx.HTTPStatusError as e:
        logger.error("❌ Edge Function أعادت خطأ HTTP %d: %s",
                     e.response.status_code, e.response.text[:300])
    except Exception as e:
        logger.error("❌ فشل استدعاء Edge Function: %s", e)

    # تسجيل وقت التشغيل
    async with httpx.AsyncClient(timeout=15) as client:
        await _record_run(client)


async def _run_cycle_smtp() -> None:
    """النسخة القديمة — SMTP مباشر من Replit (احتياطي فقط)."""
    if not SMTP_ENCRYPTION_KEY:
        logger.error("SMTP_ENCRYPTION_KEY غير معرّف — دورة متوقفة")
        return

    async with httpx.AsyncClient(timeout=30, base_url=SUPABASE_URL) as client:
        # حذف الوظائف الأقدم من 10 أيام
        cutoff = datetime.now(timezone.utc) - timedelta(days=10)
        try:
            del_r = await client.delete(
                f"{SUPABASE_URL}/rest/v1/admin_jobs",
                headers=_SB_HEADERS,
                params={"created_at": f"lt.{cutoff.isoformat()}"},
            )
            if del_r.is_success:
                deleted = del_r.json() if del_r.text else []
                if deleted:
                    logger.info("🗑️  تم حذف %d وظيفة أقدم من 10 أيام", len(deleted))
        except Exception as e:
            logger.warning("خطأ أثناء حذف الوظائف القديمة: %s", e)

        jobs_raw = await sb_get(client, "admin_jobs", {"is_active": "eq.true"})
        jobs = [j for j in jobs_raw if _is_valid_email((j.get("application_email") or "").strip())]
        if not jobs:
            logger.info("لا توجد وظائف نشطة بإيميلات صحيحة — تخطي")
            return

        users = await sb_get(client, "users")
        fields_raw = await sb_get(client, "job_fields", {})

        logger.info("🔍 فحص %d مستخدم مع %d وظيفة نشطة", len(users), len(jobs))

        for user in users:
            name_log = user.get("full_name") or str(user.get("id", ""))[:8]

            if not _is_subscription_active(user):
                logger.info("⏭️  %s — اشتراك منتهٍ", name_log)
                continue

            uid = str(user["id"])
            count_today = await sb_get_count(
                client, "applications",
                {"user_id": f"eq.{uid}", "applied_at": f"gte.{datetime.now(timezone.utc).date().isoformat()}"},
            )
            if count_today >= 10:
                logger.info("⏭️  %s — وصل حد اليوم (%d)", name_log, count_today)
                continue

            settings_rows = await sb_get(client, "user_settings", {"user_id": f"eq.{uid}"})
            settings = settings_rows[0] if settings_rows else {}

            # SMTP فقط — لا Resend
            smtp_email    = (settings.get("smtp_email") or "").strip()
            smtp_host     = settings.get("smtp_host") or "smtp.gmail.com"
            smtp_port     = int(settings.get("smtp_port") or 465)
            smtp_secure   = settings.get("smtp_secure") if settings.get("smtp_secure") is not None else True
            encrypted_pw  = (settings.get("smtp_app_password_encrypted") or "").strip()
            has_smtp      = bool(settings.get("email_connected") and smtp_email and encrypted_pw)

            if not smtp_email:
                logger.info("⏭️  %s — لم يُضف إيميله بعد", name_log)
                continue

            if not has_smtp:
                logger.info("⏭️  %s — لم يربط Gmail App Password بعد", name_log)
                continue

            app_password = ""
            try:
                app_password = _decrypt_aes(encrypted_pw, SMTP_ENCRYPTION_KEY)
            except Exception as e:
                logger.warning("⏭️  %s — فشل فك تشفير كلمة المرور: %s", name_log, e)
                continue

            cv_rows = await sb_get(client, "user_cvs", {"user_id": f"eq.{uid}"})
            cv = cv_rows[0] if cv_rows else None
            if not cv:
                logger.info("⏭️  %s — لا توجد سيرة ذاتية", name_log)
                continue

            # تنزيل الـ CV (مطلوب للإرفاق بالإيميل وـ AI matching)
            storage_path = (cv.get("storage_path") or "").strip()
            cv_name = cv.get("file_name") or "cv.pdf"
            cv_mime = (
                "application/pdf" if cv_name.lower().endswith(".pdf")
                else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                if cv_name.lower().endswith(".docx") else "application/octet-stream"
            )
            cv_bytes: bytes | None = None
            if storage_path:
                cv_bytes = await _download_cv(client, storage_path)

            # تحليل السيرة الذاتية مرة واحدة وتخزين الملخص — الدورات التالية تستخدم النص المحفوظ بدون Gemini
            cv_parsed_text = await _get_or_parse_cv(client, cv, cv_bytes, cv_mime)

            prefs_rows = await sb_get(client, "user_job_preferences", {"user_id": f"eq.{uid}"})
            pref_ids = {str(p["job_field_id"]) for p in prefs_rows if p.get("job_field_id")}
            field_names_base = [
                f.get("name_ar") or f.get("name_en") or ""
                for f in fields_raw if str(f["id"]) in pref_ids
            ]
            # دمج taxonomy_keywords من user_settings (تم توسيعها عند الحفظ)
            taxonomy_kws = settings.get("taxonomy_keywords") or []
            if isinstance(taxonomy_kws, list):
                field_names = list(dict.fromkeys(field_names_base + [str(k) for k in taxonomy_kws if k]))
            else:
                field_names = field_names_base

            cert_rows = await sb_get(client, "user_certifications", {"user_id": f"eq.{uid}"})
            certifications = [
                {"type": c.get("type", ""), "name": c.get("name", ""), "issuer": c.get("issuer")}
                for c in cert_rows
            ]

            name = user.get("full_name") or "المتقدم"
            phone = user.get("phone") or ""
            lang = settings.get("application_language") or "ar"
            template = settings.get("template_type") or "classic"
            allow_tamheer     = bool(settings.get("allow_tamheer", False))
            allow_cooperative = bool(settings.get("allow_cooperative", False))
            remaining = 10 - count_today
            sent = 0

            # حساب تاريخ 30 يوماً مضت لفحص التقديمات المكررة
            thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

            logger.info("👤 %s | تفضيلات: %s | متبقي: %d", name, field_names or "لا يوجد", remaining)

            for job in jobs:
                if sent >= remaining:
                    break

                job_id = str(job["id"])
                job_title = job.get("title_ar") or job.get("title_en") or "وظيفة"
                company = job.get("company") or ""
                desc = (job.get("description_ar") or job.get("description_en") or "")[:1500]
                to_email = (job.get("application_email") or "").strip()

                # فحص التقديمات المكررة مع كشف التغيير: إذا تغيّرت بيانات الوظيفة يُسمح بالإعادة
                fingerprint = _job_fingerprint(job_title, to_email, desc)
                recent_rows = await sb_get(
                    client, "applications",
                    {
                        "user_id":    f"eq.{uid}",
                        "job_id":     f"eq.{job_id}",
                        "applied_at": f"gte.{thirty_days_ago}",
                        "order":      "applied_at.desc",
                        "limit":      "1",
                    },
                )
                if recent_rows:
                    last_fp = (recent_rows[0].get("job_fingerprint") or "").strip()
                    # سياسة محافظة: fingerprint فارغ (سجلات قبل الـ rollout) = نعامله كمكرر
                    if not last_fp or last_fp == fingerprint:
                        reason = (
                            "قُدِّم مؤخراً (أقل من 30 يوم — تطبيق محافظ)" if not last_fp
                            else "قُدِّم مؤخراً (أقل من 30 يوم وبيانات الوظيفة لم تتغير)"
                        )
                        logger.info("   ⏭️  [%s] — %s", job_title, reason)
                        continue
                    # بيانات الوظيفة تغيّرت بشكل مثبت → السماح بإعادة التقديم
                    logger.info("   🔄 [%s] — بيانات الوظيفة تغيّرت — إعادة التقديم مسموحة", job_title)

                # الفلاتر الرخيصة قبل استدعاء AI
                if not _is_valid_email(to_email):
                    logger.warning("   ⚠️  إيميل الوظيفة غير صالح: [%s] — تخطي", to_email)
                    continue

                # فلتر برامج التوظيف — تمهير والتدريب التعاوني
                if _is_tamheer_job(job) and not allow_tamheer:
                    logger.info("   ⏭️  وظيفة تمهير — المستخدم لم يفعّل هذا البرنامج: [%s]", job_title)
                    continue
                if _is_cooperative_job(job) and not allow_cooperative:
                    logger.info("   ⏭️  وظيفة تدريب تعاوني — المستخدم لم يفعّل هذا البرنامج: [%s]", job_title)
                    continue

                matched = _job_matches_user(job, field_names)
                logger.info("   🔎 وظيفة [%s] → %s", job_title, "✓ تطابق مبدئي" if matched else "✗ لا تطابق")
                if not matched:
                    continue

                # ── القواعد الصارمة (قبل AI — توفير API calls) ──────────────────
                should_skip, skip_reason = _hard_rules_check(cv_parsed_text or "", desc, job_title)
                if should_skip:
                    logger.info("   🚫 قاعدة صارمة [%s] — %s", job_title, skip_reason)
                    continue

                # ── تحليل AI لمدى ملاءمة الوظيفة (يعمل لكل وظيفة مطابقة للتفضيلات) ──
                fit = await _analyze_job_fit(
                    job_title=job_title,
                    company=company,
                    job_desc=desc,
                    cv_parsed_text=cv_parsed_text,
                    field_names=field_names,
                    certifications=certifications,
                )
                fit_status = fit.get("status", "تم التقديم" if fit["decision"] == "apply" else "تم التجاوز")
                if fit["decision"] == "skip":
                    block_str = "، ".join(fit["missing"][:1]) or "؛ ".join(fit["reasons"][:1])
                    logger.info("   ⛔ تم التجاوز — [%s]: %s", job_title, block_str)
                    continue
                logger.info("   ✅ %s — [%s]", fit_status, job_title)

                # فلتر الجنس (حاجز صارم بعد AI)
                user_gender = (user.get("gender") or "male")
                if user_gender == "male" and _is_feminine_job(job):
                    logger.info("   ⏭️  وظيفة نسائية — المستخدم ذكر: [%s] (score=%d)", job_title, fit["score"])
                    continue

                # الانتظار بين الإرسالات
                now_m = time.monotonic()
                last_m = _last_send.get(uid, 0)
                wait = _SEND_INTERVAL - (now_m - last_m)
                if wait > 0:
                    await asyncio.sleep(wait)

                # ── Cover Letter: يولَّد مرة واحدة فقط، ثم يُقرأ من DB ──────────
                saved_body = (settings.get("cover_letter_body") or "").strip()
                if saved_body:
                    # أضف جملة ديناميكية بالوظيفة الفعلية في بداية الرسالة
                    co_str = f" في {company}" if company else ""
                    job_intro = f"أتقدم بهذه الرسالة للتقديم على وظيفة {job_title}{co_str}.\n\n"
                    cover = _strip_emojis(job_intro + saved_body)
                    logger.info("   📄 cover letter من DB (لا استدعاء Gemini)")
                else:
                    cover = await _generate_cover_letter(job_title, name, company, desc, lang, cv_parsed_text, template)
                    cover = _strip_emojis(cover)
                    # حفظ قالب generic للمرات القادمة (بدون اسم وظيفة/شركة — يُضافان في wrapper)
                    generic_body = _build_plain_text_body(name, field_names)
                    try:
                        async with httpx.AsyncClient(timeout=10) as _sc:
                            await _sc.patch(
                                f"{SUPABASE_URL}/rest/v1/user_settings?user_id=eq.{uid}",
                                json={"cover_letter_body": generic_body},
                                headers=_SB_HEADERS,
                            )
                        settings["cover_letter_body"] = generic_body  # تحديث في الذاكرة
                        logger.info("   💾 تم حفظ cover letter في DB")
                    except Exception as _e:
                        logger.warning("   ⚠️ فشل حفظ cover letter: %s", _e)
                html = _build_email_html(name, phone, job_title, company, cover, lang, template)
                subject = f"التقديم على وظيفة: {_strip_emojis(job_title)}" if lang == "ar" else f"Application for: {_strip_emojis(job_title)}"

                sent_at = datetime.now(timezone.utc).isoformat()
                status = "sent"
                error_reason = None

                try:
                    await _send_smtp(
                        smtp_host=smtp_host,
                        smtp_port=smtp_port,
                        smtp_secure=smtp_secure,
                        smtp_email=smtp_email,
                        app_password=app_password,
                        to_email=to_email,
                        subject=subject,
                        html=html,
                        reply_to=smtp_email,
                        cv_bytes=cv_bytes,
                        cv_name=cv_name,
                        from_name=name,
                    )
                    _last_send[uid] = time.monotonic()
                    sent += 1
                    logger.info("✅ تقديم: %s → %s (%s) | score=%d", name, job_title, to_email, fit["score"])
                except Exception as e:
                    status = "failed"
                    error_reason = str(e)[:500]
                    logger.warning("❌ فشل: %s → %s: %s", name, job_title, e)

                # تسجيل التقديم (ناجح أو فاشل) في قاعدة البيانات
                try:
                    await client.post(
                        f"{SUPABASE_URL}/rest/v1/applications",
                        headers={**_SB_HEADERS},
                        json={
                            "user_id":         uid,
                            "job_title":       job_title,
                            "job_id":          job_id,
                            "applied_at":      sent_at,
                            "status":          status,
                            "provider_used":   "smtp",
                            "error_reason":    error_reason,
                            "sent_at":         sent_at if status == "sent" else None,
                            "match_score":     fit["score"],
                            "job_fingerprint": fingerprint,
                        },
                    )
                except Exception as e:
                    logger.warning("تعذّر حفظ سجل التقديم: %s", e)

            if sent > 0:
                logger.info("📊 %s: %d تقديم جديد", name, sent)


async def _record_run(client: httpx.AsyncClient) -> None:
    """يسجّل وقت آخر تشغيل في جدول worker_status — يستخدم service role لتجاوز RLS."""
    now_iso = datetime.now(timezone.utc).isoformat()
    next_iso = (datetime.now(timezone.utc) + timedelta(seconds=CYCLE_INTERVAL)).isoformat()
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or SUPABASE_KEY
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    try:
        await client.post(
            f"{SUPABASE_URL}/rest/v1/worker_status",
            headers=headers,
            json={"id": "main", "last_ran_at": now_iso, "next_run_at": next_iso},
        )
    except Exception as e:
        logger.warning("تعذّر تسجيل وقت التشغيل: %s", e)


JOB_FETCH_INTERVAL = int(os.getenv("JOB_FETCH_INTERVAL", str(6 * 3600)))  # 6 ساعات افتراضياً
_last_job_fetch: float = 0.0


async def _run_job_fetcher() -> None:
    """جلب الوظائف من تويتر — معطّل."""
    return  # تم تعطيل جلب تويتر


async def _run_telegram_listener() -> None:
    """يشغّل مستمع Telegram في الخلفية — لا يوقف بقية الـ Worker"""
    try:
        from telegram_listener import run_listener
        await run_listener()
    except Exception as e:
        logger.error("[TG-Listener] توقف بخطأ: %s", e)


async def main() -> None:
    # ابدأ مستمع Telegram في الخلفية (إن كانت الإعدادات موجودة)
    if os.getenv("TELEGRAM_SESSION_STRING") and os.getenv("TELEGRAM_API_ID"):
        logger.info("📡 بدء مستمع Telegram الشخصي...")
        asyncio.create_task(_run_telegram_listener())
    else:
        logger.info("📡 مستمع Telegram متوقف (TELEGRAM_SESSION_STRING غير مضبوط)")

    if os.getenv("DISABLE_PYTHON_WORKER", "false").lower() in ("true", "1", "yes"):
        logger.info("⏸️  Python worker موقوف — الـ Edge Function في Supabase هي المسؤولة عن الإرسال")
        logger.info("🐦 جالب الوظائف من تويتر نشط — يعمل كل %d ساعة", JOB_FETCH_INTERVAL // 3600)
        await _run_job_fetcher()
        while True:
            await asyncio.sleep(3600)
            await _run_job_fetcher()
        return

    logger.info("🚀 Auto-Apply Worker بدأ (كل %d ثانية) — يستدعي Supabase Edge Function", CYCLE_INTERVAL)
    await _run_job_fetcher()  # جلب أول عند البدء
    while True:
        start_ts = datetime.now(timezone.utc)
        try:
            await run_cycle()
        except Exception as e:
            logger.exception("خطأ غير متوقع في الدورة: %s", e)

        await _run_job_fetcher()

        elapsed = (datetime.now(timezone.utc) - start_ts).total_seconds()
        sleep_for = max(0, CYCLE_INTERVAL - elapsed)
        logger.info("💤 انتظار %.0f ثانية حتى الدورة القادمة…", sleep_for)
        await asyncio.sleep(sleep_for)


if __name__ == "__main__":
    asyncio.run(main())
