# -*- coding: utf-8 -*-
"""
Auto-Apply Worker — يعمل دورياً كل 30 دقيقة
يقدّم على الوظائف تلقائياً لكل مستخدم نشط
"""
import asyncio
import base64
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta

import httpx
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "")
RESEND_FROM_NAME = os.getenv("RESEND_FROM_NAME", "Jobsa")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
CYCLE_INTERVAL = int(os.getenv("AUTO_APPLY_INTERVAL", "1800"))

_SEND_INTERVAL = 45
_last_send: dict[str, float] = {}
_FAILURE_COOLDOWN = 86400
_last_failure: dict[str, float] = {}

_SB_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


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


async def _generate_cover_letter(job_title: str, name: str, company: str, desc: str, lang: str) -> str:
    if not GEMINI_API_KEY:
        if lang == "ar":
            return f"أتقدم بكل اهتمام لشغل وظيفة {job_title}{' في ' + company if company else ''}. أنا مهتم بهذه الفرصة وأثق في قدرتي على إضافة قيمة حقيقية لفريقكم."
        return f"I am writing to express my interest in the {job_title} position{' at ' + company if company else ''}. I am confident in my ability to contribute effectively to your team."

    prompt = (
        f"اكتب رسالة تغطية مختصرة (3-4 جمل) باللغة {'العربية' if lang == 'ar' else 'الإنجليزية'} "
        f"للتقديم على وظيفة: {job_title}"
        + (f" في شركة {company}" if company else "")
        + (f". تفاصيل الوظيفة: {desc[:300]}" if desc else "")
        + f". الاسم: {name}. لا تضف إيموجي."
    )
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key={GEMINI_API_KEY}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            data = r.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return ""


def _build_email_html(name: str, phone: str, job_title: str, company: str, cover: str, lang: str) -> str:
    is_ar = lang == "ar"
    dir_ = "rtl" if is_ar else "ltr"
    cover_html = cover.replace("\n", "<br>")
    company_html = f"<p><strong>{'الشركة' if is_ar else 'Company'}:</strong> {company}</p>" if company else ""
    return f"""<!DOCTYPE html><html dir="{dir_}" lang="{'ar' if is_ar else 'en'}">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9f9f9;direction:{dir_};text-align:{'right' if is_ar else 'left'};">
<div style="background:#fff;padding:24px;border-radius:8px;">
<h2 style="color:#333;margin:0 0 12px;">{'طلب توظيف' if is_ar else 'Job Application'} — {job_title}</h2>
<p style="line-height:1.9;color:#2c2c2c;">{cover_html}</p>
<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
{company_html}
<p><strong>{'الاسم' if is_ar else 'Name'}:</strong> {name}</p>
<p><strong>{'الجوال' if is_ar else 'Phone'}:</strong> {phone}</p>
</div></body></html>"""


async def _send_resend(
    to_email: str,
    subject: str,
    html: str,
    reply_to: str,
    cc: str | None,
    cv_bytes: bytes | None,
    cv_name: str | None,
    from_name: str,
) -> None:
    payload: dict = {
        "from": f"{from_name} <{RESEND_FROM_EMAIL}>",
        "to": [to_email],
        "subject": subject,
        "html": html,
        "reply_to": reply_to,
    }
    if cc and cc.lower() != to_email.lower():
        payload["cc"] = [cc]
    if cv_bytes and cv_name:
        payload["attachments"] = [{
            "filename": cv_name,
            "content": base64.b64encode(cv_bytes).decode("ascii"),
        }]
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json=payload,
        )
    if r.status_code not in (200, 201, 202):
        raise RuntimeError(f"Resend error {r.status_code}: {r.text}")


async def _download_cv(client: httpx.AsyncClient, storage_path: str) -> bytes | None:
    url = f"{SUPABASE_URL}/storage/v1/object/cvs/{storage_path}"
    r = await client.get(url, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"})
    if r.is_success:
        return r.content
    return None


async def run_cycle() -> None:
    if not RESEND_API_KEY or not RESEND_FROM_EMAIL:
        logger.error("RESEND_API_KEY / RESEND_FROM_EMAIL غير معرّف — دورة متوقفة")
        return

    async with httpx.AsyncClient(timeout=30, base_url=SUPABASE_URL) as client:
        jobs_raw = await sb_get(client, "admin_jobs", {"is_active": "eq.true"})
        jobs = [j for j in jobs_raw if (j.get("application_email") or "").strip()]
        if not jobs:
            logger.info("لا توجد وظائف نشطة — تخطي")
            return

        users = await sb_get(client, "users")
        fields_raw = await sb_get(client, "job_fields", {})

        for user in users:
            if not _is_subscription_active(user):
                continue

            uid = str(user["id"])
            count_today = await sb_get_count(
                client, "applications",
                {"user_id": f"eq.{uid}", "applied_at": f"gte.{datetime.now(timezone.utc).date().isoformat()}"},
            )
            if count_today >= 10:
                continue

            settings_rows = await sb_get(client, "user_settings", {"user_id": f"eq.{uid}"})
            settings = settings_rows[0] if settings_rows else {}
            email = (settings.get("email") or "").strip()
            if not email:
                continue

            cv_rows = await sb_get(client, "user_cvs", {"user_id": f"eq.{uid}"})
            cv = cv_rows[0] if cv_rows else None
            if not cv:
                continue

            storage_path = (cv.get("storage_path") or "").strip()
            cv_bytes = None
            if storage_path:
                cv_bytes = await _download_cv(client, storage_path)
            cv_name = cv.get("file_name") or "cv.pdf"

            prefs_rows = await sb_get(client, "user_job_preferences", {"user_id": f"eq.{uid}"})
            pref_ids = {str(p["field_id"]) for p in prefs_rows if p.get("field_id")}
            field_names = [
                f.get("name_ar") or f.get("name_en") or ""
                for f in fields_raw if str(f["id"]) in pref_ids
            ]

            name = user.get("full_name") or "المتقدم"
            phone = user.get("phone") or ""
            lang = settings.get("application_language") or "ar"
            remaining = 10 - count_today
            sent = 0

            for job in jobs[:remaining]:
                job_id = str(job["id"])
                already_rows = await sb_get(client, "applications", {"user_id": f"eq.{uid}", "job_id": f"eq.{job_id}"})
                if already_rows:
                    continue
                if not _job_matches_user(job, field_names):
                    continue

                now_m = time.monotonic()
                last_m = _last_send.get(uid, 0)
                wait = _SEND_INTERVAL - (now_m - last_m)
                if wait > 0:
                    await asyncio.sleep(wait)

                to_email = (job.get("application_email") or "").strip()
                job_title = job.get("title_ar") or job.get("title_en") or "وظيفة"
                company = job.get("company") or ""
                desc = (job.get("description_ar") or job.get("description_en") or "")[:1200]

                cover = await _generate_cover_letter(job_title, name, company, desc, lang)
                cover = _strip_emojis(cover)
                html = _build_email_html(name, phone, job_title, company, cover, lang)
                subject = f"التقديم على وظيفة: {_strip_emojis(job_title)}" if lang == "ar" else f"Application for: {_strip_emojis(job_title)}"

                try:
                    await _send_resend(
                        to_email=to_email,
                        subject=subject,
                        html=html,
                        reply_to=email,
                        cc=email,
                        cv_bytes=cv_bytes,
                        cv_name=cv_name,
                        from_name=name,
                    )
                    await client.post(
                        f"{SUPABASE_URL}/rest/v1/applications",
                        headers={**_SB_HEADERS},
                        json={
                            "user_id": uid,
                            "job_title": job_title,
                            "job_id": job_id,
                            "applied_at": datetime.now(timezone.utc).isoformat(),
                        },
                    )
                    _last_send[uid] = time.monotonic()
                    sent += 1
                    logger.info("✅ تقديم: %s → %s (%s)", name, job_title, to_email)
                except Exception as e:
                    logger.warning("❌ فشل: %s → %s: %s", name, job_title, e)

            if sent > 0:
                logger.info("📊 %s: %d تقديم جديد", name, sent)


async def main() -> None:
    logger.info("🚀 Auto-Apply Worker بدأ (كل %d ثانية)", CYCLE_INTERVAL)
    while True:
        try:
            await run_cycle()
        except Exception as e:
            logger.error("خطأ في الدورة: %s", e)
        logger.info("⏰ انتهت الدورة — انتظار %d ثانية", CYCLE_INTERVAL)
        await asyncio.sleep(CYCLE_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
