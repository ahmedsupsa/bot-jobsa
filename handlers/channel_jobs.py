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
_BOT_PROMO = "🤖 للتقديم التلقائي الذكي: راسل البوت وفعّل حسابك."


def _extract_first_url(text: str) -> str:
    url = re.search(r"https?://[^\s]+", text or "")
    return (url.group(0).rstrip(".,)") if url else "")


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

    try:
        jobs = await asyncio.to_thread(parse_job_posts_text, raw)
    except Exception as e:
        logger.exception("فشل تحليل منشور الوظيفة: %s", e)
        return

    if not jobs:
        return

    for fields in jobs[:20]:
        email = (fields.get("application_email") or "").strip()
        # نحفظ/نعرض إيميل التقديم فقط.
        if email and not re.search(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$", email):
            email = ""
        link = fields.get("link_url") or _extract_first_url(raw)

        req = (fields.get("requirements") or fields.get("description_ar") or "").strip()
        if not req:
            req = "غير مذكورة بوضوح في الإعلان."
        lines = [
            f"المسمى: {(fields.get('title_ar') or fields.get('title_en') or 'وظيفة').strip()}",
        ]
        company = (fields.get("company") or "").strip()
        if company:
            lines.append(f"🏢 الشركة: {company}")
        city = (fields.get("city") or "").strip()
        if city:
            lines.append(f"📍 المدينة: {city}")
        emp = (fields.get("employment_type") or "").strip()
        if emp:
            lines.append(f"🕒 نوع الدوام: {emp}")
        salary = (fields.get("salary") or "").strip()
        if salary:
            lines.append(f"💰 الراتب: {salary}")
        lines.append(f"✅ المتطلبات: {req[:1600]}")
        if email:
            lines.append(f"📩 التقديم: {email}")
        lines.append("")
        lines.append(_BOT_PROMO)
        lines.append(_FMT_MARK)
        formatted = "\n".join(lines).strip()

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


def setup_channel_jobs_handlers(application):
    if not config.JOBS_SOURCE_CHANNEL_ID:
        return
    from telegram.ext import MessageHandler, filters

    application.add_handler(
        MessageHandler(filters.UpdateType.CHANNEL_POST, handle_channel_post),
    )
