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

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
SMTP_ENCRYPTION_KEY = os.getenv("SMTP_ENCRYPTION_KEY", "")
CYCLE_INTERVAL = int(os.getenv("AUTO_APPLY_INTERVAL", "1800"))

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


def _job_matches_user(job: dict, field_names: list[str]) -> bool:
    if not field_names:
        return False
    blob = " ".join([
        str(job.get("specializations") or ""),
        str(job.get("title_ar") or ""),
        str(job.get("title_en") or ""),
        str(job.get("description_ar") or ""),
        str(job.get("description_en") or ""),
    ]).lower()
    if not blob.strip():
        return False
    for name in field_names:
        n = (name or "").strip().lower()
        if n and n in blob:
            return True
    words: set[str] = set()
    for name in field_names:
        for w in re.split(r"[\s\-/_,()]+", (name or "").lower()):
            if len(w.strip()) >= 4:
                words.add(w.strip())
    hits = sum(1 for w in words if w in blob)
    return hits >= 2


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

    if template == "brief":
        if is_ar:
            return (
                f"اقرأ السيرة الذاتية واكتب رسالة تقديم موجزة جداً بالعربية (نقاط 2-3 فقط) "
                f"للوظيفة: {job_title}{co_str}{desc_str}. اسم المتقدم: {name}. "
                f"الأسلوب: مباشر، اذكر أبرز مهارة أو خبرة واحدة من السيرة الذاتية، ثم أبدِ اهتمامك. "
                f"بدون تحية، بدون إيموجي، النص فقط في 2-3 جمل قصيرة."
            )
        else:
            return (
                f"Read the CV and write a very brief cover note in English (2-3 sentences) "
                f"for the position: {job_title}{co_str}{desc_str}. Applicant: {name}. "
                f"Style: direct and punchy — highlight one key skill from the CV and express interest. "
                f"No greeting, no emoji, plain text only."
            )
    elif template == "modern":
        if is_ar:
            return (
                f"اقرأ السيرة الذاتية واكتب رسالة تقديم عصرية وودّية بالعربية (3-4 جمل) "
                f"للوظيفة: {job_title}{co_str}{desc_str}. اسم المتقدم: {name}. "
                f"الأسلوب: متحمّس، شخصي، اذكر سبباً محدداً من السيرة الذاتية لماذا هذه الفرصة مثيرة. "
                f"بدون تحية رسمية، بدون إيموجي، النص فقط."
            )
        else:
            return (
                f"Read the CV and write a modern, friendly cover note in English (3-4 sentences) "
                f"for the role: {job_title}{co_str}{desc_str}. Applicant: {name}. "
                f"Style: enthusiastic, personal — mention a specific reason from the CV why this opportunity excites you. "
                f"No formal salutation, no emoji, plain text only."
            )
    else:  # classic
        if is_ar:
            return (
                f"اقرأ السيرة الذاتية المرفقة ثم اكتب رسالة تغطية رسمية ومنظّمة بالعربية (3-4 جمل) "
                f"للتقديم على وظيفة: {job_title}{co_str}{desc_str}. اسم المتقدم: {name}. "
                f"الأسلوب: رسمي، ابدأ بالتعريف بالنفس ثم اذكر خبرات من السيرة الذاتية تتناسب مع الوظيفة. "
                f"بدون إيموجي، النص فقط بدون عنوان أو تحية."
            )
        else:
            return (
                f"Read the attached CV and write a formal, structured cover letter in English (3-4 sentences) "
                f"for the position: {job_title}{co_str}{desc_str}. Applicant: {name}. "
                f"Style: professional — introduce yourself, cite relevant experience from the CV. "
                f"No emoji, plain text only, no heading or salutation."
            )


async def _generate_cover_letter(
    job_title: str, name: str, company: str, desc: str, lang: str,
    cv_bytes: bytes | None = None, cv_mime: str = "application/pdf",
    template: str = "classic",
) -> str:
    fallback_ar = f"أتقدم بكل اهتمام لشغل وظيفة {job_title}{' في ' + company if company else ''}. أنا مهتم بهذه الفرصة وأثق في قدرتي على إضافة قيمة حقيقية لفريقكم."
    fallback_en = f"I am writing to express my interest in the {job_title} position{' at ' + company if company else ''}. I am confident in my ability to contribute effectively to your team."
    if not GEMINI_API_KEY:
        return fallback_ar if lang == "ar" else fallback_en

    prompt = _build_prompt(job_title, name, company, desc, lang, template)
    parts: list[dict] = [{"text": prompt}]
    if cv_bytes:
        parts.append({
            "inline_data": {
                "mime_type": cv_mime,
                "data": base64.b64encode(cv_bytes).decode("ascii"),
            }
        })

    try:
        async with httpx.AsyncClient(timeout=40) as client:
            r = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key={GEMINI_API_KEY}",
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

    if template == "modern":
        return f"""<!DOCTYPE html><html dir="{dir_}" lang="{'ar' if is_ar else 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#0d0d0d;border-radius:16px 16px 0 0;padding:28px 32px;direction:{dir_};text-align:{align};">
    <p style="margin:0 0 4px;color:#a78bfa;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">{subj_lbl}</p>
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">{job_title}</h1>
    {f'<p style="margin:6px 0 0;color:#888;font-size:13px;">{company}</p>' if company else ""}
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


# ─── الدورة الرئيسية ───

async def run_cycle() -> None:
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

            # التحقق من ربط الإيميل
            email_connected = settings.get("email_connected") or False
            if not email_connected:
                logger.info("⏭️  %s — لم يربط إيميله بعد", name_log)
                continue

            smtp_email = (settings.get("smtp_email") or "").strip()
            smtp_host = settings.get("smtp_host") or "smtp.gmail.com"
            smtp_port = int(settings.get("smtp_port") or 465)
            smtp_secure = settings.get("smtp_secure") if settings.get("smtp_secure") is not None else True
            encrypted_pw = (settings.get("smtp_app_password_encrypted") or "").strip()

            if not smtp_email or not encrypted_pw:
                logger.info("⏭️  %s — إعدادات SMTP ناقصة", name_log)
                continue

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

            storage_path = (cv.get("storage_path") or "").strip()
            cv_bytes = None
            if storage_path:
                cv_bytes = await _download_cv(client, storage_path)
            cv_name = cv.get("file_name") or "cv.pdf"

            prefs_rows = await sb_get(client, "user_job_preferences", {"user_id": f"eq.{uid}"})
            pref_ids = {str(p["job_field_id"]) for p in prefs_rows if p.get("job_field_id")}
            field_names = [
                f.get("name_ar") or f.get("name_en") or ""
                for f in fields_raw if str(f["id"]) in pref_ids
            ]

            name = user.get("full_name") or "المتقدم"
            phone = user.get("phone") or ""
            lang = settings.get("application_language") or "ar"
            template = settings.get("template_type") or "classic"
            remaining = 10 - count_today
            sent = 0

            logger.info("👤 %s | تفضيلات: %s | متبقي: %d", name, field_names or "لا يوجد", remaining)

            for job in jobs:
                if sent >= remaining:
                    break

                job_id = str(job["id"])
                already_rows = await sb_get(client, "applications", {"user_id": f"eq.{uid}", "job_id": f"eq.{job_id}"})
                if already_rows:
                    continue

                matched = _job_matches_user(job, field_names)
                logger.info("   🔎 وظيفة [%s] → %s", job.get("title_ar") or job.get("title_en"), "✓ تطابق" if matched else "✗ لا تطابق")
                if not matched:
                    continue

                # الانتظار بين الإرسالات
                now_m = time.monotonic()
                last_m = _last_send.get(uid, 0)
                wait = _SEND_INTERVAL - (now_m - last_m)
                if wait > 0:
                    await asyncio.sleep(wait)

                to_email = (job.get("application_email") or "").strip()
                job_title = job.get("title_ar") or job.get("title_en") or "وظيفة"
                company = job.get("company") or ""
                desc = (job.get("description_ar") or job.get("description_en") or "")[:1200]

                # التحقق من صحة إيميل الوظيفة
                if not _is_valid_email(to_email):
                    logger.warning("   ⚠️  إيميل الوظيفة غير صالح: [%s] — تخطي", to_email)
                    continue

                cv_mime = "application/pdf"
                if cv_name and cv_name.lower().endswith(".docx"):
                    cv_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

                cover = await _generate_cover_letter(job_title, name, company, desc, lang, cv_bytes, cv_mime, template)
                cover = _strip_emojis(cover)
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
                    logger.info("✅ تقديم: %s → %s (%s)", name, job_title, to_email)
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
                            "user_id": uid,
                            "job_title": job_title,
                            "job_id": job_id,
                            "applied_at": sent_at,
                            "status": status,
                            "provider_used": "smtp",
                            "error_reason": error_reason,
                            "sent_at": sent_at if status == "sent" else None,
                        },
                    )
                except Exception as e:
                    logger.warning("تعذّر حفظ سجل التقديم: %s", e)

            if sent > 0:
                logger.info("📊 %s: %d تقديم جديد", name, sent)


async def _record_run(client: httpx.AsyncClient) -> None:
    """يسجّل وقت آخر تشغيل في جدول worker_status."""
    now_iso = datetime.now(timezone.utc).isoformat()
    next_iso = (datetime.now(timezone.utc) + timedelta(seconds=CYCLE_INTERVAL)).isoformat()
    try:
        await client.post(
            f"{SUPABASE_URL}/rest/v1/worker_status",
            headers={**_SB_HEADERS, "Prefer": "resolution=merge-duplicates"},
            json={"id": "main", "last_ran_at": now_iso, "next_run_at": next_iso},
        )
    except Exception as e:
        logger.warning("تعذّر تسجيل وقت التشغيل: %s", e)


async def main() -> None:
    logger.info("🚀 Auto-Apply Worker بدأ (كل %d ثانية) — الإرسال عبر SMTP", CYCLE_INTERVAL)
    while True:
        start_ts = datetime.now(timezone.utc)
        try:
            await run_cycle()
        except Exception as e:
            logger.exception("خطأ غير متوقع في الدورة: %s", e)

        async with httpx.AsyncClient(timeout=10) as c:
            await _record_run(c)

        elapsed = (datetime.now(timezone.utc) - start_ts).total_seconds()
        sleep_for = max(0, CYCLE_INTERVAL - elapsed)
        logger.info("💤 انتظار %.0f ثانية حتى الدورة القادمة…", sleep_for)
        await asyncio.sleep(sleep_for)


if __name__ == "__main__":
    asyncio.run(main())
