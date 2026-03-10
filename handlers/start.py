# -*- coding: utf-8 -*-
import asyncio
import logging
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from telegram.constants import ChatAction

from database.db import (
    get_user_by_telegram,
    validate_activation_code,
    create_user,
    get_supabase,
    is_admin,
    invalidate_user_cache,
)
from keyboards import (
    main_start_keyboard,
    register_user_keyboard,
    back_to_main_start_keyboard,
    main_menu_keyboard,
    main_reply_keyboard,
)
from states import States


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.effective_user:
        return
    telegram_id = update.effective_user.id

    # مسح كاش هذا المستخدم عند كل /start لضمان جلب بيانات محدثة وتحديث القائمة (لوحة المفاتيح) في تليجرام
    invalidate_user_cache(telegram_id)

    # إذا كان هذا الحساب أدمن، نوجّهه مباشرة إلى لوحة الأدمن ولا نظهر قوائم المستخدمين
    if is_admin(telegram_id):
        from handlers.admin import cmd_admin
        await cmd_admin(update, context)
        return ConversationHandler.END

    user = await asyncio.to_thread(get_user_by_telegram, telegram_id)
    if user and user.get("full_name") and user.get("phone"):
        await update.message.reply_text(
            "مرحباً مرة أخرى. اختر من القائمة:",
            reply_markup=main_reply_keyboard(),
        )
        return ConversationHandler.END
    text = (
        "مرحباً! 👋\n\n"
        "اختر أحد الخيارات:"
    )
    await update.message.reply_text(text, reply_markup=main_start_keyboard())
    return ConversationHandler.END


async def cb_start_has_code(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    context.user_data["awaiting"] = "activation_code"
    await query.edit_message_text(
        "أدخل كود التفعيل الخاص بك:"
    )
    return States.AWAIT_ACTIVATION_CODE


async def receive_activation_code(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    code = update.message.text.strip()
    try:
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    except Exception:
        pass
    # إذا كان النص يبدو إيميلاً أو كلمة مرور تطبيق، لا نعتبره كود تفعيل ونهدي المحادثة
    if "@" in code and ("gmail" in code.lower() or "." in code):
        await update.message.reply_text(
            "يبدو أنك أدخلت إيميلاً. لربط الإيميل: القائمة الرئيسية ← الإعدادات ← ربط الإيميل.",
            reply_markup=back_to_main_start_keyboard(),
        )
        return ConversationHandler.END
    if len(code.split()) >= 3 and all(len(w) <= 6 for w in code.split()):
        await update.message.reply_text(
            "يبدو أنك أدخلت كلمة مرور التطبيق. لربط الإيميل: الإعدادات ← ربط الإيميل.",
            reply_markup=back_to_main_start_keyboard(),
        )
        return ConversationHandler.END
    try:
        code_data = await asyncio.to_thread(validate_activation_code, code)
    except Exception as e:
        logging.exception("validate_activation_code failed: %s", e)
        await update.message.reply_text(
            "حدث خطأ أثناء التحقق من الكود. يرجى المحاولة لاحقاً أو التواصل مع الدعم.",
            reply_markup=back_to_main_start_keyboard(),
        )
        context.user_data.pop("awaiting", None)
        return ConversationHandler.END
    if not code_data:
        await update.message.reply_text(
            "❌ كود التفعيل غير صحيح أو مستخدم مسبقاً.\nيرجى إعادة المحاولة أو الرجوع.",
            reply_markup=back_to_main_start_keyboard(),
        )
        context.user_data.pop("awaiting", None)
        return ConversationHandler.END
    context.user_data["activation_code"] = code_data
    await update.message.reply_text(
        "✅ تم التحقق من الكود بنجاح!\n\nتهانينا، يمكنك الآن تسجيل بياناتك.",
        reply_markup=register_user_keyboard(),
    )
    context.user_data.pop("awaiting", None)
    return ConversationHandler.END


async def cb_register_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    if not context.user_data.get("activation_code"):
        await query.edit_message_text(
            "يرجى الضغط على /start ثم اختيار «مشترك لدي كود تفعيل» وإدخال الكود أولاً.",
            reply_markup=main_start_keyboard(),
        )
        return ConversationHandler.END
    await query.edit_message_text("أدخل اسمك الكامل:")
    context.user_data["awaiting"] = "register_name"
    return States.AWAIT_REGISTER_NAME


async def receive_register_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    context.user_data["register_name"] = update.message.text.strip()
    await update.message.reply_text("أدخل رقم جوالك:")
    context.user_data["awaiting"] = "register_phone"
    return States.AWAIT_REGISTER_PHONE


async def receive_register_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    context.user_data["register_phone"] = update.message.text.strip()
    await update.message.reply_text("أدخل عمرك (رقم فقط، أو اكتب 0 لتخطي):")
    context.user_data["awaiting"] = "register_age"
    return States.AWAIT_REGISTER_AGE


async def receive_register_age(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    try:
        age = int(update.message.text.strip())
        if age < 0 or age > 150:
            age = None
    except ValueError:
        age = None
    context.user_data["register_age"] = age
    await update.message.reply_text("أدخل مدينتك:")
    context.user_data["awaiting"] = "register_city"
    return States.AWAIT_REGISTER_CITY


async def receive_register_city(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.effective_user:
        return ConversationHandler.END
    city = update.message.text.strip() if update.message and update.message.text else ""
    code_data = context.user_data.get("activation_code")
    if not code_data:
        await update.message.reply_text("انتهت الجلسة. اضغط /start للبدء من جديد.")
        return ConversationHandler.END
    name = context.user_data.get("register_name", "")
    phone = context.user_data.get("register_phone", "")
    age = context.user_data.get("register_age")
    try:
        await asyncio.to_thread(
            create_user,
            update.effective_user.id,
            code_data["id"],
            code_data.get("subscription_days", 30),
            name,
            phone,
            age,
            city,
        )
    except Exception as e:
        await update.message.reply_text(f"حدث خطأ أثناء التسجيل: {e}")
        return ConversationHandler.END
    for k in ["activation_code", "register_name", "register_phone", "register_age", "awaiting"]:
        context.user_data.pop(k, None)
    await update.message.reply_text(
        "✅ تم حفظ بياناتك بنجاح!\n\n"
        "يمكنك الآن استخدام البوت من الأزرار في الأسفل 👇",
        reply_markup=main_reply_keyboard(),
    )
    return ConversationHandler.END


async def cb_start_subscribe(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    PAYMENT_LINK = "https://streampay.sa/s/bDgCO"
    text = (
        "🛒 **الاشتراك في البوت**\n\n"
        "لشراء الاشتراك ادفع عبر رابط الدفع الآمن:\n"
        f"[اضغط هنا للدفع]({PAYMENT_LINK})\n\n"
        "بعد الدفع **تواصل معنا** لإرسال كود التفعيل:\n"
        "• واتساب: 0560766880\n"
        "• تليجرام: @ahmedsupsa\n\n"
        "بعد استلام كود التفعيل، اضغط /start ثم اختر «مشترك لدي كود تفعيل» وأدخل الكود."
    )
    await query.edit_message_text(
        text,
        reply_markup=back_to_main_start_keyboard(),
        parse_mode="Markdown",
    )


async def cb_main_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    text = "اختر أحد الخيارات:"
    await query.edit_message_text(text, reply_markup=main_start_keyboard())
    return ConversationHandler.END


def setup_start_handlers(application):
    from telegram.ext import CommandHandler, CallbackQueryHandler, MessageHandler, filters, ConversationHandler

    conv = ConversationHandler(
        entry_points=[
            CallbackQueryHandler(cb_start_has_code, pattern="^start_has_code$"),
            CallbackQueryHandler(cb_register_user, pattern="^register_user$"),
        ],
        states={
            States.AWAIT_ACTIVATION_CODE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_activation_code),
            ],
            States.AWAIT_REGISTER_NAME: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_register_name),
            ],
            States.AWAIT_REGISTER_PHONE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_register_phone),
            ],
            States.AWAIT_REGISTER_AGE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_register_age),
            ],
            States.AWAIT_REGISTER_CITY: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_register_city),
            ],
        },
        fallbacks=[
            CallbackQueryHandler(cb_main_start, pattern="^main_start$"),
            CommandHandler("start", cmd_start),
        ],
    )
    application.add_handler(CommandHandler("start", cmd_start))
    # group=-1 حتى تُعالج رسالة كود التفعيل قبل msg_job_search (group 0) الذي يلتقط كل النصوص
    application.add_handler(conv, group=-1)
    application.add_handler(CallbackQueryHandler(cb_start_subscribe, pattern="^start_subscribe$"))
    application.add_handler(CallbackQueryHandler(cb_main_start, pattern="^main_start$"))
