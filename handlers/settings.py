# -*- coding: utf-8 -*-
import asyncio
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler, filters
from telegram.error import BadRequest

from database.db import (
    get_user_by_telegram,
    get_or_create_user_settings,
    save_user_email,
    set_application_language,
    is_subscription_active,
)
from keyboards import (
    settings_menu_keyboard,
    back_to_settings_keyboard,
    templates_menu_keyboard,
    lang_menu_keyboard,
    main_reply_keyboard,
    account_reply_keyboard,
)
from states import States

_awaiting_by_key: dict[tuple[int, int], str] = {}


def _email_flow_key(update: Update) -> tuple[int, int] | None:
    u = update.effective_user
    c = update.effective_chat
    if u and c:
        return (u.id, c.id)
    return None


def clear_email_flow_state(user_id: int, chat_id: int) -> None:
    _awaiting_by_key.pop((user_id, chat_id), None)


def _in_email_flow(context: ContextTypes.DEFAULT_TYPE) -> bool:
    ud = context.user_data
    if not ud:
        return False
    return ud.get("awaiting") == "email"


class _FilterAwaitingEmailFlow(filters.BaseFilter):
    def filter(self, update: Update) -> bool:
        key = _email_flow_key(update)
        return key is not None and _awaiting_by_key.get(key) == "email"


async def cb_set_email(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user or not update.effective_chat:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    current_email = ""
    sender_alias = ""
    if user:
        settings = await asyncio.to_thread(get_or_create_user_settings, user["id"])
        current_email = (settings.get("email") or "").strip()
        sender_alias = (settings.get("sender_email_alias") or "").strip()
    current_email_line = f"الإيميل الشخصي: {current_email}\n" if current_email else "الإيميل الشخصي: لا يوجد\n"
    alias_line = f"إيميل التقديم الخاص بك: {sender_alias}\n\n" if sender_alias else "\n"
    try:
        msg = (
            f"📧 ربط الإيميل\n\n{current_email_line}{alias_line}"
            "أدخل إيميلك (Gmail فقط حالياً).\n"
            "سيتم إرسال التقديمات عبر Resend — لا تحتاج كلمة مرور التطبيق.\n\n"
            "أو اضغط «رجوع» للإلغاء."
        )
        await query.edit_message_text(msg, reply_markup=back_to_settings_keyboard())
    except BadRequest as e:
        if "message is not modified" not in str(e).lower():
            raise
    ud = context.user_data
    if not ud:
        await query.answer("أعد المحاولة من الإعدادات.", show_alert=True)
        return
    ud["awaiting"] = "email"
    _awaiting_by_key[(update.effective_user.id, update.effective_chat.id)] = "email"


async def cancel_email_flow(update: Update, context: ContextTypes.DEFAULT_TYPE, reply_text: str = "تم الإلغاء.", reply_markup=None):
    if not update.message:
        return
    ud = context.user_data
    if ud:
        ud.pop("awaiting", None)
    key = _email_flow_key(update)
    if key:
        _awaiting_by_key.pop(key, None)
    await update.message.reply_text(reply_text, reply_markup=reply_markup or settings_menu_keyboard())


_EMAIL_CANCEL_MAIN = "⬅️ الرئيسية"
_EMAIL_CANCEL_ACCOUNT = "⬅️ حسابي"
_EMAIL_CANCEL_WORDS = ("الغاء", "رجوع", "إلغاء")

_EMAIL_IGNORE_BUTTONS = (
    "📧 ربط الإيميل",
    "🖼️ قوالب التقديم",
    "📞 تواصل معنا",
    "⚙️ الإعدادات",
    "👤 حسابي وإعدادات",
    "👤 حسابي",
)


def _is_valid_gmail(s: str) -> bool:
    s = (s or "").strip().lower()
    if "@" not in s or "." not in s:
        return False
    return "gmail" in s or "googlemail" in s


async def receive_email(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return
    email = update.message.text.strip()
    if email in _EMAIL_CANCEL_WORDS:
        await cancel_email_flow(update, context)
        return
    if email == _EMAIL_CANCEL_MAIN:
        await cancel_email_flow(update, context, "القائمة الرئيسية:", main_reply_keyboard())
        return
    if email == _EMAIL_CANCEL_ACCOUNT:
        from handlers.main_menu import _account_settings_header_text
        header = await _account_settings_header_text(update.effective_user.id if update.effective_user else None)
        await cancel_email_flow(update, context, header, account_reply_keyboard())
        return
    if email in _EMAIL_IGNORE_BUTTONS:
        await update.message.reply_text(
            "يرجى **كتابة** عنوان الإيميل في رسالة جديدة (مثال: yourname@gmail.com)\nولا تضغط على أزرار القائمة.",
            parse_mode="Markdown",
        )
        return
    if not _is_valid_gmail(email):
        await update.message.reply_text(
            "يرجى إدخال إيميل Gmail صحيح (مثال: yourname@gmail.com).\nتأكد من وجود @ و gmail في العنوان.",
        )
        return

    if not update.effective_user:
        return
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await update.message.reply_text("انتهى اشتراكك.")
        context.user_data.pop("awaiting", None)
        key = _email_flow_key(update)
        if key:
            _awaiting_by_key.pop(key, None)
        return
    try:
        await asyncio.to_thread(save_user_email, user["id"], email)
    except Exception as e:
        await update.message.reply_text(
            f"❌ فشل الحفظ: {e}\nحاول مرة أخرى.",
            reply_markup=back_to_settings_keyboard(),
        )
        context.user_data.pop("awaiting", None)
        key = _email_flow_key(update)
        if key:
            _awaiting_by_key.pop(key, None)
        return
    context.user_data.pop("awaiting", None)
    key = _email_flow_key(update)
    if key:
        _awaiting_by_key.pop(key, None)
    settings = await asyncio.to_thread(get_or_create_user_settings, user["id"])
    alias = (settings.get("sender_email_alias") or "سيُنشأ تلقائياً")
    await update.message.reply_text(
        "✅ تم ربط الإيميل بنجاح\n"
        f"📨 إيميل التقديم الخاص بك: {alias}\n"
        "سيتم استخدام إيميلك كـ Reply-To وستستلم نسخة من كل تقديم.",
        reply_markup=back_to_settings_keyboard(),
    )
    context.user_data["_suppress_unknown_once"] = True
    try:
        from templates.preview import send_welcome_email
        settings = await asyncio.to_thread(get_or_create_user_settings, user["id"])
        await send_welcome_email(user, settings)
    except Exception:
        pass


async def handle_email_flow_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.user_data:
        key = _email_flow_key(update)
        if key:
            _awaiting_by_key.pop(key, None)
        return
    if not _in_email_flow(context):
        return
    await receive_email(update, context)


async def cb_set_templates(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    await query.edit_message_text(
        "🖼️ قالب التقديم\n\nيُستخدم قالب واحد لجميع التقديمات. يمكنك معاينته وإرساله إلى إيميلك.",
        reply_markup=templates_menu_keyboard(),
    )


async def cb_tpl_preview(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    settings = await asyncio.to_thread(get_or_create_user_settings, user["id"])
    email = settings.get("email")
    if not email:
        await query.edit_message_text(
            "يرجى ربط الإيميل أولاً من الإعدادات → ربط الإيميل.",
            reply_markup=templates_menu_keyboard(),
        )
        return
    from templates.preview import send_template_preview_email
    try:
        await send_template_preview_email(context.bot, user, settings)
        await query.edit_message_text(
            "تم إرسال معاينة القالب إلى إيميلك.",
            reply_markup=templates_menu_keyboard(),
        )
    except Exception as e:
        await query.edit_message_text(f"فشل الإرسال: {e}", reply_markup=templates_menu_keyboard())


async def cb_set_lang(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    warn = "⚠️ تحذير: لا يمكن تغيير لغة التقديم بعد الاختيار حتى انتهاء الاشتراك."
    await query.edit_message_text(
        f"لغة التقديم على الوظائف\n\n{warn}\n\nاختر اللغة:",
        reply_markup=lang_menu_keyboard(),
    )


async def cb_lang_ar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    await asyncio.to_thread(set_application_language, user["id"], "ar")
    await query.edit_message_text("✅ تم تعيين لغة التقديم: العربية", reply_markup=back_to_settings_keyboard())


async def cb_lang_en(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user:
        return
    await query.answer()
    user = await asyncio.to_thread(get_user_by_telegram, update.effective_user.id)
    if not user or not is_subscription_active(user):
        await query.edit_message_text("انتهى اشتراكك.")
        return
    await asyncio.to_thread(set_application_language, user["id"], "en")
    await query.edit_message_text("✅ تم تعيين لغة التقديم: English", reply_markup=back_to_settings_keyboard())


async def cb_set_contact(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    await query.edit_message_text(
        "📞 تواصل معنا\n\nواتساب: 0560766880\nتليجرام: @ahmedsupsa",
        reply_markup=back_to_settings_keyboard(),
    )


async def cb_back_settings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if query:
        await query.answer()
        await query.edit_message_text("👤 حسابي وإعدادات\n\nاختر:", reply_markup=settings_menu_keyboard())
    return ConversationHandler.END


def setup_settings_handlers(application):
    from telegram.ext import CallbackQueryHandler, MessageHandler, filters
    application.add_handler(MessageHandler(
        _FilterAwaitingEmailFlow()
        & filters.TEXT
        & ~filters.COMMAND
        & filters.ChatType.PRIVATE,
        handle_email_flow_message,
    ))
    application.add_handler(CallbackQueryHandler(cb_set_email, pattern="^set_email$"))
    application.add_handler(CallbackQueryHandler(cb_set_templates, pattern="^set_templates$"))
    application.add_handler(CallbackQueryHandler(cb_tpl_preview, pattern="^tpl_preview$"))
    application.add_handler(CallbackQueryHandler(cb_set_lang, pattern="^set_lang$"))
    application.add_handler(CallbackQueryHandler(cb_lang_ar, pattern="^lang_ar$"))
    application.add_handler(CallbackQueryHandler(cb_lang_en, pattern="^lang_en$"))
    application.add_handler(CallbackQueryHandler(cb_set_contact, pattern="^set_contact$"))
