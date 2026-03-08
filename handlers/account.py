# -*- coding: utf-8 -*-
import asyncio
import logging
import tempfile
import os
from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ChatAction

from database.db import (
    get_user_by_telegram,
    get_cv,
    save_cv,
    is_subscription_active,
    get_subscription_ends_at,
)
from keyboards import account_menu_keyboard, cv_menu_keyboard

logger = logging.getLogger(__name__)


def _upload_and_save_cv(user_id, file_bytes: bytes, file_name: str, file_id: str) -> str | None:
    """رفع السيرة إلى التخزين السحابي وحفظ السجل (دالة مزامنة للاستدعاء من خلفية)."""
    from database.storage import upload_cv
    storage_path = None
    try:
        storage_path = upload_cv(str(user_id), file_bytes, file_name)
    except Exception as e:
        logger.warning("فشل رفع السيرة إلى Storage: %s", e)
    save_cv(user_id, file_id, file_name, storage_path=storage_path)
    return storage_path


async def cb_acc_my_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    name = user.get("full_name") or "—"
    phone = user.get("phone") or "—"
    await query.edit_message_text(
        f"📄 بياناتي\n\nالاسم: {name}\nرقم الجوال: {phone}",
        reply_markup=account_menu_keyboard(),
    )


async def cb_acc_cv(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    await query.edit_message_text(
        "📎 السيرة الذاتية\n\nاختر:",
        reply_markup=cv_menu_keyboard(),
    )


async def cb_cv_add(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    context.user_data["awaiting_cv"] = True
    await query.edit_message_text(
        "أرسل ملف السيرة الذاتية (PDF أو صورة).\nيُسمح بملف واحد فقط؛ إرسال ملف جديد سيستبدل السابق."
    )


async def receive_cv_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.user_data.get("awaiting_cv"):
        return
    if not update.message or not update.effective_user:
        return
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        context.user_data.pop("awaiting_cv", None)
        await update.message.reply_text("انتهى اشتراكك.")
        return
    doc = update.message.document
    if not doc:
        if update.message.photo:
            ph = update.message.photo[-1]
            file_id = ph.file_id
            file_name = "cv_photo.jpg"
        else:
            await update.message.reply_text("يرجى إرسال ملف (مستند أو صورة).")
            return
    else:
        file_id = doc.file_id
        file_name = doc.file_name or "cv.pdf"
    tg_file = await context.bot.get_file(file_id)
    suffix = os.path.splitext(file_name)[1] or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        await tg_file.download_to_drive(tmp.name)
        with open(tmp.name, "rb") as f:
            file_bytes = f.read()
        try:
            storage_path = await asyncio.to_thread(_upload_and_save_cv, user["id"], file_bytes, file_name, file_id)
        except Exception:
            storage_path = None
        finally:
            try:
                os.unlink(tmp.name)
            except Exception:
                pass
    context.user_data.pop("awaiting_cv", None)
    msg = "✅ تم رفع السيرة الذاتية بنجاح. سيتم إرسالها مع التقديمات."
    if storage_path:
        msg += "\n(تم حفظها أيضاً في التخزين السحابي)"
    else:
        msg += "\n(لم يتم الرفع إلى السحابة—تحقق من سياسات bucket «cvs» في Supabase)"
    from keyboards import cv_reply_keyboard
    await update.message.reply_text(msg, reply_markup=cv_reply_keyboard())


async def cb_cv_preview(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    cv = await asyncio.to_thread(get_cv, user["id"])
    if not cv:
        await query.edit_message_text(
            "لا توجد سيرة ذاتية مرفوعة. استخدم «اضافة سيرة ذاتية جديدة».",
            reply_markup=cv_menu_keyboard(),
        )
        return
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("استبدال بملف جديد", callback_data="cv_add")],
        [InlineKeyboardButton("⬅️ الرجوع", callback_data="acc_cv")],
    ])
    await query.edit_message_text(
        f"معاينة السيرة الذاتية:\nالملف: {cv.get('file_name') or 'ملف مرفوع'}",
        reply_markup=kb,
    )
    try:
        await context.bot.send_document(
            chat_id=update.effective_chat.id,
            document=cv["file_id"],
            caption="السيرة الذاتية الحالية",
        )
    except Exception:
        await query.edit_message_text(
            "تم حفظ السيرة الذاتية. (لم نتمكن من إعادة إرسال المعاينة.)",
            reply_markup=kb,
        )


async def cb_acc_subscription(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    ends = get_subscription_ends_at(user)
    from datetime import datetime, timezone
    from handlers.applications import get_next_auto_apply_message
    try:
        if not ends:
            days = 0
        else:
            end_dt = datetime.fromisoformat(ends.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
            days = max(0, (end_dt - now).days)
    except Exception:
        days = 0
    next_apply = get_next_auto_apply_message(context)
    await query.edit_message_text(
        f"📊 حالة الاشتراك\n\nنوع الاشتراك: اشتراك شهري\nينتهي بعد: {days} يوم\nتاريخ الانتهاء: {ends[:10] if ends else '—'}\n\n{next_apply}",
        reply_markup=account_menu_keyboard(),
    )


def setup_account_handlers(application):
    from telegram.ext import CallbackQueryHandler, MessageHandler, filters
    application.add_handler(CallbackQueryHandler(cb_acc_my_data, pattern="^acc_my_data$"))
    application.add_handler(CallbackQueryHandler(cb_acc_cv, pattern="^acc_cv$"))
    application.add_handler(CallbackQueryHandler(cb_cv_add, pattern="^cv_add$"))
    application.add_handler(CallbackQueryHandler(cb_cv_preview, pattern="^cv_preview$"))
    application.add_handler(CallbackQueryHandler(cb_acc_subscription, pattern="^acc_subscription$"))
    application.add_handler(MessageHandler(
        (filters.Document.ALL | filters.PHOTO) & ~filters.COMMAND,
        receive_cv_document,
    ))
