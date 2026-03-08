# -*- coding: utf-8 -*-
"""
أدمن من داخل نفس البوت: /admin → لوحة تحكم بـ Reply Keyboard.
يُحدد الأدمن عبر ADMIN_TELEGRAM_IDS في .env أو جدول admin_users.
"""
import random
import string
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from telegram.ext import ContextTypes, ConversationHandler

from database.db import (
    is_admin,
    insert_activation_codes,
    add_admin_job,
    add_admin_announcement,
    get_job_fields,
)
from states import States

_SPEC_PAGE_SIZE = 8


# ─── Reply Keyboards للأدمن ───

def admin_reply_keyboard():
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("🔑 توليد أكواد"), KeyboardButton("➕ كود يدوي")],
            [KeyboardButton("💼 إضافة وظيفة"), KeyboardButton("📢 إضافة إعلان")],
            [KeyboardButton("🚪 إغلاق لوحة الأدمن")],
        ],
        resize_keyboard=True,
        input_field_placeholder="لوحة تحكم الأدمن...",
    )


def _build_spec_keyboard(all_fields: list, selected_ids: set, page: int) -> InlineKeyboardMarkup:
    """بناء لوحة اختيار التخصصات (Inline) مع pagination."""
    start = page * _SPEC_PAGE_SIZE
    end = start + _SPEC_PAGE_SIZE
    page_fields = all_fields[start:end]

    rows = []
    for field in page_fields:
        fid = field["id"]
        name = field.get("name_ar") or field.get("name_en") or fid
        check = "✅ " if fid in selected_ids else ""
        rows.append([InlineKeyboardButton(f"{check}{name}", callback_data=f"adspec_toggle:{fid}")])

    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton("◀️ السابق", callback_data=f"adspec_page:{page - 1}"))
    if end < len(all_fields):
        nav.append(InlineKeyboardButton("التالي ▶️", callback_data=f"adspec_page:{page + 1}"))
    if nav:
        rows.append(nav)

    rows.append([InlineKeyboardButton(f"✔️ تأكيد ({len(selected_ids)} مختار)", callback_data="adspec_done")])
    rows.append([InlineKeyboardButton("⬅️ إلغاء", callback_data="admin_close")])
    return InlineKeyboardMarkup(rows)


# ─── /admin ───

async def cmd_admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.effective_user:
        return
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("⛔ غير مصرح لك.")
        return
    await update.message.reply_text(
        "🔐 **لوحة تحكم الأدمن**\n\nاختر من الأزرار في الأسفل:",
        parse_mode="Markdown",
        reply_markup=admin_reply_keyboard(),
    )
    context.user_data["admin_mode"] = True


async def handle_admin_reply_keyboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """يستقبل ضغطات أزرار Reply Keyboard للأدمن."""
    if not update.message or not update.message.text or not update.effective_user:
        return
    if not is_admin(update.effective_user.id):
        return

    text = update.message.text.strip()

    if text == "🚪 إغلاق لوحة الأدمن":
        context.user_data.pop("admin_mode", None)
        for k in list(context.user_data.keys()):
            if k.startswith("admin_"):
                context.user_data.pop(k, None)
        from keyboards import main_reply_keyboard
        await update.message.reply_text(
            "تم إغلاق لوحة الأدمن.",
            reply_markup=main_reply_keyboard(),
        )
        return ConversationHandler.END

    elif text == "🔑 توليد أكواد":
        await update.message.reply_text(
            "🔑 **توليد أكواد تفعيل**\n\n"
            "أرسل سطراً بصيغة:\n"
            "`عدد_الأكواد مسافة أيام_الاشتراك`\n\n"
            "مثال: `49 365` (49 كود، اشتراك سنة)",
            parse_mode="Markdown",
            reply_markup=admin_reply_keyboard(),
        )
        context.user_data["admin_awaiting"] = "codes"
        return States.ADMIN_AWAIT_CODES

    elif text == "➕ كود يدوي":
        await update.message.reply_text(
            "➕ **إضافة كود واحد**\n\n"
            "أرسل سطراً بصيغة:\n"
            "`نص_الكود مسافة أيام_الاشتراك`\n\n"
            "مثال: `WELCOME2025 365`",
            parse_mode="Markdown",
            reply_markup=admin_reply_keyboard(),
        )
        context.user_data["admin_awaiting"] = "single_code"
        return States.ADMIN_AWAIT_SINGLE_CODE

    elif text == "💼 إضافة وظيفة":
        await update.message.reply_text(
            "💼 **إضافة وظيفة**\n\nأرسل **عنوان الوظيفة** (عربي):",
            parse_mode="Markdown",
            reply_markup=admin_reply_keyboard(),
        )
        context.user_data["admin_awaiting"] = "job_title"
        return States.ADMIN_AWAIT_JOB_TITLE

    elif text == "📢 إضافة إعلان":
        await update.message.reply_text(
            "📢 **إضافة إعلان**\n\nأرسل **عنوان الإعلان** (أو `-` لتخطي):",
            parse_mode="Markdown",
            reply_markup=admin_reply_keyboard(),
        )
        context.user_data["admin_awaiting"] = "ann_title"
        return States.ADMIN_AWAIT_ANN_TITLE


# ─── معالجات النصوص داخل الـ ConversationHandler ───

async def admin_receive_codes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    # تجاهل أزرار الـ reply keyboard
    if update.message.text.strip() in ("🔑 توليد أكواد", "➕ كود يدوي", "💼 إضافة وظيفة", "📢 إضافة إعلان", "🚪 إغلاق لوحة الأدمن"):
        return States.ADMIN_AWAIT_CODES
    try:
        parts = update.message.text.strip().split()
        count = int(parts[0]) if parts else 49
        days = int(parts[1]) if len(parts) > 1 else 365
        count = min(max(1, count), 500)
        days = max(1, days)
    except (ValueError, IndexError):
        await update.message.reply_text("صيغة غير صحيحة. مثال: `49 365`", parse_mode="Markdown")
        return States.ADMIN_AWAIT_CODES
    seen = set()
    codes = []
    while len(codes) < count:
        c = "".join(random.choices(string.digits, k=7)) + "".join(random.choices(string.ascii_uppercase, k=2))
        if c not in seen:
            seen.add(c)
            codes.append(c)
    rows = [{"code": c, "subscription_days": days} for c in codes]
    insert_activation_codes(rows)
    await update.message.reply_text(
        f"✅ تم إضافة **{len(rows)}** كود (اشتراك {days} يوم)\n"
        f"عينة: `{', '.join(codes[:5])}`...",
        parse_mode="Markdown",
        reply_markup=admin_reply_keyboard(),
    )
    return ConversationHandler.END


async def admin_receive_single_code(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in ("🔑 توليد أكواد", "➕ كود يدوي", "💼 إضافة وظيفة", "📢 إضافة إعلان", "🚪 إغلاق لوحة الأدمن"):
        return States.ADMIN_AWAIT_SINGLE_CODE
    text = update.message.text.strip()
    parts = text.split()
    if len(parts) < 2:
        await update.message.reply_text("استخدم الصيغة: `نص_الكود أيام`\nمثال: `MYCODE 365`", parse_mode="Markdown")
        return States.ADMIN_AWAIT_SINGLE_CODE
    try:
        days = int(parts[-1])
        code = " ".join(parts[:-1]).strip()
    except ValueError:
        await update.message.reply_text("الأيام يجب أن تكون رقماً. مثال: `MYCODE 365`", parse_mode="Markdown")
        return States.ADMIN_AWAIT_SINGLE_CODE
    days = max(1, min(days, 3650))
    try:
        insert_activation_codes([{"code": code, "subscription_days": days}])
        await update.message.reply_text(
            f"✅ تمت إضافة الكود `{code}` (اشتراك {days} يوم)",
            parse_mode="Markdown",
            reply_markup=admin_reply_keyboard(),
        )
    except Exception as e:
        await update.message.reply_text(f"❌ فشل الحفظ. قد يكون الكود مكرراً.\n`{e}`", parse_mode="Markdown")
        return States.ADMIN_AWAIT_SINGLE_CODE
    return ConversationHandler.END


async def admin_receive_job_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in ("🔑 توليد أكواد", "➕ كود يدوي", "💼 إضافة وظيفة", "📢 إضافة إعلان", "🚪 إغلاق لوحة الأدمن"):
        return States.ADMIN_AWAIT_JOB_TITLE
    context.user_data["admin_title"] = update.message.text.strip()
    await update.message.reply_text("أرسل **الوصف** (أو `-` لتخطي):", parse_mode="Markdown")
    return States.ADMIN_AWAIT_JOB_DESC


async def admin_receive_job_desc(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in ("🔑 توليد أكواد", "➕ كود يدوي", "💼 إضافة وظيفة", "📢 إضافة إعلان", "🚪 إغلاق لوحة الأدمن"):
        return States.ADMIN_AWAIT_JOB_DESC
    context.user_data["admin_desc"] = update.message.text.strip() if update.message.text.strip() != "-" else ""
    await update.message.reply_text("أرسل **اسم الشركة** (أو `-` لتخطي):", parse_mode="Markdown")
    return States.ADMIN_AWAIT_JOB_COMPANY


async def admin_receive_job_company(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in ("🔑 توليد أكواد", "➕ كود يدوي", "💼 إضافة وظيفة", "📢 إضافة إعلان", "🚪 إغلاق لوحة الأدمن"):
        return States.ADMIN_AWAIT_JOB_COMPANY
    context.user_data["admin_company"] = update.message.text.strip() if update.message.text.strip() != "-" else ""
    await update.message.reply_text(
        "📧 أرسل **إيميل استقبال التقديمات** (إلزامي):",
        parse_mode="Markdown",
    )
    return States.ADMIN_AWAIT_JOB_EMAIL


async def admin_receive_job_email(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in ("🔑 توليد أكواد", "➕ كود يدوي", "💼 إضافة وظيفة", "📢 إضافة إعلان", "🚪 إغلاق لوحة الأدمن"):
        return States.ADMIN_AWAIT_JOB_EMAIL
    email = update.message.text.strip()
    if not email or "@" not in email:
        await update.message.reply_text("❌ الإيميل غير صحيح. أرسل إيميل صالح مثل: `hr@company.com`", parse_mode="Markdown")
        return States.ADMIN_AWAIT_JOB_EMAIL
    context.user_data["admin_app_email"] = email

    fields = get_job_fields()
    if not fields:
        await update.message.reply_text("❌ لا توجد تخصصات في قاعدة البيانات.")
        return ConversationHandler.END

    context.user_data["admin_spec_fields"] = fields
    context.user_data["admin_spec_selected"] = set()
    context.user_data["admin_spec_page"] = 0

    await update.message.reply_text(
        "🎯 **اختر التخصصات** المطلوبة للوظيفة\n\n"
        "اضغط على التخصص لتحديده، ثم اضغط **تأكيد**:",
        parse_mode="Markdown",
        reply_markup=_build_spec_keyboard(fields, set(), 0),
    )
    return States.ADMIN_AWAIT_JOB_SPEC


async def admin_spec_toggle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return States.ADMIN_AWAIT_JOB_SPEC
    await query.answer()
    fid = query.data.split(":", 1)[1]
    selected: set = context.user_data.get("admin_spec_selected", set())
    if fid in selected:
        selected.discard(fid)
    else:
        selected.add(fid)
    context.user_data["admin_spec_selected"] = selected
    fields = context.user_data.get("admin_spec_fields", [])
    page = context.user_data.get("admin_spec_page", 0)
    await query.edit_message_reply_markup(reply_markup=_build_spec_keyboard(fields, selected, page))
    return States.ADMIN_AWAIT_JOB_SPEC


async def admin_spec_page(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return States.ADMIN_AWAIT_JOB_SPEC
    await query.answer()
    page = int(query.data.split(":", 1)[1])
    context.user_data["admin_spec_page"] = page
    fields = context.user_data.get("admin_spec_fields", [])
    selected = context.user_data.get("admin_spec_selected", set())
    await query.edit_message_reply_markup(reply_markup=_build_spec_keyboard(fields, selected, page))
    return States.ADMIN_AWAIT_JOB_SPEC


async def admin_spec_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return States.ADMIN_AWAIT_JOB_SPEC
    await query.answer()

    selected_ids: set = context.user_data.get("admin_spec_selected", set())
    all_fields: list = context.user_data.get("admin_spec_fields", [])
    selected_names = [
        f.get("name_ar") or f.get("name_en") or f["id"]
        for f in all_fields if f["id"] in selected_ids
    ]
    specializations_text = ", ".join(selected_names)

    add_admin_job(
        title_ar=context.user_data.get("admin_title", ""),
        description_ar=context.user_data.get("admin_desc", ""),
        company=context.user_data.get("admin_company", ""),
        link_url="",
        application_email=context.user_data.get("admin_app_email", ""),
        specializations=specializations_text,
    )

    for k in ("admin_title", "admin_desc", "admin_company", "admin_app_email",
              "admin_spec_fields", "admin_spec_selected", "admin_spec_page", "admin_awaiting"):
        context.user_data.pop(k, None)

    spec_display = specializations_text if specializations_text else "بدون تخصص محدد"
    await query.edit_message_text(
        f"✅ **تمت إضافة الوظيفة بنجاح!**\n\n🎯 التخصصات: {spec_display}",
        parse_mode="Markdown",
    )
    return ConversationHandler.END


async def admin_receive_ann_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in ("🔑 توليد أكواد", "➕ كود يدوي", "💼 إضافة وظيفة", "📢 إضافة إعلان", "🚪 إغلاق لوحة الأدمن"):
        return States.ADMIN_AWAIT_ANN_TITLE
    context.user_data["admin_ann_title"] = update.message.text.strip() if update.message.text.strip() != "-" else ""
    await update.message.reply_text("أرسل **نص الإعلان**:", parse_mode="Markdown")
    return States.ADMIN_AWAIT_ANN_BODY


async def admin_receive_ann_body(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in ("🔑 توليد أكواد", "➕ كود يدوي", "💼 إضافة وظيفة", "📢 إضافة إعلان", "🚪 إغلاق لوحة الأدمن"):
        return States.ADMIN_AWAIT_ANN_BODY
    context.user_data["admin_ann_body"] = update.message.text.strip()
    await update.message.reply_text("أرسل **صورة** للإعلان (أو اكتب `-` لتخطي):", parse_mode="Markdown")
    return States.ADMIN_AWAIT_ANN_IMAGE


async def admin_receive_ann_image(update: Update, context: ContextTypes.DEFAULT_TYPE):
    image_file_id = None
    if update.message and update.message.photo:
        image_file_id = update.message.photo[-1].file_id
    elif update.message and update.message.text and update.message.text.strip() == "-":
        pass
    else:
        await update.message.reply_text("أرسل صورة أو اكتب `-` لتخطي.", parse_mode="Markdown")
        return States.ADMIN_AWAIT_ANN_IMAGE
    context.user_data["admin_ann_image"] = image_file_id
    await update.message.reply_text(
        "أرسل **مدة بقاء الإعلان بالأيام** (مثل `7`، أو `-` بدون انتهاء):",
        parse_mode="Markdown",
    )
    return States.ADMIN_AWAIT_ANN_DURATION


async def admin_receive_ann_duration(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in ("🔑 توليد أكواد", "➕ كود يدوي", "💼 إضافة وظيفة", "📢 إضافة إعلان", "🚪 إغلاق لوحة الأدمن"):
        return States.ADMIN_AWAIT_ANN_DURATION
    from datetime import datetime, timedelta
    raw = update.message.text.strip()
    expires_at = None
    if raw != "-":
        try:
            days = int(raw)
            days = max(1, min(days, 365))
            expires_at = datetime.utcnow() + timedelta(days=days)
        except ValueError:
            await update.message.reply_text("أدخل رقماً (أيام) أو `-`.")
            return States.ADMIN_AWAIT_ANN_DURATION
    add_admin_announcement(
        title=context.user_data.get("admin_ann_title", ""),
        body_text=context.user_data.get("admin_ann_body", ""),
        image_file_id=context.user_data.get("admin_ann_image"),
        expires_at=expires_at,
    )
    for k in ("admin_ann_title", "admin_ann_body", "admin_ann_image", "admin_awaiting"):
        context.user_data.pop(k, None)
    await update.message.reply_text(
        "✅ **تم نشر الإعلان بنجاح!**",
        parse_mode="Markdown",
        reply_markup=admin_reply_keyboard(),
    )
    return ConversationHandler.END


async def cb_admin_close(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if query:
        await query.answer()
        await query.edit_message_text("تم إغلاق لوحة التحكم.")
    for k in list(context.user_data.keys()):
        if k.startswith("admin_"):
            context.user_data.pop(k, None)
    return ConversationHandler.END


def setup_admin_handlers(application):
    from telegram.ext import CommandHandler, CallbackQueryHandler, MessageHandler, filters
    import re

    application.add_handler(CommandHandler("admin", cmd_admin))

    # أزرار الأدمن Reply Keyboard بأولوية عالية
    admin_buttons = ("🔑 توليد أكواد", "➕ كود يدوي", "💼 إضافة وظيفة", "📢 إضافة إعلان", "🚪 إغلاق لوحة الأدمن")
    admin_pattern = "|".join(re.escape(b) for b in admin_buttons)

    conv_admin = ConversationHandler(
        entry_points=[
            MessageHandler(
                filters.TEXT & filters.Regex(f"^({admin_pattern})$"),
                handle_admin_reply_keyboard,
            ),
        ],
        states={
            States.ADMIN_AWAIT_CODES: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, admin_receive_codes),
            ],
            States.ADMIN_AWAIT_SINGLE_CODE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, admin_receive_single_code),
            ],
            States.ADMIN_AWAIT_JOB_TITLE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, admin_receive_job_title),
            ],
            States.ADMIN_AWAIT_JOB_DESC: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, admin_receive_job_desc),
            ],
            States.ADMIN_AWAIT_JOB_COMPANY: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, admin_receive_job_company),
            ],
            States.ADMIN_AWAIT_JOB_EMAIL: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, admin_receive_job_email),
            ],
            States.ADMIN_AWAIT_JOB_SPEC: [
                CallbackQueryHandler(admin_spec_toggle, pattern="^adspec_toggle:"),
                CallbackQueryHandler(admin_spec_page, pattern="^adspec_page:"),
                CallbackQueryHandler(admin_spec_done, pattern="^adspec_done$"),
            ],
            States.ADMIN_AWAIT_ANN_TITLE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, admin_receive_ann_title),
            ],
            States.ADMIN_AWAIT_ANN_BODY: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, admin_receive_ann_body),
            ],
            States.ADMIN_AWAIT_ANN_IMAGE: [
                MessageHandler(filters.PHOTO, admin_receive_ann_image),
                MessageHandler(filters.TEXT & ~filters.COMMAND, admin_receive_ann_image),
            ],
            States.ADMIN_AWAIT_ANN_DURATION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, admin_receive_ann_duration),
            ],
        },
        fallbacks=[
            CallbackQueryHandler(cb_admin_close, pattern="^admin_close$"),
            CommandHandler("admin", cmd_admin),
        ],
        conversation_timeout=300,
    )
    application.add_handler(conv_admin, group=-1)
    application.add_handler(CallbackQueryHandler(cb_admin_close, pattern="^admin_close$"))
