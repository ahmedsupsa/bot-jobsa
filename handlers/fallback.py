# -*- coding: utf-8 -*-
"""
نصوص غير معروفة بعد استنفاد معالجات المجموعة -1 وربط الإيميل:
إعادة إظهار لوحة المفاتيح المناسبة (رئيسية أو أدمن).
"""
import asyncio

from telegram import Update
from telegram.ext import ContextTypes

from database.db import get_user_by_telegram, is_admin, is_subscription_active
from handlers.admin import admin_reply_keyboard
from keyboards import main_reply_keyboard


async def handle_unknown_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """رسالة توجيهية + إعادة لوحة المفاتيح عند إرسال نص لا يطابق أي أمر/قائمة."""
    if not update.message or not update.effective_user:
        return
    text = (update.message.text or "").strip()
    if not text:
        return

    uid = update.effective_user.id

    if is_admin(uid):
        await update.message.reply_text(
            "لم أفهم الرسالة. إليك لوحة الأدمن 👇",
            reply_markup=admin_reply_keyboard(),
        )
        return

    user = await asyncio.to_thread(get_user_by_telegram, uid)
    if not user or not user.get("full_name"):
        await update.message.reply_text("اضغط /start للبدء أولاً.")
        return

    if not is_subscription_active(user):
        await update.message.reply_text(
            "انتهى اشتراكك. يرجى تجديد الاشتراك.",
            reply_markup=main_reply_keyboard(),
        )
        return

    await update.message.reply_text(
        "لم أفهم الرسالة. إليك القائمة الرئيسية 👇",
        reply_markup=main_reply_keyboard(),
    )
