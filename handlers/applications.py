# -*- coding: utf-8 -*-
import asyncio
import tempfile
import os
from datetime import datetime, timezone
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from database.db import (
    get_user_by_telegram,
    get_applications_count,
    get_applications_log,
    is_subscription_active,
    get_admin_jobs,
    get_cv,
)
from keyboards import (
    applications_menu_keyboard,
    job_prefs_ai_actions_keyboard,
)
from services.cover_letter import generate_cover_letter, extract_text_from_cv
from services.job_prefs_ai import apply_preferences_from_cv_text


async def download_cv_text_for_user(bot, user_id: str) -> tuple[str, str]:
    """تنزيل السيرة واستخراج النص. يعيد (نص، رسالة_خطأ) — النص فارغ عند الفشل."""
    cv = await asyncio.to_thread(get_cv, user_id)
    if not cv:
        return "", (
            "❌ لا توجد سيرة ذاتية مرفوعة.\n"
            "ارفع السيرة من: 👤 حسابي وإعدادات → 📎 السيرة الذاتية\n"
            "ثم اضغط 🎯 تفضيلات الوظائف."
        )
    file_id = (cv.get("file_id") or "").strip()
    file_name = (cv.get("file_name") or "cv.pdf").strip()
    if not file_id:
        return "", "تعذر قراءة ملف السيرة. ارفع السيرة من جديد."
    try:
        tg_file = await bot.get_file(file_id)
        suffix = os.path.splitext(file_name)[1] or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            await tg_file.download_to_drive(tmp.name)
            with open(tmp.name, "rb") as f:
                file_bytes = f.read()
        try:
            os.unlink(tmp.name)
        except Exception:
            pass
    except Exception as e:
        return "", f"تعذر تنزيل السيرة: {e}"
    try:
        cv_text = await asyncio.to_thread(extract_text_from_cv, file_bytes, file_name)
    except Exception:
        cv_text = ""
    if not cv_text or len(cv_text.strip()) < 80:
        return "", (
            "تعذر استخراج نص كافٍ من السيرة.\n"
            "جرّب PDF نصياً أو صورة أوضح، ثم أعد المحاولة."
        )
    return cv_text, ""


def format_job_prefs_sync_message(field_ids: list[str]) -> str:
    from database.db import get_job_fields

    fields = get_job_fields()
    by_id = {str(f["id"]): f for f in fields}
    names: list[str] = []
    for fid in field_ids[:40]:
        f = by_id.get(str(fid))
        if f:
            names.append(f"• {f.get('name_ar') or f.get('name_en') or fid}")
    if not field_ids:
        return (
            "⚠️ لم أستخرج مجالات واضحة من السيرة.\n\n"
            "أضف مهاراتاً وخبرات وتعليماً أوضح في السيرة، ثم اضغط «إعادة التحليل» أو ارفع سيرة جديدة."
        )
    listing = "\n".join(names) if names else "—"
    more = f"\n\n… وباقي المجالات ({len(field_ids) - 40})" if len(field_ids) > 40 else ""
    return (
        "✅ تم ضبط تفضيلاتك تلقائياً من تحليل السيرة بالذكاء الاصطناعي.\n\n"
        f"عدد المجالات: {len(field_ids)}\n\n{listing}{more}\n\n"
        "يُحدَّث ذلك تلقائياً عند رفع سيرة جديدة. يمكنك «إعادة التحليل» في أي وقت."
    )


async def run_job_prefs_ai_from_reply(
    update: Update, context: ContextTypes.DEFAULT_TYPE, user: dict,
) -> None:
    """من زر الرد 🎯 تفضيلات الوظائف."""
    user_id = str(user["id"])
    context.user_data["job_prefs_user_id"] = user["id"]
    wait = await update.message.reply_text(
        "⏳ جاري تحليل السيرة الذاتية واستخراج مجالاتك بالذكاء الاصطناعي…",
    )
    cv_text, err = await download_cv_text_for_user(context.bot, user_id)
    if err:
        await wait.edit_text(err)
        return
    ids = await asyncio.to_thread(apply_preferences_from_cv_text, user_id, cv_text)
    await wait.edit_text(
        format_job_prefs_sync_message(ids),
        reply_markup=job_prefs_ai_actions_keyboard(),
    )


async def cb_app_sent(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    count = await asyncio.to_thread(get_applications_count, user["id"])
    await query.edit_message_text(
        f"📌 التقديمات المرسلة\n\nعدد التقديمات: **{count}**",
        parse_mode="Markdown",
        reply_markup=applications_menu_keyboard(),
    )


async def cb_app_log(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    log = await asyncio.to_thread(get_applications_log, user["id"])
    if not log:
        msg = "📅 سجل التقديمات\n\nلا توجد تقديمات حتى الآن."
    else:
        lines = []
        for i, row in enumerate(log[:30], 1):
            job = (row.get("job_title") or "—")[:40]
            applied = row.get("applied_at", "")[:16] if row.get("applied_at") else "—"
            lines.append(f"{i}. #{row.get('id', '')[:8]} | {job} | {applied}")
        msg = "📅 سجل التقديمات\n\n" + "\n".join(lines)
    await query.edit_message_text(msg, reply_markup=applications_menu_keyboard())


async def cb_app_admin_jobs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.", reply_markup=applications_menu_keyboard())
        return
    jobs = await asyncio.to_thread(get_admin_jobs, True)
    if not jobs:
        await query.edit_message_text(
            "💼 وظائف من الإدارة\n\nلا توجد وظائف معروضة حالياً.",
            reply_markup=applications_menu_keyboard(),
        )
        return
    lines = []
    for j in jobs[:20]:
        title = (j.get("title_ar") or j.get("title_en") or "وظيفة")[:60]
        company = (j.get("company") or "")[:30]
        desc = (j.get("description_ar") or j.get("description_en") or "")[:150]
        line = f"• **{title}**\n  {company}\n  {desc}"
        lines.append(line)
    text = "💼 وظائف من الإدارة\n\n" + "\n\n".join(lines)
    if len(text) > 4000:
        text = text[:3980] + "\n\n..."
    await query.edit_message_text(
        text,
        parse_mode="Markdown",
        reply_markup=applications_menu_keyboard(),
    )


async def cb_app_job_prefs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    context.user_data["job_prefs_user_id"] = user["id"]
    await query.edit_message_text("⏳ جاري تحليل السيرة الذاتية واستخراج مجالاتك بالذكاء الاصطناعي…")
    user_id = str(user["id"])
    cv_text, err = await download_cv_text_for_user(context.bot, user_id)
    if err:
        await query.edit_message_text(
            err,
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("⬅️ الرجوع", callback_data="back_to_applications")]],
            ),
        )
        return
    ids = await asyncio.to_thread(apply_preferences_from_cv_text, user_id, cv_text)
    await query.edit_message_text(
        format_job_prefs_sync_message(ids),
        reply_markup=job_prefs_ai_actions_keyboard(),
    )


async def cb_job_ai_suggest(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer("جاري إعادة التحليل…")
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    context.user_data["job_prefs_user_id"] = user["id"]
    user_id = str(user["id"])
    await query.edit_message_text("⏳ جاري إعادة تحليل السيرة وتحديث المجالات…")
    cv_text, err = await download_cv_text_for_user(context.bot, user_id)
    if err:
        await query.edit_message_text(
            err,
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("⬅️ الرجوع", callback_data="back_to_applications")]],
            ),
        )
        return
    ids = await asyncio.to_thread(apply_preferences_from_cv_text, user_id, cv_text)
    await query.edit_message_text(
        format_job_prefs_sync_message(ids),
        reply_markup=job_prefs_ai_actions_keyboard(),
    )


def get_next_auto_apply_message(context: ContextTypes.DEFAULT_TYPE) -> str:
    """رسالة مفاجأة: متى ستكون دورة التقديم التلقائي القادمة."""
    next_at = context.application.bot_data.get("next_auto_apply_at")
    if not next_at:
        return "🕐 سيتم التقديم التلقائي على الوظائف المطابقة تلقائياً كل 30 دقيقة."
    now = datetime.now(timezone.utc)
    if getattr(next_at, "tzinfo", None) is None:
        next_at = next_at.replace(tzinfo=timezone.utc)
    secs = (next_at - now).total_seconds()
    mins = max(1, int(round(secs / 60)))
    if mins <= 2:
        return "🕐 سيتم التقديم التلقائي على الوظائف المطابقة خلال دقيقتين."
    return f"🕐 مفاجأة: سيتم التقديم التلقائي على الوظائف المطابقة خلال حوالي {mins} دقيقة."


async def cb_job_save_prefs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    from handlers.main_menu import cb_back_to_applications

    context.user_data.pop("job_prefs_user_id", None)
    await cb_back_to_applications(update, context)
    try:
        msg = get_next_auto_apply_message(context)
        await context.bot.send_message(chat_id=update.effective_chat.id, text=msg)
    except Exception:
        pass


async def route_text_after_settings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """مسار متروك للتوافق — لا يتدخل في أي نص."""
    return


def setup_applications_handlers(application):
    from telegram.ext import CallbackQueryHandler
    application.add_handler(CallbackQueryHandler(cb_app_sent, pattern="^app_sent$"))
    application.add_handler(CallbackQueryHandler(cb_app_log, pattern="^app_log$"))
    application.add_handler(CallbackQueryHandler(cb_app_admin_jobs, pattern="^app_admin_jobs$"))
    application.add_handler(CallbackQueryHandler(cb_app_job_prefs, pattern="^app_job_prefs$"))
    application.add_handler(CallbackQueryHandler(cb_job_ai_suggest, pattern="^job_ai_suggest$"))
    application.add_handler(CallbackQueryHandler(cb_job_save_prefs, pattern="^job_save_prefs$"))
