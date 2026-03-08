# -*- coding: utf-8 -*-
import asyncio
import tempfile
import os
from datetime import datetime, timezone
from telegram import Update
from telegram.ext import ContextTypes

from database.db import (
    get_user_by_telegram,
    get_applications_count,
    get_applications_log,
    get_job_fields,
    get_user_job_preferences,
    set_user_job_preferences,
    is_subscription_active,
    get_admin_jobs,
    get_cv,
)
from keyboards import (
    applications_menu_keyboard,
    job_categories_keyboard,
    job_fields_keyboard,
)
from services.cover_letter import generate_cover_letter, extract_text_from_pdf
from templates.preview import send_email_smtp, build_application_html


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
    await query.edit_message_text(
        "الوظائف التي تريد:\nاختر نوع المجالات (عامة، خاصة، أو الاثنين):",
        reply_markup=job_categories_keyboard(),
    )


async def cb_job_cat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    data = query.data or ""
    if data == "job_cat_general":
        category = "general"
    elif data == "job_cat_specific":
        category = "specific"
    else:
        category = None
    user_id = context.user_data.get("job_prefs_user_id")
    if not user_id:
        await query.edit_message_text("انتهت الجلسة. ارجع للتقديمات.")
        return
    if category:
        fields = get_job_fields(category=category)
    else:
        fields = get_job_fields()
    selected = [str(x) for x in get_user_job_preferences(user_id)]
    context.user_data["job_prefs_category"] = category or "both"
    context.user_data["job_prefs_page"] = 0
    context.user_data["job_prefs_search"] = ""
    await query.edit_message_text(
        "اختر المجالات (اضغط على المجال لإضافته أو إزالته):",
        reply_markup=job_fields_keyboard(fields, selected, category or "both", 0, ""),
    )


async def cb_job_page(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not query.data:
        return
    await query.answer()
    parts = query.data.split("_")
    if len(parts) < 4:
        return
    category, page_str = parts[2], int(parts[3])
    search = context.user_data.get("job_prefs_search", "")
    user_id = context.user_data.get("job_prefs_user_id")
    if not user_id:
        return
    if category == "general":
        fields = get_job_fields(category="general")
    elif category == "specific":
        fields = get_job_fields(category="specific")
    else:
        fields = get_job_fields()
    if search:
        fields = [f for f in fields if search.lower() in (f.get("name_ar") or "").lower() or search.lower() in (f.get("name_en") or "").lower()]
    selected = [str(x) for x in get_user_job_preferences(user_id)]
    context.user_data["job_prefs_page"] = page_str
    context.user_data["job_prefs_search"] = search
    await query.edit_message_text(
        "اختر المجالات:",
        reply_markup=job_fields_keyboard(fields, selected, category, page_str, search),
    )


async def cb_job_toggle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not query.data:
        return
    await query.answer()
    fid = query.data.replace("job_toggle_", "")
    user_id = context.user_data.get("job_prefs_user_id")
    if not user_id:
        return
    selected = [str(x) for x in get_user_job_preferences(user_id)]
    if fid in selected:
        selected = [x for x in selected if x != fid]
    else:
        selected.append(fid)
    set_user_job_preferences(user_id, selected)
    category = context.user_data.get("job_prefs_category", "both")
    page = context.user_data.get("job_prefs_page", 0)
    if category == "general":
        fields = get_job_fields(category="general")
    elif category == "specific":
        fields = get_job_fields(category="specific")
    else:
        fields = get_job_fields()
    await query.edit_message_text(
        "اختر المجالات (تم تحديث التفضيلات):",
        reply_markup=job_fields_keyboard(fields, selected, category, page, ""),
    )


async def cb_job_search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    await query.edit_message_text(
        "أدخل كلمة البحث للمجالات (اسم بالعربي أو إنجليزي):"
    )
    context.user_data["awaiting_job_search"] = True


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
    await query.edit_message_text(
        "✅ تم حفظ تفضيلات الوظائف بنجاح.",
        reply_markup=applications_menu_keyboard(),
    )
    # رسالة مفاجأة: موعد التقديم التلقائي القادم
    try:
        msg = get_next_auto_apply_message(context)
        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text=msg,
        )
    except Exception:
        pass
    context.user_data.pop("job_prefs_user_id", None)
    context.user_data.pop("job_prefs_category", None)
    context.user_data.pop("job_prefs_page", None)
    context.user_data.pop("awaiting_job_search", None)


async def msg_job_search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.user_data.get("awaiting_job_search") or not update.message or not update.message.text:
        return
    search = update.message.text.strip()
    context.user_data["awaiting_job_search"] = False
    user_id = context.user_data.get("job_prefs_user_id")
    if not user_id:
        await update.message.reply_text("انتهت الجلسة.")
        return
    category = context.user_data.get("job_prefs_category", "both")
    if category == "general":
        fields = get_job_fields(category="general")
    elif category == "specific":
        fields = get_job_fields(category="specific")
    else:
        fields = get_job_fields()
    if search:
        search_lower = search.lower()
        fields = [f for f in fields if search_lower in (f.get("name_ar") or "").lower() or search_lower in (f.get("name_en") or "").lower()]
    selected = [str(x) for x in get_user_job_preferences(user_id)]
    from keyboards import job_fields_keyboard
    await update.message.reply_text(
        f"نتائج البحث عن «{search}»:",
        reply_markup=job_fields_keyboard(fields, selected, category, 0, search),
    )


def setup_applications_handlers(application):
    from telegram.ext import CallbackQueryHandler, MessageHandler, filters
    application.add_handler(CallbackQueryHandler(cb_app_sent, pattern="^app_sent$"))
    application.add_handler(CallbackQueryHandler(cb_app_log, pattern="^app_log$"))
    application.add_handler(CallbackQueryHandler(cb_app_admin_jobs, pattern="^app_admin_jobs$"))
    application.add_handler(CallbackQueryHandler(cb_app_job_prefs, pattern="^app_job_prefs$"))
    application.add_handler(CallbackQueryHandler(cb_job_cat, pattern="^job_cat_"))
    application.add_handler(CallbackQueryHandler(cb_job_page, pattern="^job_page_"))
    application.add_handler(CallbackQueryHandler(cb_job_toggle, pattern="^job_toggle_"))
    application.add_handler(CallbackQueryHandler(cb_job_search, pattern="^job_search$"))
    application.add_handler(CallbackQueryHandler(cb_job_save_prefs, pattern="^job_save_prefs$"))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, msg_job_search))
