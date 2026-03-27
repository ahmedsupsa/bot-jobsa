# -*- coding: utf-8 -*-
"""
استيراد الوظائف من قناة تليجرام: عند نشر منشور في القناة (JOBS_SOURCE_CHANNEL_ID)
يُحلّل النص (أو تعليق الصورة / OCR للصورة بدون نص) ويُضاف كصف في admin_jobs.
مع GEMINI_API_KEY: استخراج المسمى، الشركة، البريد، الرابط، التخصصات، وملخص منظم.
"""
import io
import logging
import re
import asyncio

import config
from telegram import Update
from telegram.ext import ContextTypes

from database.db import add_admin_job
from services.channel_job_parser import parse_job_posts_text
from services.cover_letter import extract_text_from_image

logger = logging.getLogger(__name__)
_FMT_MARK = "#jb_fmt_v1"
_BOT_PROMO = "🤖 اشترك في بوت التقديم الذكي: https://ahmedsup.com/VDPvOWx"


def _extract_first_url(text: str) -> str:
    url = re.search(r"https?://[^\s]+", text or "")
    return (url.group(0).rstrip(".,)") if url else "")


def _clean_text_block(text: str) -> str:
    t = (text or "").strip()
    t = re.sub(r"\[[^\]]+\]\([^)]+\)", "", t)  # remove markdown links
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _pick_requirement_points(req: str) -> list[str]:
    raw = (req or "").strip()
    if not raw:
        return ["مذكورة في الإعلان."]
    lines = [x.strip(" -*•\t") for x in re.split(r"[\r\n]+", raw) if x.strip()]
    points = []
    for ln in lines:
        if len(ln) < 6:
            continue
        # تجاهل عناوين عامة
        if re.search(r"^(الوصف|الشروط|المتطلبات|طريقة التقديم)\b", ln, re.I):
            continue
        points.append(_clean_text_block(ln))
        if len(points) >= 4:
            break
    if points:
        return points
    return [_clean_text_block(raw)[:220]]


def _build_custom_post(fields: dict, email: str) -> str:
    title = (fields.get("title_ar") or fields.get("title_en") or "وظيفة").strip()
    company = (fields.get("company") or "").strip()
    city = (fields.get("city") or "").strip()
    emp = (fields.get("employment_type") or "").strip()
    salary = (fields.get("salary") or "").strip()
    req = (fields.get("requirements") or fields.get("description_ar") or "").strip()

    lines = [
        "✨ فرصة وظيفية جديدة",
        "",
        f"المسمى: {title}",
    ]
    if company:
        lines.append(f"🏢 الشركة: {company}")
    if city:
        lines.append(f"📍 المدينة: {city}")
    if emp:
        lines.append(f"🕒 نوع الدوام: {emp}")
    if salary:
        lines.append(f"💰 الراتب: {salary}")

    lines.append("✅ المتطلبات:")
    for p in _pick_requirement_points(req):
        lines.append(f"• {p[:220]}")

    if email:
        lines.append(f"📩 التقديم: {email}")
    lines.extend(["", _BOT_PROMO, _FMT_MARK])
    return "\n".join(lines).strip()


async def _raw_text_from_channel_post(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> str:
    post = update.channel_post
    if not post:
        return ""
    parts: list[str] = []
    t = (post.text or post.caption or "").strip()
    if t:
        parts.append(t)
    if not parts and post.photo:
        try:
            photo = post.photo[-1]
            tg_file = await context.bot.get_file(photo.file_id)
            buf = io.BytesIO()
            await tg_file.download_to_memory(buf)
            mime = "image/jpeg"
            ocr = extract_text_from_image(buf.getvalue(), mime)
            if ocr and ocr.strip():
                parts.append(ocr.strip())
        except Exception as e:
            logger.warning("تعذر قراءة صورة منشور القناة: %s", e)
    return "\n\n".join(parts).strip()


async def handle_channel_post(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not config.JOBS_SOURCE_CHANNEL_ID or not update.channel_post:
        return
    if update.channel_post.chat_id != config.JOBS_SOURCE_CHANNEL_ID:
        return

    raw = await _raw_text_from_channel_post(update, context)
    if not raw or len(raw) < 5:
        return
    if _FMT_MARK in raw:
        # منشور منسق سابقاً بواسطة الخدمة — نتجنب حلقة إعادة المعالجة.
        return

    progress_msg = None
    try:
        # لا يوجد "typing" واضح في القنوات؛ نرسل رسالة مؤقتة للحالة.
        progress_msg = await context.bot.send_message(
            chat_id=update.channel_post.chat_id,
            text="⏳ جاري تحليل الرسالة وتجهيز الوظائف...",
        )
    except Exception:
        progress_msg = None

    common_email_match = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", raw or "", re.I)
    common_email = (common_email_match.group(0).strip() if common_email_match else "")

    try:
        jobs = await asyncio.to_thread(parse_job_posts_text, raw)
    except Exception as e:
        logger.exception("فشل تحليل منشور الوظيفة: %s", e)
        return

    if not jobs:
        return

    for fields in jobs[:20]:
        email = (fields.get("application_email") or "").strip()
        if not email and common_email:
            email = common_email
        # نحفظ/نعرض إيميل التقديم فقط.
        if email and not re.search(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$", email):
            email = ""
        link = fields.get("link_url") or _extract_first_url(raw)

        company = (fields.get("company") or "").strip()
        formatted = _build_custom_post(fields, email)

        # انشر النسخة المنسقة كرسالة مستقلة في نفس القناة.
        try:
            await context.bot.send_message(
                chat_id=update.channel_post.chat_id,
                text=formatted,
            )
        except Exception:
            logger.exception("فشل نشر الوظيفة المنسقة في القناة")

        # احفظ النسخة المنسقة في admin_jobs لاستخدامها بالتقديم التلقائي.
        try:
            await asyncio.to_thread(
                add_admin_job,
                title_ar=fields.get("title_ar") or "وظيفة",
                title_en=fields.get("title_en") or "",
                description_ar=formatted[:4000],
                description_en=fields.get("description_en") or "",
                company=company,
                link_url=link,
                application_email=email,
                specializations=fields.get("specializations") or "",
            )
        except Exception:
            logger.exception("فشل إدراج وظيفة من القناة في قاعدة البيانات")

    # حذف الرسالة المؤقتة
    if progress_msg:
        try:
            await context.bot.delete_message(
                chat_id=update.channel_post.chat_id,
                message_id=progress_msg.message_id,
            )
        except Exception:
            pass

    # حذف رسالة الإدخال الأصلية بعد نجاح النشر (يتطلب صلاحية delete messages للبوت)
    try:
        await context.bot.delete_message(
            chat_id=update.channel_post.chat_id,
            message_id=update.channel_post.message_id,
        )
    except Exception as e:
        logger.warning("تعذر حذف رسالة الإدخال الأصلية من القناة: %s", e)


def setup_channel_jobs_handlers(application):
    if not config.JOBS_SOURCE_CHANNEL_ID:
        return
    from telegram.ext import MessageHandler, filters

    application.add_handler(
        MessageHandler(filters.UpdateType.CHANNEL_POST, handle_channel_post),
    )
