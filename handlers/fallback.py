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

_KNOWN_BUTTONS = {
    # main/user menus
    "📄 التقديمات", "👤 حسابي وإعدادات", "👤 حسابي", "⚙️ الإعدادات", "📢 الإعلانات",
    "📌 التقديمات المرسلة", "📅 سجل التقديمات", "🎯 تفضيلات الوظائف",
    "مجالات عامة", "مجالات خاصة", "الاثنين",
    "📄 بياناتي", "📎 السيرة الذاتية", "📊 حالة الاشتراك",
    "➕ رفع سيرة ذاتية", "👁️ معاينة السيرة",
    "📧 ربط الإيميل", "🖼️ قوالب التقديم", "📞 تواصل معنا",
    "⬅️ الرئيسية", "⬅️ حسابي", "⬅️ رجوع",
    # admin
    "🔑 توليد أكواد", "➕ كود يدوي", "💼 إضافة وظيفة", "📢 إضافة إعلان",
    "📊 إحصائيات", "👥 المشتركين", "📊 احصائيات التقديمات", "🔑 الأكواد",
    "📋 احصائيات الوظائف", "🗑 حذف مستخدم",
}


async def handle_unknown_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """رسالة توجيهية + إعادة لوحة المفاتيح عند إرسال نص لا يطابق أي أمر/قائمة."""
    if not update.message or not update.effective_user:
        return
    text = (update.message.text or "").strip()
    if not text:
        return
    if text.startswith("/"):
        return
    if text in _KNOWN_BUTTONS:
        return
    # لا نتدخل أثناء خطوات الإدخال المتوقعة
    if context.user_data.get("awaiting") in {
        "email", "app_password", "activation_code", "register_name", "register_phone", "register_age", "register_city"
    }:
        return
    if context.user_data.get("awaiting_job_search"):
        return
    if context.user_data.get("awaiting_cv"):
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


def setup_fallback_handlers(application) -> None:
    """آخر معالج نصي: يعيد لوحة المفاتيح عند النصوص غير المفهومة."""
    from telegram.ext import MessageHandler, filters
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND & filters.ChatType.PRIVATE, handle_unknown_text),
        group=2,
    )
