# -*- coding: utf-8 -*-
"""
أدمن من داخل نفس البوت: /admin → لوحة تحكم بـ Reply Keyboard.
يُحدد الأدمن عبر ADMIN_TELEGRAM_IDS في .env أو جدول admin_users.
"""
import random
import string
import re
from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from telegram.ext import ContextTypes, ConversationHandler

import asyncio
from database.db import (
    is_admin,
    insert_activation_codes,
    add_admin_job,
    add_admin_announcement,
    get_admin_jobs,
    get_admin_announcements,
    delete_admin_job,
    delete_admin_announcement,
    delete_user_completely,
    get_job_fields,
    get_user_by_id,
    admin_stats_users_count,
    admin_stats_applications_total,
    admin_stats_applications_today,
    admin_stats_applications_recent,
    admin_stats_jobs_applied_count,
    admin_stats_activation_codes_used,
    admin_stats_activation_codes_unused,
    admin_list_users,
    admin_list_activation_codes_unused,
    admin_list_activation_codes_used,
)
from states import States
from admin.web_access import build_gate_token

_SPEC_PAGE_SIZE = 8


# ─── Reply Keyboards للأدمن ───

_ADMIN_BUTTONS = (
    "🔑 توليد أكواد", "➕ كود يدوي", "💼 إضافة وظيفة", "📢 إضافة إعلان",
    "📊 إحصائيات", "👥 المشتركين", "📊 احصائيات التقديمات", "🔑 الأكواد", "📋 احصائيات الوظائف", "📢 الإعلانات",
    "🗑 حذف مستخدم", "🌐 لوحة الويب",
)


def _normalize_btn_text(text: str) -> str:
    """توحيد نص الزر لتجنب مشاكل variation selector في الإيموجي."""
    t = (text or "").strip()
    return t.replace("\ufe0f", "")


def admin_reply_keyboard():
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("📊 إحصائيات"), KeyboardButton("👥 المشتركين")],
            [KeyboardButton("📊 احصائيات التقديمات"), KeyboardButton("🔑 الأكواد")],
            [KeyboardButton("💼 إضافة وظيفة"), KeyboardButton("📋 احصائيات الوظائف")],
            [KeyboardButton("📢 إضافة إعلان"), KeyboardButton("📢 الإعلانات")],
            [KeyboardButton("🔑 توليد أكواد"), KeyboardButton("➕ كود يدوي")],
            [KeyboardButton("🗑 حذف مستخدم"), KeyboardButton("🌐 لوحة الويب")],
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
    # تنظيف أي حالة قديمة + إجبار تحديث الكيبورد لدى تيليجرام
    for k in list(context.user_data.keys()):
        if k.startswith("admin_"):
            context.user_data.pop(k, None)
    await update.message.reply_text("🔄 تحديث لوحة الأدمن...", reply_markup=ReplyKeyboardRemove())
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

    text = _normalize_btn_text(update.message.text)

    if text == _normalize_btn_text("🔑 توليد أكواد"):
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

    elif text == _normalize_btn_text("➕ كود يدوي"):
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

    elif text == _normalize_btn_text("💼 إضافة وظيفة"):
        await update.message.reply_text(
            "💼 **إضافة وظيفة (سريع)**\n\n"
            "أرسل كل تفاصيل الوظيفة في **رسالة واحدة** (عدا إيميل التقديم) بصيغة مثل:\n\n"
            "`العنوان: مدير مبيعات`\n"
            "`الشركة: شركة المثال`\n"
            "`الوصف: تفاصيل الوظيفة...`\n"
            "`الشروط: شرط 1، شرط 2...`\n\n"
            "بعدها سأطلب منك **إيميل التقديم** في خطوة منفصلة.",
            parse_mode="Markdown",
            reply_markup=admin_reply_keyboard(),
        )
        context.user_data["admin_awaiting"] = "job_title"
        return States.ADMIN_AWAIT_JOB_TITLE

    elif text == _normalize_btn_text("📢 إضافة إعلان"):
        await update.message.reply_text(
            "📢 **إضافة إعلان (سريع)**\n\n"
            "أرسل الإعلان في **رسالة واحدة**:\n"
            "- إمّا **صورة مع كابشن**\n"
            "- أو **نص فقط**\n\n"
            "ملاحظة: أول سطر يُعتبر عنواناً، والباقي نص الإعلان.",
            parse_mode="Markdown",
            reply_markup=admin_reply_keyboard(),
        )
        context.user_data["admin_awaiting"] = "ann_title"
        return States.ADMIN_AWAIT_ANN_TITLE

    # ─── إحصائيات ومشتركين وأكواد ───
    elif text == _normalize_btn_text("📊 إحصائيات"):
        users = await asyncio.to_thread(admin_stats_users_count)
        apps_total = await asyncio.to_thread(admin_stats_applications_total)
        apps_today = await asyncio.to_thread(admin_stats_applications_today)
        jobs_applied = await asyncio.to_thread(admin_stats_jobs_applied_count)
        codes_used = await asyncio.to_thread(admin_stats_activation_codes_used)
        codes_unused = await asyncio.to_thread(admin_stats_activation_codes_unused)
        msg = (
            "📊 **إحصائيات اللوحة**\n\n"
            f"👥 المشتركون: **{users}**\n"
            f"📄 إجمالي التقديمات: **{apps_total}**\n"
            f"📅 تقديمات اليوم: **{apps_today}**\n"
            f"💼 وظائف تم التقديم عليها: **{jobs_applied}**\n"
            f"🔑 أكواد مستعملة: **{codes_used}**\n"
            f"🔑 أكواد غير مستعملة: **{codes_unused}**"
        )
        await update.message.reply_text(msg, parse_mode="Markdown", reply_markup=admin_reply_keyboard())
        return ConversationHandler.END

    elif text == _normalize_btn_text("👥 المشتركين"):
        users_list = await asyncio.to_thread(admin_list_users, 40)
        if not users_list:
            await update.message.reply_text("لا يوجد مشتركون حتى الآن.", reply_markup=admin_reply_keyboard())
            return ConversationHandler.END
        lines = []
        for i, u in enumerate(users_list[:40], 1):
            name = (u.get("full_name") or "—")[:25]
            phone = (u.get("phone") or "—")[:12]
            ends = (u.get("subscription_ends_at") or "—")[:10]
            lines.append(f"{i}. {name} | {phone} | ينتهي: {ends}")
        msg = "👥 **المشتركون** (آخر 40)\n\n" + "\n".join(lines)
        if len(msg) > 4000:
            msg = msg[:3980] + "\n\n..."
        await update.message.reply_text(msg, parse_mode="Markdown", reply_markup=admin_reply_keyboard())
        return ConversationHandler.END

    elif text == _normalize_btn_text("📊 احصائيات التقديمات"):
        total = await asyncio.to_thread(admin_stats_applications_total)
        today = await asyncio.to_thread(admin_stats_applications_today)
        recent = await asyncio.to_thread(admin_stats_applications_recent, 15)
        head = f"📊 **احصائيات التقديمات**\n\nإجمالي: **{total}** | اليوم: **{today}**\n\n**آخر 15 تقديم:**\n"
        if not recent:
            await update.message.reply_text(head + "لا توجد تقديمات.", parse_mode="Markdown", reply_markup=admin_reply_keyboard())
            return ConversationHandler.END
        lines = []
        for r in recent:
            user_id = r.get("user_id")
            user = await asyncio.to_thread(get_user_by_id, user_id) if user_id else None
            name = (user.get("full_name") or "مجهول")[:15] if user else "—"
            job = (r.get("job_title") or "—")[:30]
            at = (r.get("applied_at") or "—")[:16]
            lines.append(f"• {name} | {job} | {at}")
        msg = head + "\n".join(lines)
        if len(msg) > 4000:
            msg = msg[:3980] + "\n..."
        await update.message.reply_text(msg, parse_mode="Markdown", reply_markup=admin_reply_keyboard())
        return ConversationHandler.END

    elif text == _normalize_btn_text("🔑 الأكواد"):
        used = await asyncio.to_thread(admin_stats_activation_codes_used)
        unused = await asyncio.to_thread(admin_stats_activation_codes_unused)
        used_list = await asyncio.to_thread(admin_list_activation_codes_used, 10)
        unused_list = await asyncio.to_thread(admin_list_activation_codes_unused, 15)
        msg = (
            "🔑 **الأكواد**\n\n"
            f"مستعملة: **{used}** | غير مستعملة: **{unused}**\n\n"
            "**عينة مستعملة (آخر 10):**\n"
        )
        for r in used_list[:10]:
            code = (r.get("code") or "—")[:20]
            used_at = (r.get("used_at") or "—")[:10]
            msg += f"• `{code}` ← {used_at}\n"
        msg += "\n**عينة غير مستعملة (15):**\n"
        for r in unused_list[:15]:
            code = (r.get("code") or "—")[:20]
            msg += f"• `{code}`\n"
        if len(msg) > 4000:
            msg = msg[:3980] + "\n..."
        await update.message.reply_text(msg, parse_mode="Markdown", reply_markup=admin_reply_keyboard())
        return ConversationHandler.END

    elif text == _normalize_btn_text("📋 احصائيات الوظائف"):
        jobs = await asyncio.to_thread(get_admin_jobs, False)
        if not jobs:
            await update.message.reply_text("لا توجد وظائف مسجلة.", reply_markup=admin_reply_keyboard())
            return ConversationHandler.END
        lines = []
        kb = []
        for j in jobs[:25]:
            jid = j.get("id", "")
            title = (j.get("title_ar") or j.get("title_en") or "—")[:40]
            company = (j.get("company") or "")[:20]
            active = "✅" if j.get("is_active") else "⏸"
            lines.append(f"{active} {title} | {company}")
            kb.append([InlineKeyboardButton(f"🗑 حذف: {title[:25]}", callback_data=f"admin_del_job:{jid}")])
        kb.append([InlineKeyboardButton("⬅️ رجوع", callback_data="admin_close")])
        msg = "📋 **احصائيات الوظائف**\n\nاضغط حذف لإزالة وظيفة:\n\n" + "\n".join(lines)
        if len(msg) > 4000:
            msg = msg[:3980] + "\n..."
        await update.message.reply_text(
            msg,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(kb),
        )
        return ConversationHandler.END

    elif text == _normalize_btn_text("📢 الإعلانات"):
        anns = await asyncio.to_thread(get_admin_announcements, False, False)
        if not anns:
            await update.message.reply_text("لا توجد إعلانات.", reply_markup=admin_reply_keyboard())
            return ConversationHandler.END
        lines = []
        kb = []
        for a in anns[:25]:
            aid = a.get("id", "")
            title = (a.get("title") or "إعلان")[:40]
            body = (a.get("body_text") or "")[:30]
            active = "✅" if a.get("is_active") else "⏸"
            lines.append(f"{active} {title} | {body}...")
            kb.append([InlineKeyboardButton(f"🗑 حذف: {title[:25]}", callback_data=f"admin_del_ann:{aid}")])
        kb.append([InlineKeyboardButton("⬅️ رجوع", callback_data="admin_close")])
        msg = "📢 **الإعلانات**\n\nاضغط حذف لإزالة إعلان:\n\n" + "\n".join(lines)
        if len(msg) > 4000:
            msg = msg[:3980] + "\n..."
        await update.message.reply_text(
            msg,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(kb),
        )
        return ConversationHandler.END

    elif text == _normalize_btn_text("🗑 حذف مستخدم"):
        users_list = await asyncio.to_thread(admin_list_users, 25)
        if not users_list:
            await update.message.reply_text("لا يوجد مستخدمون مسجلون.", reply_markup=admin_reply_keyboard())
            return ConversationHandler.END
        lines = []
        kb = []
        for u in users_list:
            uid = str(u.get("id", ""))
            name = (u.get("full_name") or "بدون اسم")[:25]
            phone = (u.get("phone") or "")[:12]
            lines.append(f"• {name} | {phone}")
            kb.append([InlineKeyboardButton(f"🗑 حذف: {name}", callback_data=f"admin_del_user:{uid}")])
        kb.append([InlineKeyboardButton("⬅️ رجوع", callback_data="admin_close")])
        msg = "🗑 **حذف مستخدم**\n\nسيتم حذف المستخدم وكل بياناته من Supabase (اشتراك، إعدادات، سيرة ذاتية، تقديمات).\n\nاختر المستخدم:\n\n" + "\n".join(lines)
        if len(msg) > 4000:
            msg = msg[:3980] + "\n..."
        await update.message.reply_text(msg, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(kb))
        return ConversationHandler.END

    elif text == _normalize_btn_text("🌐 لوحة الويب") or text.endswith("لوحة الويب"):
        import config
        base_url = (getattr(config, "ADMIN_DASHBOARD_URL", "") or "").strip().rstrip("/")
        if not base_url:
            await update.message.reply_text(
                "❌ متغير ADMIN_DASHBOARD_URL غير مضبوط في البيئة.",
                reply_markup=admin_reply_keyboard(),
            )
            return ConversationHandler.END
        gate = build_gate_token(update.effective_user.id, ttl_seconds=300)
        url = f"{base_url}/login?gate={gate}"
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("🔐 فتح لوحة الأدمن (5 دقائق)", url=url)],
        ])
        await update.message.reply_text(
            "رابط آمن ومؤقت للوحة الأدمن.\nبعد فتحه أدخل كلمة المرور.",
            reply_markup=kb,
        )
        return ConversationHandler.END


# ─── معالجات النصوص داخل الـ ConversationHandler ───

async def admin_receive_codes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in _ADMIN_BUTTONS:
        return States.ADMIN_AWAIT_CODES
    try:
        parts = update.message.text.strip().split()
        count = int(parts[0]) if parts else 49
        days = int(parts[1]) if len(parts) > 1 else 365
        count = min(max(1, count), 500)
        days = max(1, days)
    except (ValueError, IndexError):
        await update.message.reply_text(
            "صيغة غير صحيحة. مثال: `49 365`",
            parse_mode="Markdown",
            reply_markup=admin_reply_keyboard(),
        )
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
    if update.message.text.strip() in _ADMIN_BUTTONS:
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
    if update.message.text.strip() in _ADMIN_BUTTONS:
        return States.ADMIN_AWAIT_JOB_TITLE
    raw = update.message.text.strip()
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    if not lines:
        await update.message.reply_text("❌ أرسل نص الوظيفة في رسالة واحدة.")
        return States.ADMIN_AWAIT_JOB_TITLE

    # صيغة مفضلة بالحقول: العنوان/الشركة/الوصف/الشروط
    title = ""
    company = ""
    desc_parts: list[str] = []
    for ln in lines:
        m = re.match(r"^(العنوان|المسمى|الوظيفة)\s*:\s*(.+)$", ln, flags=re.IGNORECASE)
        if m:
            title = m.group(2).strip()
            continue
        m = re.match(r"^(الشركة)\s*:\s*(.+)$", ln, flags=re.IGNORECASE)
        if m:
            company = m.group(2).strip()
            continue
        m = re.match(r"^(الوصف|الشروط|المتطلبات)\s*:\s*(.+)$", ln, flags=re.IGNORECASE)
        if m:
            desc_parts.append(f"{m.group(1)}: {m.group(2).strip()}")
            continue
        desc_parts.append(ln)

    # fallback ذكي: أول سطر عنوان، ثاني سطر شركة، والباقي وصف
    if not title:
        title = lines[0]
    if not company and len(lines) > 1 and not lines[1].startswith(("الوصف", "الشروط", "المتطلبات")):
        company = lines[1].replace("الشركة:", "").strip()
    if not desc_parts:
        rest = lines[2:] if len(lines) > 2 else lines[1:]
        desc_parts = rest

    desc_text = "\n".join([p for p in desc_parts if p]).strip()
    if not title:
        await update.message.reply_text("❌ لم أستطع استخراج عنوان الوظيفة. اكتب العنوان بوضوح.")
        return States.ADMIN_AWAIT_JOB_TITLE

    context.user_data["admin_title"] = title
    context.user_data["admin_company"] = company
    context.user_data["admin_desc"] = desc_text

    await update.message.reply_text(
        "✅ تم استلام تفاصيل الوظيفة.\n\nالآن أرسل **إيميل التقديم** (إلزامي):",
        parse_mode="Markdown",
    )
    return States.ADMIN_AWAIT_JOB_EMAIL


async def admin_receive_job_desc(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in _ADMIN_BUTTONS:
        return States.ADMIN_AWAIT_JOB_DESC
    context.user_data["admin_desc"] = update.message.text.strip() if update.message.text.strip() != "-" else ""
    await update.message.reply_text("أرسل **اسم الشركة** (أو `-` لتخطي):", parse_mode="Markdown")
    return States.ADMIN_AWAIT_JOB_COMPANY


async def admin_receive_job_company(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in _ADMIN_BUTTONS:
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
    if update.message.text.strip() in _ADMIN_BUTTONS:
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
    """
    استقبال الإعلان دفعة واحدة:
    - صورة + كابشن
    - أو نص فقط
    ثم طلب المدة والتكرار.
    """
    if not update.message:
        return ConversationHandler.END

    text = ""
    image_file_id = None

    if update.message.photo:
        image_file_id = update.message.photo[-1].file_id
        text = (update.message.caption or "").strip()
    elif update.message.text:
        text = update.message.text.strip()
        if text in _ADMIN_BUTTONS:
            return States.ADMIN_AWAIT_ANN_TITLE
    else:
        await update.message.reply_text("أرسل صورة مع كابشن أو أرسل نص الإعلان فقط.")
        return States.ADMIN_AWAIT_ANN_TITLE

    if not text:
        await update.message.reply_text("❌ أرسل نص الإعلان داخل الرسالة (كابشن أو نص).")
        return States.ADMIN_AWAIT_ANN_TITLE

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    title = lines[0] if lines else ""
    body = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""
    if not body:
        # إذا أرسل سطر واحد فقط نخزّنه كنص الإعلان بدون عنوان مستقل
        body = title
        title = ""

    context.user_data["admin_ann_title"] = title
    context.user_data["admin_ann_body"] = body
    context.user_data["admin_ann_image"] = image_file_id
    await update.message.reply_text(
        "أرسل **مدة بقاء الإعلان بالأيام** (مثل `7`، أو `-` بدون انتهاء):",
        parse_mode="Markdown",
    )
    return States.ADMIN_AWAIT_ANN_DURATION


async def admin_receive_ann_body(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in _ADMIN_BUTTONS:
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
    if update.message.text.strip() in _ADMIN_BUTTONS:
        return States.ADMIN_AWAIT_ANN_DURATION
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
    context.user_data["admin_ann_expires_at"] = expires_at
    await update.message.reply_text(
        "أرسل **عدد مرات التكرار لكل مشترك** (من 1 إلى 10):",
        parse_mode="Markdown",
    )
    return States.ADMIN_AWAIT_ANN_REPEAT


async def admin_receive_ann_repeat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return ConversationHandler.END
    if update.message.text.strip() in _ADMIN_BUTTONS:
        return States.ADMIN_AWAIT_ANN_REPEAT
    try:
        repeat_count = int(update.message.text.strip())
    except ValueError:
        await update.message.reply_text("أدخل رقماً من 1 إلى 10.")
        return States.ADMIN_AWAIT_ANN_REPEAT
    repeat_count = max(1, min(repeat_count, 10))

    add_admin_announcement(
        title=context.user_data.get("admin_ann_title", ""),
        body_text=context.user_data.get("admin_ann_body", ""),
        image_file_id=context.user_data.get("admin_ann_image"),
        expires_at=context.user_data.get("admin_ann_expires_at"),
        repeat_count=repeat_count,
    )
    # تشغيل دورة الإعلانات فوراً بعد النشر، حتى لا ينتظر الأدمن حتى الدورة الدورية القادمة.
    try:
        from services.announcements import run_announcements_cycle
        await run_announcements_cycle(context.bot)
    except Exception:
        pass
    next_send_at_utc = datetime.utcnow() + timedelta(hours=24)
    next_send_at_ksa = next_send_at_utc + timedelta(hours=3)
    next_send_txt = next_send_at_ksa.strftime("%Y-%m-%d %H:%M (توقيت السعودية)")
    for k in ("admin_ann_title", "admin_ann_body", "admin_ann_image", "admin_ann_expires_at", "admin_awaiting"):
        context.user_data.pop(k, None)
    await update.message.reply_text(
        f"✅ **تم نشر الإعلان بنجاح!**\n\n"
        f"🔁 عدد التكرار لكل مشترك: {repeat_count}\n"
        f"⏱️ التكرار يتم كل 24 ساعة.\n"
        f"📅 الإرسال التالي المتوقع (المرّة الثانية): {next_send_txt}",
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


async def cb_admin_del_job(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user or not is_admin(update.effective_user.id):
        if query:
            await query.answer()
        return
    await query.answer()
    job_id = (query.data or "").split(":", 1)[-1].strip()
    if not job_id:
        return
    outcome = await asyncio.to_thread(delete_admin_job, job_id)
    if outcome == "deactivated":
        await query.edit_message_text(
            "⚠️ الوظيفة مرتبطة بتقديمات سابقة؛ تم إخفاؤها من القائمة (تعطيل) بدل الحذف النهائي."
        )
    else:
        await query.edit_message_text("✅ تم حذف الوظيفة.")


async def cb_admin_del_ann(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query or not update.effective_user or not is_admin(update.effective_user.id):
        if query:
            await query.answer()
        return
    await query.answer()
    ann_id = (query.data or "").split(":", 1)[-1].strip()
    if not ann_id:
        return
    await asyncio.to_thread(delete_admin_announcement, ann_id)
    await query.edit_message_text("✅ تم حذف الإعلان.")


async def cb_admin_del_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """عرض تأكيد حذف المستخدم."""
    query = update.callback_query
    if not query or not update.effective_user or not is_admin(update.effective_user.id):
        if query:
            await query.answer()
        return
    await query.answer()
    user_id = (query.data or "").split(":", 1)[-1].strip()
    if not user_id:
        return
    user = await asyncio.to_thread(get_user_by_id, user_id)
    name = (user.get("full_name") or user.get("phone") or "المستخدم")[:30] if user else "المستخدم"
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("✅ نعم، احذف المستخدم وكل بياناته", callback_data=f"admin_del_user_confirm:{user_id}")],
        [InlineKeyboardButton("❌ إلغاء", callback_data="admin_del_user_cancel")],
    ])
    await query.edit_message_text(
        f"⚠️ **تأكيد الحذف**\n\n"
        f"حذف **{name}**؟\n\n"
        f"سيتم حذف المستخدم وكل بياناته من Supabase:\n"
        f"• الحساب والاشتراك\n• الإعدادات والإيميل\n• السيرة الذاتية (من التخزين أيضاً)\n• التفضيلات وسجل التقديمات",
        parse_mode="Markdown",
        reply_markup=kb,
    )


async def cb_admin_del_user_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """تنفيذ حذف المستخدم وكل بياناته."""
    query = update.callback_query
    if not query or not update.effective_user or not is_admin(update.effective_user.id):
        if query:
            await query.answer()
        return
    await query.answer()
    user_id = (query.data or "").split(":", 1)[-1].strip()
    if not user_id:
        return
    try:
        ok = await asyncio.to_thread(delete_user_completely, user_id)
        if ok:
            await query.edit_message_text("✅ تم حذف المستخدم وكل بياناته من قاعدة البيانات والتخزين.")
        else:
            await query.edit_message_text("❌ لم يُعثر على المستخدم أو حدث خطأ أثناء الحذف.")
    except Exception as e:
        await query.edit_message_text(f"❌ خطأ أثناء الحذف: {e}")


async def cb_admin_del_user_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if query:
        await query.answer()
        await query.edit_message_text("تم الإلغاء.")


def setup_admin_handlers(application):
    from telegram.ext import CommandHandler, CallbackQueryHandler, MessageHandler, filters
    import re
    import config

    application.add_handler(CommandHandler("admin", cmd_admin))

    # أزرار الأدمن Reply Keyboard: تُستقبل فقط من حسابات الأدمن (لئلا يلتقط معالج الأدمن ضغطات المستخدمين مثل «التقديمات»)
    admin_buttons = _ADMIN_BUTTONS
    admin_pattern = "|".join(re.escape(_normalize_btn_text(b)) for b in admin_buttons)
    admin_ids = getattr(config, "ADMIN_TELEGRAM_IDS", None) or []
    admin_filter = filters.User(user_id=admin_ids) if admin_ids else filters.ALL

    conv_admin = ConversationHandler(
        entry_points=[
            MessageHandler(
                filters.TEXT & admin_filter,
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
                MessageHandler(filters.PHOTO, admin_receive_ann_title),
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
            States.ADMIN_AWAIT_ANN_REPEAT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, admin_receive_ann_repeat),
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
    application.add_handler(CallbackQueryHandler(cb_admin_del_job, pattern="^admin_del_job:"))
    application.add_handler(CallbackQueryHandler(cb_admin_del_ann, pattern="^admin_del_ann:"))
    application.add_handler(CallbackQueryHandler(cb_admin_del_user, pattern="^admin_del_user:"))
    application.add_handler(CallbackQueryHandler(cb_admin_del_user_confirm, pattern="^admin_del_user_confirm:"))
    application.add_handler(CallbackQueryHandler(cb_admin_del_user_cancel, pattern="^admin_del_user_cancel$"))
