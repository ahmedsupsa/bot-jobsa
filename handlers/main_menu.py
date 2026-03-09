# -*- coding: utf-8 -*-
import asyncio
from telegram import Update
from telegram.ext import ContextTypes
from telegram.error import BadRequest

from database.db import get_user_by_telegram, is_subscription_active, get_admin_announcements, is_admin
from handlers.settings import clear_email_flow_state
from keyboards import (
    main_reply_keyboard,
    applications_reply_keyboard,
    account_reply_keyboard,
    settings_reply_keyboard,
    cv_reply_keyboard,
)

# نص الأزرار لكل القوائم - يُستخدم في الـ Regex
_ALL_BUTTONS = (
    # رئيسية
    "📄 التقديمات", "👤 حسابي", "📢 الإعلانات", "⚙️ الإعدادات",
    # تقديمات
    "📌 التقديمات المرسلة", "📅 سجل التقديمات",
    "💼 وظائف من الإدارة", "🎯 تفضيلات الوظائف",
    # حسابي
    "📄 بياناتي", "📎 السيرة الذاتية", "📊 حالة الاشتراك",
    # سيرة ذاتية
    "➕ رفع سيرة ذاتية", "👁️ معاينة السيرة",
    # إعدادات
    "📧 ربط الإيميل", "🖼️ قوالب التقديم", "🌐 لغة التقديم", "📞 تواصل معنا",
    # رجوع
    "⬅️ الرئيسية", "⬅️ حسابي",
)


async def _check_user(update: Update) -> dict | None:
    """تحقق من وجود المستخدم وصلاحية اشتراكه."""
    # حسابات الأدمن لا تُعامل كحسابات مستخدمين عاديين
    if update.effective_user and is_admin(update.effective_user.id):
        await update.message.reply_text("أنت أدمن في هذا البوت. استخدم الأمر /admin لإدارة النظام.")
        return None
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not user.get("full_name"):
        await update.message.reply_text("اضغط /start للبدء أولاً.")
        return None
    if not is_subscription_active(user):
        await update.message.reply_text(
            "انتهى اشتراكك. يرجى تجديد الاشتراك.",
            reply_markup=main_reply_keyboard(),
        )
        return None
    return user


async def handle_reply_keyboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """يستقبل جميع ضغطات أزرار Reply Keyboard."""
    if not update.message or not update.message.text or not update.effective_user:
        return
    text = update.message.text.strip()

    # ──── رجوع ──── (وإلغاء أي تدفق مثل ربط الإيميل)
    if text == "⬅️ الرئيسية":
        if update.effective_user and update.effective_chat:
            clear_email_flow_state(update.effective_user.id, update.effective_chat.id)
        context.user_data.pop("awaiting", None)
        context.user_data.pop("temp_email", None)
        await update.message.reply_text("القائمة الرئيسية:", reply_markup=main_reply_keyboard())
        return
    if text == "⬅️ حسابي":
        if update.effective_user and update.effective_chat:
            clear_email_flow_state(update.effective_user.id, update.effective_chat.id)
        context.user_data.pop("awaiting", None)
        context.user_data.pop("temp_email", None)
        await update.message.reply_text("👤 حسابي:", reply_markup=account_reply_keyboard())
        return

    user = await _check_user(update)
    if not user:
        return

    # ──── القائمة الرئيسية ────
    if text == "📄 التقديمات":
        await update.message.reply_text("📄 التقديمات:\n\nاختر:", reply_markup=applications_reply_keyboard())

    elif text == "👤 حسابي":
        await update.message.reply_text("👤 حسابي:\n\nاختر:", reply_markup=account_reply_keyboard())

    elif text == "📢 الإعلانات":
        anns = await asyncio.to_thread(get_admin_announcements, True, True)
        if not anns:
            await update.message.reply_text("📢 لا توجد إعلانات حالياً.", reply_markup=main_reply_keyboard())
            return
        await update.message.reply_text("📢 الإعلانات:", reply_markup=main_reply_keyboard())
        for a in anns[:10]:
            title = (a.get("title") or "إعلان")[:100]
            body = (a.get("body_text") or "")[:900]
            caption = f"**{title}**\n\n{body}" if title else body
            if len(caption) > 1024:
                caption = caption[:1020] + "..."
            image_id = a.get("image_file_id")
            if image_id:
                try:
                    await context.bot.send_photo(
                        chat_id=update.effective_chat.id,
                        photo=image_id, caption=caption, parse_mode="Markdown",
                    )
                except Exception:
                    await context.bot.send_message(
                        chat_id=update.effective_chat.id, text=caption, parse_mode="Markdown",
                    )
            else:
                await context.bot.send_message(
                    chat_id=update.effective_chat.id, text=caption, parse_mode="Markdown",
                )

    elif text == "⚙️ الإعدادات":
        await update.message.reply_text("⚙️ الإعدادات:\n\nاختر:", reply_markup=settings_reply_keyboard())

    # ──── التقديمات ────
    elif text == "📌 التقديمات المرسلة":
        from database.db import get_applications_count
        count = await asyncio.to_thread(get_applications_count, user["id"])
        await update.message.reply_text(
            f"📌 التقديمات المرسلة\n\nعدد التقديمات: **{count}**",
            parse_mode="Markdown",
            reply_markup=applications_reply_keyboard(),
        )

    elif text == "📅 سجل التقديمات":
        from database.db import get_applications_log
        log = await asyncio.to_thread(get_applications_log, user["id"])
        if not log:
            msg = "📅 سجل التقديمات\n\nلا توجد تقديمات حتى الآن."
        else:
            lines = []
            for i, row in enumerate(log[:30], 1):
                job = (row.get("job_title") or "—")[:40]
                applied = row.get("applied_at", "")[:16] if row.get("applied_at") else "—"
                lines.append(f"{i}. {job} | {applied}")
            msg = "📅 سجل التقديمات\n\n" + "\n".join(lines)
        await update.message.reply_text(msg, reply_markup=applications_reply_keyboard())

    elif text == "💼 وظائف من الإدارة":
        from database.db import get_admin_jobs
        jobs = await asyncio.to_thread(get_admin_jobs, True)
        if not jobs:
            await update.message.reply_text(
                "💼 لا توجد وظائف معروضة حالياً.",
                reply_markup=applications_reply_keyboard(),
            )
            return
        lines = []
        for j in jobs[:20]:
            title = (j.get("title_ar") or j.get("title_en") or "وظيفة")[:60]
            company = (j.get("company") or "")
            desc = (j.get("description_ar") or "")[:120]
            spec = (j.get("specializations") or "")[:60]
            line = f"• **{title}**"
            if company:
                line += f"\n  🏢 {company}"
            if desc:
                line += f"\n  {desc}"
            if spec:
                line += f"\n  🎯 {spec}"
            lines.append(line)
        text_msg = "💼 وظائف من الإدارة\n\n" + "\n\n".join(lines)
        if len(text_msg) > 4000:
            text_msg = text_msg[:3980] + "\n\n..."
        await update.message.reply_text(
            text_msg, parse_mode="Markdown", reply_markup=applications_reply_keyboard(),
        )

    elif text == "🎯 تفضيلات الوظائف":
        from keyboards import job_categories_keyboard
        context.user_data["job_prefs_user_id"] = user["id"]
        await update.message.reply_text(
            "🎯 اختر نوع المجالات:",
            reply_markup=job_categories_keyboard(),
        )

    # ──── حسابي ────
    elif text == "📄 بياناتي":
        name = user.get("full_name") or "—"
        phone = user.get("phone") or "—"
        city = user.get("city") or "—"
        age = user.get("age") or "—"
        await update.message.reply_text(
            f"📄 **بياناتي**\n\n"
            f"الاسم: {name}\n"
            f"الجوال: {phone}\n"
            f"العمر: {age}\n"
            f"المدينة: {city}",
            parse_mode="Markdown",
            reply_markup=account_reply_keyboard(),
        )

    elif text == "📎 السيرة الذاتية":
        await update.message.reply_text(
            "📎 السيرة الذاتية:\n\nاختر:", reply_markup=cv_reply_keyboard(),
        )

    elif text == "📊 حالة الاشتراك":
        from database.db import get_subscription_ends_at
        from datetime import datetime, timezone
        from handlers.applications import get_next_auto_apply_message
        ends = get_subscription_ends_at(user)
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
        await update.message.reply_text(
            f"📊 **حالة الاشتراك**\n\n"
            f"نوع الاشتراك: اشتراك نشط\n"
            f"ينتهي بعد: {days} يوم\n"
            f"تاريخ الانتهاء: {ends[:10] if ends else '—'}\n\n"
            f"{next_apply}",
            parse_mode="Markdown",
            reply_markup=account_reply_keyboard(),
        )

    elif text == "➕ رفع سيرة ذاتية":
        context.user_data["awaiting_cv"] = True
        await update.message.reply_text(
            "أرسل ملف السيرة الذاتية (PDF أو صورة).\n"
            "يُسمح بملف واحد فقط؛ إرسال ملف جديد سيستبدل السابق.",
            reply_markup=cv_reply_keyboard(),
        )

    elif text == "👁️ معاينة السيرة":
        from database.db import get_cv
        cv = await asyncio.to_thread(get_cv, user["id"])
        if not cv:
            await update.message.reply_text(
                "لا توجد سيرة ذاتية مرفوعة. اضغط «➕ رفع سيرة ذاتية».",
                reply_markup=cv_reply_keyboard(),
            )
            return
        await update.message.reply_text(
            f"السيرة الحالية: {cv.get('file_name') or 'ملف مرفوع'}",
            reply_markup=cv_reply_keyboard(),
        )
        try:
            await context.bot.send_document(
                chat_id=update.effective_chat.id,
                document=cv["file_id"],
                caption="السيرة الذاتية الحالية",
            )
        except Exception:
            pass

    # ──── إعدادات ────
    elif text == "📧 ربط الإيميل":
        context.user_data["awaiting"] = "email"
        await update.message.reply_text(
            "📧 أرسل عنوان Gmail الخاص بك:",
            reply_markup=settings_reply_keyboard(),
        )

    elif text == "🖼️ قوالب التقديم":
        from keyboards import templates_menu_keyboard
        await update.message.reply_text(
            "اختر قالب التقديم:", reply_markup=templates_menu_keyboard(),
        )

    elif text == "🌐 لغة التقديم":
        from keyboards import lang_menu_keyboard
        await update.message.reply_text(
            "اختر لغة التقديم:", reply_markup=lang_menu_keyboard(),
        )

    elif text == "📞 تواصل معنا":
        await update.message.reply_text(
            "📞 للتواصل مع الدعم الفني:\n\n@support",
            reply_markup=settings_reply_keyboard(),
        )


async def cb_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    # في حال كان الحساب أدمن، لا نعرض قائمة المستخدمين بل نذكّره بلوحة الأدمن
    if is_admin(update.effective_user.id):
        await query.edit_message_text("أنت أدمن في هذا البوت.\nاستخدم الأمر /admin لفتح لوحة تحكم الأدمن.")
        return
    await query.edit_message_text("القائمة الرئيسية 👇")
    await context.bot.send_message(
        chat_id=update.effective_chat.id,
        text="اختر من القائمة:",
        reply_markup=main_reply_keyboard(),
    )


async def cb_back_to_applications(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    await query.edit_message_text("📄 التقديمات:")
    await context.bot.send_message(
        chat_id=update.effective_chat.id,
        text="اختر:",
        reply_markup=applications_reply_keyboard(),
    )


async def cb_back_to_settings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    await query.edit_message_text("⚙️ الإعدادات:")
    await context.bot.send_message(
        chat_id=update.effective_chat.id,
        text="اختر:",
        reply_markup=settings_reply_keyboard(),
    )


async def cb_menu_applications(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    await query.edit_message_text("📄 التقديمات:")
    await context.bot.send_message(
        chat_id=update.effective_chat.id,
        text="اختر:",
        reply_markup=applications_reply_keyboard(),
    )


async def cb_menu_account(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    await query.edit_message_text("👤 حسابي:")
    await context.bot.send_message(
        chat_id=update.effective_chat.id,
        text="اختر:",
        reply_markup=account_reply_keyboard(),
    )


async def cb_menu_settings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user or not update.effective_chat:
        return
    await query.answer()
    from handlers.settings import clear_email_flow_state
    clear_email_flow_state(update.effective_user.id, update.effective_chat.id)
    context.user_data.pop("awaiting", None)
    context.user_data.pop("temp_email", None)
    await query.edit_message_text("⚙️ الإعدادات:")
    await context.bot.send_message(
        chat_id=update.effective_chat.id,
        text="اختر:",
        reply_markup=settings_reply_keyboard(),
    )


async def cb_menu_announcements(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id) if update.effective_user else None
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    anns = await asyncio.to_thread(get_admin_announcements, True, True)
    if not anns:
        await query.edit_message_text("📢 لا توجد إعلانات حالياً.")
        return
    await query.edit_message_text("📢 الإعلانات:")
    for a in anns[:10]:
        title = (a.get("title") or "إعلان")[:100]
        body = (a.get("body_text") or "")[:900]
        caption = f"**{title}**\n\n{body}" if title else body
        if len(caption) > 1024:
            caption = caption[:1020] + "..."
        image_id = a.get("image_file_id")
        if image_id:
            try:
                await context.bot.send_photo(
                    chat_id=update.effective_chat.id,
                    photo=image_id, caption=caption, parse_mode="Markdown",
                )
            except Exception:
                await context.bot.send_message(
                    chat_id=update.effective_chat.id, text=caption, parse_mode="Markdown",
                )
        else:
            await context.bot.send_message(
                chat_id=update.effective_chat.id, text=caption, parse_mode="Markdown",
            )


def setup_main_menu_handlers(application):
    from telegram.ext import CallbackQueryHandler, MessageHandler, filters
    import re

    # Callback handlers
    application.add_handler(CallbackQueryHandler(cb_main_menu, pattern="^main_menu$"))
    application.add_handler(CallbackQueryHandler(cb_menu_applications, pattern="^menu_applications$"))
    application.add_handler(CallbackQueryHandler(cb_menu_account, pattern="^menu_account$"))
    application.add_handler(CallbackQueryHandler(cb_menu_settings, pattern="^menu_settings$"))
    application.add_handler(CallbackQueryHandler(cb_menu_announcements, pattern="^menu_announcements$"))
    application.add_handler(CallbackQueryHandler(cb_back_to_applications, pattern="^back_to_applications$"))
    application.add_handler(CallbackQueryHandler(cb_back_to_settings, pattern="^back_to_settings$"))

    # Reply Keyboard بأولوية عالية
    pattern = "|".join(re.escape(b) for b in _ALL_BUTTONS)
    application.add_handler(MessageHandler(
        filters.TEXT & filters.Regex(f"^({pattern})$"),
        handle_reply_keyboard,
    ), group=-1)
