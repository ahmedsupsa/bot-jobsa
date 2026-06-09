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
      2. استخراج محلي بـ pdfplumber (بدون AI)
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

    # تحليل محلي بدون AI — استخراج المؤهل والتخصص والخبرة عبر patterns
    parsed_text = _parse_cv_local(local_text or "") if local_text else ""
    if not parsed_text and cv_bytes:
        # إذا ملف PDF ما استخرجنا منه نص — نجرب نرسل مباشرة (DOCX إلخ)
        if cv_mime != "application/pdf":
            try:
                import textract
                local_text = textract.process(io.BytesIO(cv_bytes)).decode("utf-8", errors="replace")
                parsed_text = _parse_cv_local(local_text)
            except Exception:
                pass

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


def _inject_job_title_into_body(body: str, job_title: str) -> str:
    """يستبدل أي مسمى وظيفي قديم مدمج داخل الرسالة المحفوظة بالمسمى الفعلي الجديد."""
    body = re.sub(r'لشغل منصب [^،.\n]{1,80}', f'لشغل منصب {job_title}', body)
    body = re.sub(r'لشغل وظيفة [^،.\n]{1,80}', f'لشغل وظيفة {job_title}', body)
    body = re.sub(r'على وظيفة [^،.\n]{1,80}', f'على وظيفة {job_title}', body)
    body = re.sub(r'للانضمام كـ?\s*[^،.\n]{1,80}', f'للانضمام كـ{job_title}', body)
    return body


def _build_smart_cover_body(name: str, field_names: list[str], cv_parsed_text: str | None = None, lang: str = "ar") -> str:
    """
    يبني قالب رسالة تغطية ذكي بناءً على معلومات السيرة الذاتية المستخرجة محلياً.
    يُحفظ القالب في DB ويُحقن فيه المسمى الوظيفي + الشركة لاحقاً.
    """
    spec = field_names[0] if field_names else "مجال التخصص"

    if lang != "ar":
        is_fresh_en = False
        degree_en = ""
        uni_en = ""
        years_en = ""

        if cv_parsed_text:
            lower = cv_parsed_text.lower()
            if "سنوات الخبرة: 0" in lower or "حديث تخرج" in lower:
                is_fresh_en = True
            for line in cv_parsed_text.split("\n"):
                line = line.strip()
                if line.startswith("المؤهل العلمي:"):
                    degree_en = line.replace("المؤهل العلمي: ", "").strip()
                elif line.startswith("الجهة التعليمية:"):
                    uni_en = line.replace("الجهة التعليمية: ", "").strip()
                elif line.startswith("سنوات الخبرة:"):
                    years_en = line.replace("سنوات الخبرة: ", "").strip()

        if is_fresh_en:
            intro = f"My name is {name}"
            if degree_en:
                intro += f", holding a {degree_en}"
            if uni_en:
                intro += f" from {uni_en}"
            intro += "."
            return (
                f"{intro}\n\n"
                f"I am a fresh graduate eager to begin my career in {spec}. "
                f"I have a strong academic background and a genuine desire to develop my skills. "
                f"I am fully prepared to learn, adapt, and contribute positively to your team."
            )

        if degree_en or years_en:
            intro = f"My name is {name}"
            if degree_en:
                intro += f", holding a {degree_en}"
            if uni_en:
                intro += f" from {uni_en}"
            if years_en:
                intro += f". I have {years_en} of practical experience"
            intro += "."
            return (
                f"{intro}\n\n"
                f"I have solid experience in {spec} that enables me to contribute effectively. "
                f"I am passionate about my field and committed to continuous growth. "
                f"Please find my CV attached for further details on my qualifications."
            )

        return (
            f"My name is {name}, specialized in {spec}. "
            f"I am writing to express my strong interest in joining your team. "
            f"Please find my CV attached for a complete overview of my qualifications "
            f"and experience. I look forward to the opportunity to contribute to your organization."
        )

    # تحليل نص السيرة الذاتية (إن وُجد) لتخصيص الرسالة
    is_fresh = False
    has_degree = False
    degree_text = ""
    uni_text = ""
    years_text = ""

    if cv_parsed_text:
        lower = cv_parsed_text.lower()
        if "سنوات الخبرة: 0" in lower or "حديث تخرج" in lower:
            is_fresh = True
        for line in cv_parsed_text.split("\n"):
            line = line.strip()
            if line.startswith("المؤهل العلمي:"):
                has_degree = True
                degree_text = line.replace("المؤهل العلمي: ", "").strip()
            elif line.startswith("الجهة التعليمية:"):
                uni_text = line.replace("الجهة التعليمية: ", "").strip()
            elif line.startswith("سنوات الخبرة:"):
                years_text = line.replace("سنوات الخبرة: ", "").strip()

    # ── قوالب ذكية حسب حالة المتقدم ──
    if is_fresh:
        # حديث تخرج — تركيز على المؤهل والحماس للتعلم
        intro = f"أنا {name}"
        if degree_text:
            intro += f"، حاصل على {degree_text}"
        if uni_text:
            intro += f" من {uni_text}"
        intro += "."
        return (
            f"{intro}\n\n"
            f"أنا حديث التخرج وأتطلع لبدء مسيرتي المهنية في مجال {spec}. "
            f"أتمتع بمؤهل أكاديمي قوي ورغبة حقيقية في تطوير مهاراتي والمساهمة في نجاح فريقكم. "
            f"لديّ استعداد تام للتعلم والتكيف مع بيئة العمل، وسأبذل قصارى جهدي لأكون إضافة إيجابية لشركتكم."
        )

    if has_degree or years_text:
        # لديه مؤهل أو خبرة — رسالة احترافية
        intro = f"أنا {name}"
        if degree_text:
            intro += f"، حاصل على {degree_text}"
        if uni_text:
            intro += f" من {uni_text}"
        if years_text:
            years_num = years_text.replace("سنوات", "").replace("سنة", "").strip()
            try:
                if int(years_num) > 0:
                    intro += f". لدي {years_text} من الخبرة العملية"
            except ValueError:
                pass
        intro += "."
        return (
            f"{intro}\n\n"
            f"أمتلك خبرة عملية في مجال {spec} تؤهلني للمساهمة بفعالية في تحقيق أهداف فريقكم. "
            f"أنا شغوف بمجالي وأسعى دائماً لتطوير مهاراتي والارتقاء بأدائي. "
            f"أرفقت سيرتي الذاتية للاطلاع على تفاصيل مؤهلاتي وخبراتي السابقة، "
            f"وأتطلع لفرصة التواصل معكم."
        )

    # ── قالب عام (بدون معلومات إضافية) ──
    return (
        f"أنا {name}، متخصص في {spec}، وأتقدم بهذه الرسالة راغباً في الانضمام إلى فريقكم.\n\n"
        f"أرفقت لكم سيرتي الذاتية الكاملة التي تتضمن تفاصيل مؤهلاتي وخبراتي، "
        f"وأتطلع إلى فرصة للتواصل معكم."
    )


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
    """استخراج النص من ملف PDF محلياً باستخدام pdfplumber."""
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


# ─── استخراج معلومات السيرة الذاتية محلياً (بدون AI) ──────────────────────────

_DEGREE_PATTERNS_AR = [
    (r"(دكتوراه|دكتوراة)", "دكتوراه"),
    (r"(ماجستير|ماجستير|ماستر)", "ماجستير"),
    (r"(بكالوريوس|بكالوريوس|بكالوريس)", "بكالوريوس"),
    (r"(دبلوم\s+عالي|دبلوم عال)", "دبلوم عالي"),
    (r"(دبلوم|دبلومة)", "دبلوم"),
    (r"(ثانوية\s+عامة|ثانوي)", "ثانوية عامة"),
]
_DEGREE_PATTERNS_EN = [
    (r"(ph\.?\s*d\.?|phd|doctorate)", "PhD"),
    (r"(master['´`]?s?\s+(degree|of)|m\.?\s*s\b|mba)", "Master"),
    (r"(bachelor['´`]?s?\s+(degree|of)|b\.?\s*s\b|b\.?a\b|bachelor)", "Bachelor"),
    (r"(higher\s+diploma|post\s*grad)", "Higher Diploma"),
    (r"(diploma|diplome)", "Diploma"),
    (r"(high\s+school)", "High School"),
]

_MAJOR_KW = {
    "علوم حاسب", "حاسب آلي", "تقنية معلومات", "it", "information technology",
    "software engineering", "هندسة برمجيات", "برمجيات", "computer science",
    "computer engineering", "هندسة حاسب", "هندسة الحاسب",
    "محاسبة", "accounting", "مالية", "finance",
    "إدارة أعمال", "business administration", "business",
    "تسويق", "marketing", "مبيعات", "sales",
    "هندسة مدنية", "civil engineering", "هندسة ميكانيكية", "mechanical engineering",
    "هندسة كهربائية", "electrical engineering", "هندسة صناعية", "industrial engineering",
    "هندسة كيميائية", "chemical engineering", "هندسة معمارية", "architecture",
    "طب", "medicine", "تمريض", "nursing", "صيدلة", "pharmacy",
    "قانون", "law", "حقوق",
    "تربية", "education", "لغة عربية", "لغة إنجليزية", "english",
    "إعلام", "media", "علاقات عامة", "public relations",
    "موارد بشرية", "human resources", "hr",
    "أمن سيبراني", "cyber security",
    "ذكاء اصطناعي", "artificial intelligence", "ai",
    "data science", "علم بيانات", "تحليل بيانات",
}

_UNIVERSITY_PATTERNS = [
    r"(جامعة|University|College|Institute|أكاديمية|معهد|كلية)\s+([^\n,،]{2,60})",
    r"([^\n,،]{2,60})\s+(University|College|Institute)",
]


def _extract_degree(cv_text: str) -> str:
    text = cv_text.strip()
    for pat, label in _DEGREE_PATTERNS_AR + _DEGREE_PATTERNS_EN:
        if re.search(pat, text, re.IGNORECASE):
            return label
    return ""


def _extract_major(cv_text: str) -> str:
    text = cv_text.lower()
    found = []
    for kw in _MAJOR_KW:
        if kw.lower() in text:
            found.append(kw)
    return found[0] if found else ""


def _extract_university(cv_text: str) -> str:
    for pat in _UNIVERSITY_PATTERNS:
        m = re.search(pat, cv_text)
        if m:
            name = m.group(1) if not m.group(2) else m.group(2)
            name = re.sub(r"\s+", " ", name).strip().rstrip("،,.")
            if len(name) > 3:
                return name
    return ""


def _parse_cv_local(cv_text: str) -> str:
    if not cv_text or len(cv_text.strip()) < 50:
        return ""

    degree = _extract_degree(cv_text)
    major = _extract_major(cv_text)
    uni = _extract_university(cv_text)
    years = _extract_cv_years(cv_text)

    lines = []
    if degree or major:
        parts = [degree, major] if degree and major else [degree or major]
        lines.append(f"المؤهل العلمي: {' في '.join(parts)}")
    if uni:
        lines.append(f"الجهة التعليمية: {uni}")
    if years is not None:
        label = f"{years} سنوات" if years > 0 else "حديث تخرج"
        lines.append(f"سنوات الخبرة: {label}")

    if not lines:
        return ""

    return "\n".join(lines)


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


# ─── تحليل مدى ملاءمة المستخدم للوظيفة (بدون AI — تقديم افتراضي) ──────────

async def _analyze_job_fit(
    job_title: str,
    company: str,
    job_desc: str,
    cv_parsed_text: str | None,
    field_names: list[str],
    certifications: list[dict],
) -> dict:
    """دائماً يوافق على التقديم — القواعد الصارمة تُفحص قبل هذه الدالة بـ _hard_rules_check"""
    return {"score": 70, "decision": "apply", "reasons": ["تم التقديم"], "missing": [], "status": "تم التقديم"}


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

_TEST_ADMIN_EMAIL = "ahmedsupsa@gmail.com"
_TEST_JOB_TITLE   = "وظيفة تجربة البوت"
_TEST_JOB_COMPANY = "شركة التجربة"


async def _send_via_resend(to_email: str, subject: str, html: str, from_name: str) -> None:
    """إرسال إيميل عبر Resend API مباشرةً."""
    resend_key  = os.getenv("RESEND_API_KEY", "")
    from_email  = os.getenv("RESEND_FROM_EMAIL", "")
    sender_name = from_name or os.getenv("RESEND_FROM_NAME", "Jobbots")
    if not resend_key or not from_email:
        raise RuntimeError("RESEND_API_KEY أو RESEND_FROM_EMAIL غير معرّف")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
            json={"from": f"{sender_name} <{from_email}>", "to": [to_email], "subject": subject, "html": html},
        )
        if not r.is_success:
            raise RuntimeError(f"Resend error {r.status_code}: {r.text[:200]}")


async def _send_test_cycle_emails() -> None:
    """في نهاية كل دورة: يُرسل إيميل تجريبي لكل مستخدم نشط عنده cover letter إلى ahmedsupsa@gmail.com عبر Resend."""
    logger.info("🧪 [TEST] بدء إرسال التجربة إلى %s …", _TEST_ADMIN_EMAIL)
    sent_count = 0
    skip_count = 0

    async with httpx.AsyncClient(timeout=30) as client:
        users = await sb_get(client, "users")

        for user in users:
            if not _is_subscription_active(user):
                skip_count += 1
                continue

            uid   = str(user["id"])
            name  = (user.get("full_name") or "مستخدم").strip()
            phone = (user.get("phone") or "").strip()

            settings_rows = await sb_get(client, "user_settings", {"user_id": f"eq.{uid}"})
            settings  = settings_rows[0] if settings_rows else {}
            saved_body = (settings.get("cover_letter_body") or "").strip()

            if not saved_body:
                skip_count += 1
                continue

            clean_body = _inject_job_title_into_body(saved_body, _TEST_JOB_TITLE)
            job_intro  = f"أتقدم بهذه الرسالة للتقديم على وظيفة {_TEST_JOB_TITLE} في {_TEST_JOB_COMPANY}.\n\n"
            cover      = _strip_emojis(job_intro + clean_body)
            smtp_email = (settings.get("smtp_email") or "").strip()
            lang       = settings.get("application_language") or "ar"
            template   = settings.get("template_type") or "classic"
            html       = _build_email_html(name, phone, _TEST_JOB_TITLE, _TEST_JOB_COMPANY, cover, lang, template)
            subject    = f"🧪 تجربة رسالة التغطية — {name}"

            try:
                await _send_via_resend(_TEST_ADMIN_EMAIL, subject, html, name)
                logger.info("🧪 [TEST] ✅ %s → أُرسلت", name)
                sent_count += 1
            except Exception as e:
                logger.warning("🧪 [TEST] ❌ %s → فشل: %s", name, e)
                skip_count += 1

    logger.info("🧪 [TEST] اكتملت: %d أُرسل | %d تخطى", sent_count, skip_count)


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

            # تحليل السيرة الذاتية مرة واحدة وتخزين الملخص — الدورات التالية تستخدم النص المحفوظ
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
                    # استبدل المسمى القديم المدمج بالمسمى الفعلي ثم أضف السطر الديناميكي
                    co_str = f" في {company}" if company else ""
                    clean_body = _inject_job_title_into_body(saved_body, job_title)
                    job_intro = f"أتقدم بهذه الرسالة للتقديم على وظيفة {job_title}{co_str}.\n\n"
                    cover = _strip_emojis(job_intro + clean_body)
                    logger.info("   📄 cover letter من DB (محفوظ)")
                else:
                    # بناء قالب عام وحفظه في DB للمرات القادمة
                    generic_body = _build_smart_cover_body(name, field_names, cv_parsed_text, lang)
                    try:
                        async with httpx.AsyncClient(timeout=10) as _sc:
                            await _sc.patch(
                                f"{SUPABASE_URL}/rest/v1/user_settings?user_id=eq.{uid}",
                                json={"cover_letter_body": generic_body},
                                headers=_SB_HEADERS,
                            )
                        settings["cover_letter_body"] = generic_body
                        logger.info("   💾 تم حفظ cover letter في DB")
                    except Exception as _e:
                        logger.warning("   ⚠️ فشل حفظ cover letter: %s", _e)
                    # استخدام القالب مع حقن المسمى الوظيفي
                    co_str = f" في {company}" if company else ""
                    clean_body = _inject_job_title_into_body(generic_body, job_title)
                    job_intro = f"أتقدم بهذه الرسالة للتقديم على وظيفة {job_title}{co_str}.\n\n"
                    cover = _strip_emojis(job_intro + clean_body)
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

# ── إعدادات جدولة قناة Telegram ───────────────────────────────────────────
_TG_BOT_TOKEN  = os.getenv("TELEGRAM_BOT_TOKEN", "")
_TG_JOB_CH     = os.getenv("TELEGRAM_JOB_CHANNEL_ID", "")
JOB_PUBLISH_INTERVAL = int(os.getenv("JOB_PUBLISH_INTERVAL", "1800"))   # نشر وظيفة كل 30 دقيقة
PROMO_INTERVAL       = int(os.getenv("PROMO_INTERVAL", "3600"))          # رسالة دعائية كل 60 دقيقة
PROMO_JOB_GAP        = int(os.getenv("PROMO_JOB_GAP", "300"))            # 5 دقائق مسافة دنيا (قبل/بعد وظيفة)

_last_job_published_at: float = 0.0   # آخر مرة نُشرت فيها وظيفة
_promo_idx: int = 0                   # دوران الرسائل الدعائية

_PROMO_MESSAGES = [
    (
        "💡 <b>تعرف وش يسوي بوت Jobbots؟</b>\n\n"
        "يقدّم عنك على الوظائف كل نص ساعة تلقائي\n"
        "بدون ما تفتح أي موقع أو تكتب ولا إيميل واحد!\n\n"
        "🎯 ارفع سيرتك مرة وخلّ البوت يشتغل عنك\n\n"
        "👇 اشترك الحين\nhttps://www.jobbots.org/store"
    ),
    (
        "⏰ <b>وقتك غالي!</b>\n\n"
        "وانت تتصفح وظيفة وحدة، بوت Jobbots يرسل عشرات الطلبات عنك\n\n"
        "✅ ذكاء اصطناعي يكتب رسالة مخصصة لكل وظيفة\n"
        "✅ تقديم تلقائي طول اليوم\n"
        "✅ يراقب وظائف جديدة كل 30 دقيقة\n\n"
        "👇 ابدأ الحين\nhttps://www.jobbots.org/store"
    ),
    (
        "🏆 <b>ليش Jobbots؟</b>\n\n"
        "لأن التقديم اليدوي يأكل ساعات من يومك\n"
        "والبوت يسويها في دقائق — كل يوم، بدون ما توقفه\n\n"
        "📊 مشتركينا يحصلون على 10 تقديمات يومياً تلقائي\n\n"
        "👇 جرّبه الحين\nhttps://www.jobbots.org/store"
    ),
    (
        "📢 <b>قناة وظائف Jobbots</b>\n\n"
        "نجمع أحسن الوظائف من مئات المصادر لحظة بلحظة\n"
        "وبوتنا يقدّم عليها تلقائي باسمك\n\n"
        "🔔 فعّل الإشعارات وتوصلك الوظائف على طول ما تنزل\n\n"
        "👇 اشترك في الخدمة\nhttps://www.jobbots.org/store"
    ),
]


async def _publish_next_job_to_channel() -> bool:
    """ينشر وظيفة واحدة من قائمة الانتظار في قناة Telegram ويحدّث tg_message_id."""
    global _last_job_published_at
    if not _TG_BOT_TOKEN or not _TG_JOB_CH:
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/admin_jobs",
                headers=_SB_HEADERS,
                params={
                    "select": "id,title_ar,company,description_ar,application_email,link_url",
                    "is_active": "eq.true",
                    "tg_message_id": "is.null",
                    "application_email": "not.is.null",
                    "order": "created_at.asc",
                    "limit": "1",
                },
            )
            jobs = r.json() if r.is_success else []
            if not jobs:
                logger.info("[TG-Publish] لا توجد وظائف جديدة غير منشورة")
                return False

            job    = jobs[0]
            title  = (job.get("title_ar") or "وظيفة شاغرة").strip()
            company = (job.get("company") or "").strip()
            email  = (job.get("application_email") or "").strip()
            desc   = (job.get("description_ar") or "")[:300].strip()
            link   = (job.get("link_url") or "").strip()
            job_id = job["id"]

            lines = [f"🚀 <b>وظيفة جديدة — {title}</b>"]
            if company:
                lines.append(f"🏢 <b>الجهة:</b> {company}")
            lines.append("")
            if desc:
                lines.append(desc)
                lines.append("")
            if email:
                lines.append("📧 <b>البريد للتقديم:</b>")
                lines.append(email)
                lines.append("")
            if link:
                lines.append(f"🔗 <b>رابط التقديم:</b> {link}")
                lines.append("")
            lines.append("🤖 <b>قدّم تلقائياً على عشرات الوظائف يومياً بالذكاء الاصطناعي:</b>")
            lines.append("https://www.jobbots.org/store")

            tg_r = await client.post(
                f"https://api.telegram.org/bot{_TG_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": _TG_JOB_CH,
                    "text": "\n".join(lines),
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
                timeout=10,
            )
            tg_data = tg_r.json()
            msg_id = tg_data.get("result", {}).get("message_id")
            if not msg_id:
                logger.warning("[TG-Publish] فشل النشر: %s", tg_data)
                return False

            await client.patch(
                f"{SUPABASE_URL}/rest/v1/admin_jobs?id=eq.{job_id}",
                headers={**_SB_HEADERS, "Prefer": "return=minimal"},
                json={"tg_message_id": msg_id},
            )
            _last_job_published_at = time.monotonic()
            logger.info("[TG-Publish] ✅ نُشرت: %s (msg_id=%s)", title, msg_id)
            return True
    except Exception as e:
        logger.warning("[TG-Publish] خطأ: %s", e)
        return False


async def _post_promo_message() -> bool:
    """ينشر رسالة دعائية دورية — شرط ألا تكون قريبة من وظيفة (±5 دقائق)."""
    global _promo_idx
    if not _TG_BOT_TOKEN or not _TG_JOB_CH:
        return False

    now_mono = time.monotonic()
    time_since_job = now_mono - _last_job_published_at
    time_until_next = JOB_PUBLISH_INTERVAL - (time_since_job % JOB_PUBLISH_INTERVAL)

    if time_since_job < PROMO_JOB_GAP:
        logger.info("[TG-Promo] تأجيل — آخر وظيفة قبل %d ث فقط", int(time_since_job))
        return False
    if time_until_next < PROMO_JOB_GAP:
        logger.info("[TG-Promo] تأجيل — الوظيفة القادمة خلال %d ث", int(time_until_next))
        return False

    text = _PROMO_MESSAGES[_promo_idx % len(_PROMO_MESSAGES)]
    _promo_idx += 1
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"https://api.telegram.org/bot{_TG_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": _TG_JOB_CH,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
            ok = r.json().get("ok", False)
            if ok:
                logger.info("[TG-Promo] ✅ رسالة دعائية #%d نُشرت", _promo_idx)
            else:
                logger.warning("[TG-Promo] فشل: %s", r.text[:200])
            return ok
    except Exception as e:
        logger.warning("[TG-Promo] خطأ: %s", e)
        return False


async def _run_channel_scheduler() -> None:
    """
    جدولة مستقلة لنشر الوظائف والرسائل الدعائية في القناة.
      - وظيفة واحدة كل 30 دقيقة
      - رسالة دعائية كل 60 دقيقة (بشرط عدم القرب من وظيفة ±5 دق)
    """
    if not _TG_BOT_TOKEN or not _TG_JOB_CH:
        logger.info("[TG-Scheduler] TELEGRAM_BOT_TOKEN / TELEGRAM_JOB_CHANNEL_ID غير مضبوطان — الجدولة متوقفة")
        return

    logger.info("[TG-Scheduler] 🗓️ بدأ — نشر وظيفة كل %d دقيقة، دعاية كل %d دقيقة",
                JOB_PUBLISH_INTERVAL // 60, PROMO_INTERVAL // 60)

    _last_promo_at: float = time.monotonic() - PROMO_INTERVAL  # يبدأ بالنشر عند أول فرصة
    _last_publish_check: float = 0.0

    while True:
        await asyncio.sleep(60)  # فحص كل دقيقة
        now = time.monotonic()

        # ── نشر وظيفة ──────────────────────────────────────────────────
        if now - _last_publish_check >= JOB_PUBLISH_INTERVAL:
            _last_publish_check = now
            await _publish_next_job_to_channel()

        # ── رسالة دعائية ───────────────────────────────────────────────
        if now - _last_promo_at >= PROMO_INTERVAL:
            posted = await _post_promo_message()
            if posted:
                _last_promo_at = now


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

    # ابدأ جدولة نشر القناة في الخلفية
    asyncio.create_task(_run_channel_scheduler())

    if os.getenv("DISABLE_PYTHON_WORKER", "false").lower() in ("true", "1", "yes"):
        logger.info("⏸️  Python worker موقوف — الـ Edge Function في Supabase هي المسؤولة عن الإرسال")
        while True:
            await asyncio.sleep(3600)
        return

    logger.info("🚀 Auto-Apply Worker بدأ (كل %d ثانية) — إرسال SMTP مباشر", CYCLE_INTERVAL)
    await _run_job_fetcher()  # جلب أول عند البدء
    while True:
        start_ts = datetime.now(timezone.utc)
        try:
            await _run_cycle_smtp()
        except Exception as e:
            logger.exception("خطأ غير متوقع في الدورة: %s", e)

        await _run_job_fetcher()

        elapsed = (datetime.now(timezone.utc) - start_ts).total_seconds()
        sleep_for = max(0, CYCLE_INTERVAL - elapsed)
        logger.info("💤 انتظار %.0f ثانية حتى الدورة القادمة…", sleep_for)
        await asyncio.sleep(sleep_for)


if __name__ == "__main__":
    asyncio.run(main())
