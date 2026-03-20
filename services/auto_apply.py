# -*- coding: utf-8 -*-
"""
محرك التقديم التلقائي الكامل.
- يعمل دورياً في الخلفية بدون تدخل المستخدم
- يمنع التقديم المكرر على نفس الوظيفة
- فاصل زمني 45 ثانية بين كل تقديم لكل مستخدم
- يستخدم قالب المستخدم المختار
- يحلل السيرة الذاتية بالذكاء الاصطناعي
"""
import asyncio
import logging
import tempfile
import os
import time
from config import RESEND_API_KEY, RESEND_FROM_EMAIL

logger = logging.getLogger(__name__)

# فاصل 45 ثانية بين كل تقديم لكل مستخدم (لتسريع الدورة وتجنب التأخير الطويل)
_SEND_INTERVAL_SECONDS = 45

# آخر وقت تقديم لكل مستخدم: {user_id: timestamp}
_last_send_time: dict[str, float] = {}

# آخر وقت إرسال رسالة فشل التقديم لكل مستخدم (لتجنب التكرار كل 30 دقيقة)
_FAILURE_NOTIFICATION_COOLDOWN_SECONDS = 86400  # 24 ساعة
_last_failure_notification: dict[str, float] = {}  # user_id -> time.time()


def _job_matches_user(job: dict, user_field_names: list[str]) -> bool:
    """تحقق إذا كانت الوظيفة تطابق تفضيلات المستخدم."""
    if not user_field_names:
        return True
    job_specs = (job.get("specializations") or "").lower()
    if not job_specs:
        return True
    return any(name.lower() in job_specs for name in user_field_names if name)


def _can_send_now(user_id: str) -> bool:
    """تحقق إذا مرّ الفاصل الزمني من آخر تقديم لهذا المستخدم."""
    last = _last_send_time.get(user_id, 0)
    return (time.monotonic() - last) >= _SEND_INTERVAL_SECONDS


def _mark_sent(user_id: str) -> None:
    _last_send_time[user_id] = time.monotonic()


async def run_auto_apply_cycle(bot) -> None:
    """
    دورة تقديم واحدة: تمر على كل المستخدمين النشطين
    وترسل تقديمات على الوظائف الجديدة المطابقة لتفضيلاتهم.
    """
    from database.db import (
        get_admin_jobs,
        get_or_create_user_settings,
        get_cv,
        get_user_job_preferences,
        get_job_fields,
        get_applications_count_today,
        has_applied_to_job,
        add_application,
        is_subscription_active,
    )
    from services.cover_letter import generate_cover_letter, extract_text_from_cv
    from templates.preview import build_application_html, get_preview_html
    from templates.preview import send_email, get_smtp_error_user_message, SMTP_NETWORK_ERROR_HINT

    # جلب كل الوظائف النشطة التي لها إيميل
    try:
        all_jobs = await asyncio.to_thread(get_admin_jobs, True)
    except Exception as e:
        logger.error("فشل جلب الوظائف: %s", e)
        return

    jobs_with_email = [j for j in all_jobs if (j.get("application_email") or "").strip()]
    if not jobs_with_email:
        return

    # جلب كل مستخدمي البوت من قاعدة البيانات
    try:
        users = await asyncio.to_thread(_get_all_active_users)
    except Exception as e:
        logger.error("فشل جلب المستخدمين: %s", e)
        return

    all_fields = await asyncio.to_thread(get_job_fields)

    for user in users:
        user_id = str(user["id"])  # توحيد النوع لاستخدامه كـ key في الكاش ودوال DB
        telegram_id = user.get("telegram_id")

        if not is_subscription_active(user):
            continue

        # تحقق من حد 10 تقديمات يومياً
        count_today = await asyncio.to_thread(get_applications_count_today, user_id)
        if count_today >= 10:
            continue

        # جلب إعدادات المستخدم
        try:
            settings = await asyncio.to_thread(get_or_create_user_settings, user_id)
        except Exception:
            continue

        resend_enabled = bool((RESEND_API_KEY or "").strip() and (RESEND_FROM_EMAIL or "").strip())
        if not settings.get("email") or (not settings.get("app_password_encrypted") and not resend_enabled):
            continue

        cv = await asyncio.to_thread(get_cv, user_id)
        if not cv:
            continue

        # جلب تفضيلات الوظائف
        pref_ids = await asyncio.to_thread(get_user_job_preferences, user_id)
        user_field_names = [
            f.get("name_ar") or f.get("name_en") or ""
            for f in all_fields if str(f["id"]) in [str(x) for x in pref_ids]
        ]

        # الوظائف المطابقة التي لم يتقدم عليها بعد
        jobs_to_apply = []
        for job in jobs_with_email:
            job_id = job.get("id")
            if not job_id:
                continue
            job_id = str(job_id)
            already = await asyncio.to_thread(has_applied_to_job, user_id, job_id)
            if already:
                continue
            if not _job_matches_user(job, user_field_names):
                continue
            jobs_to_apply.append(job)

        if not jobs_to_apply:
            continue

        # تحميل السيرة الذاتية مرة واحدة لهذا المستخدم
        try:
            tg_file = await bot.get_file(cv["file_id"])
            cv_suffix = os.path.splitext(cv.get("file_name") or "cv.pdf")[1] or ".pdf"
            with tempfile.NamedTemporaryFile(delete=False, suffix=cv_suffix) as tmp:
                await tg_file.download_to_drive(tmp.name)
                with open(tmp.name, "rb") as f:
                    cv_bytes = f.read()
                try:
                    os.unlink(tmp.name)
                except Exception:
                    pass
        except Exception as e:
            logger.warning("فشل تحميل السيرة للمستخدم %s: %s", telegram_id, e)
            continue

        # استخراج نص السيرة الذاتية (PDF، DOCX، أو صورة عبر جيميني)
        cv_filename = cv.get("file_name") or "cv.pdf"
        try:
            cv_text = await asyncio.to_thread(extract_text_from_cv, cv_bytes, cv_filename)
        except Exception:
            cv_text = ""

        name = user.get("full_name") or "المتقدم"
        phone = user.get("phone") or ""
        lang = user.get("application_language") or "ar"
        # قالب تقديم واحد لجميع المستخدمين
        template_type = "normal"
        sender_email = settings["email"]
        app_password = settings.get("app_password_encrypted")
        remaining = 10 - count_today

        sent_this_cycle = 0
        failed_titles: list[str] = []
        had_network_error = False  # لإضافة توجيه عند منع SMTP من الاستضافة
        for job in jobs_to_apply[:remaining]:
            # تحقق من الفاصل الزمني بين التقديمات
            if not _can_send_now(user_id):
                wait = _SEND_INTERVAL_SECONDS - (time.monotonic() - _last_send_time.get(user_id, 0))
                logger.info("انتظار %.0f ثانية قبل التقديم التالي للمستخدم %s", wait, telegram_id)
                await asyncio.sleep(max(0, wait))

            to_email = (job.get("application_email") or "").strip()
            job_title = job.get("title_ar") or job.get("title_en") or "وظيفة"
            company = job.get("company") or ""
            desc = (job.get("description_ar") or job.get("description_en") or "")[:1200]
            job_id = str(job["id"])

            # توليد رسالة التغطية بالذكاء الاصطناعي
            try:
                cover = await asyncio.to_thread(
                    generate_cover_letter,
                    job_title, name, company, desc, lang, cv_text,
                )
            except Exception:
                cover = ""

            # بناء HTML بالقالب المختار + إظهار أن الرسالة نُشئت من السيرة إن وُجد نصها
            html_body = build_application_html(
                name=name,
                phone=phone,
                job_title=job_title,
                company=company,
                cover_letter=cover,
                lang=lang,
                template_type=template_type,
                cv_used_for_letter=len((cv_text or "").strip()) > 80,
            )

            subject = (
                f"التقديم على وظيفة: {job_title}" if lang == "ar"
                else f"Application for: {job_title}"
            )

            try:
                await send_email(
                    sender_email, app_password, to_email,
                    subject, html_body, cv_bytes, cv_filename,
                )
                await asyncio.to_thread(add_application, user_id, job_title, None, job_id)
                _mark_sent(user_id)
                sent_this_cycle += 1
                logger.info("✅ تقديم ناجح: %s → %s (%s)", name, job_title, to_email)

                # إشعار المستخدم على تيليجرام
                if telegram_id:
                    try:
                        msg = (
                            f"✅ تم التقديم على وظيفة: **{job_title}**"
                            f"{' | ' + company if company else ''}"
                        )
                        await bot.send_message(
                            chat_id=telegram_id,
                            text=msg,
                            parse_mode="Markdown",
                        )
                    except Exception:
                        pass

            except Exception as e:
                logger.warning("❌ فشل التقديم: %s → %s: %s", name, job_title, e)
                failed_titles.append(job_title)
                if get_smtp_error_user_message(e):
                    had_network_error = True

        # رسالة فشل مرة واحدة فقط كل 24 ساعة لكل مستخدم (لا تُرسل كل دورة كتذكير)
        if failed_titles and telegram_id:
            now = time.time()
            last = _last_failure_notification.get(user_id, 0)
            if (now - last) >= _FAILURE_NOTIFICATION_COOLDOWN_SECONDS:
                try:
                    n = len(failed_titles)
                    jobs_preview = "، ".join(failed_titles[:3])
                    if n > 3:
                        jobs_preview += f" و{n - 3} أخرى"
                    text = f"⚠️ تعذّر التقديم على {n} وظيفة ({jobs_preview}). تأكد من صحة إيميلك وكلمة مرور التطبيق."
                    if had_network_error:
                        text += "\n\n" + SMTP_NETWORK_ERROR_HINT
                    await bot.send_message(chat_id=telegram_id, text=text)
                    _last_failure_notification[user_id] = now
                except Exception:
                    pass

        if sent_this_cycle > 0 and telegram_id:
            new_count = count_today + sent_this_cycle
            try:
                await bot.send_message(
                    chat_id=telegram_id,
                    text=(
                        f"📊 ملخص التقديمات:\n"
                        f"تم إرسال **{sent_this_cycle}** تقديم جديد\n"
                        f"إجمالي اليوم: {new_count}/10"
                    ),
                    parse_mode="Markdown",
                )
            except Exception:
                pass


def _get_all_active_users() -> list:
    """جلب كل المستخدمين المسجلين من قاعدة البيانات."""
    from database.db import _use_rest
    if _use_rest:
        from database.supabase_rest import select_all
        return select_all("users") or []
    from database.db import get_supabase
    sb = get_supabase()
    r = sb.table("users").select("*").execute()
    return r.data or []
