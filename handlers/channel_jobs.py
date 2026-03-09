# -*- coding: utf-8 -*-
"""
استيراد الوظائف من قناة تليجرام: عند نشر منشور في القناة المحددة (JOBS_SOURCE_CHANNEL_ID)
يُضاف تلقائياً كوظيفة في admin_jobs. السطر الأول = العنوان، الباقي = الوصف.
"""
import re
import asyncio
import config
from telegram import Update
from telegram.ext import ContextTypes

from database.db import add_admin_job


def _extract_first_url(text: str) -> str:
    url = re.search(r"https?://[^\s]+", text or "")
    return (url.group(0).rstrip(".,)") if url else "")


async def handle_channel_post(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not config.JOBS_SOURCE_CHANNEL_ID or not update.channel_post:
        return
    if update.channel_post.chat_id != config.JOBS_SOURCE_CHANNEL_ID:
        return
    text = (update.channel_post.text or update.channel_post.caption or "").strip()
    if not text or len(text) < 5:
        return
    first_line, _, rest = (text + "\n").partition("\n")
    title_ar = (first_line or text)[:300].strip()
    description_ar = rest.strip()[:4000] if rest else ""
    link_url = _extract_first_url(text)
    try:
        await asyncio.to_thread(
            add_admin_job,
            title_ar=title_ar,
            title_en="",
            description_ar=description_ar,
            description_en="",
            company="",
            link_url=link_url,
            application_email="",
            specializations="",
        )
    except Exception:
        pass  # سجّل في السيرفر إذا أردت


def setup_channel_jobs_handlers(application):
    if not config.JOBS_SOURCE_CHANNEL_ID:
        return
    from telegram.ext import MessageHandler, filters
    application.add_handler(
        MessageHandler(filters.UpdateType.CHANNEL_POST, handle_channel_post),
    )
