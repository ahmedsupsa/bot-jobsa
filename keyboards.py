# -*- coding: utf-8 -*-
from telegram import (
    InlineKeyboardButton, InlineKeyboardMarkup,
    ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove,
)

# ─────────────────────────────────────────────
#  Reply Keyboards (ثابتة في أسفل الشاشة)
# ─────────────────────────────────────────────

def main_reply_keyboard():
    """القائمة الرئيسية - تظهر دائماً (5 خيارات)."""
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("📄 التقديمات"), KeyboardButton("👤 حسابي")],
            [KeyboardButton("🎯 تفضيلات الوظائف"), KeyboardButton("📢 الإعلانات")],
            [KeyboardButton("⚙️ الإعدادات")],
        ],
        resize_keyboard=True,
        input_field_placeholder="اختر من القائمة...",
    )


def applications_reply_keyboard():
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("📌 التقديمات المرسلة"), KeyboardButton("📅 سجل التقديمات")],
            [KeyboardButton("🎯 تفضيلات الوظائف")],
            [KeyboardButton("⬅️ الرئيسية")],
        ],
        resize_keyboard=True,
    )


def account_reply_keyboard():
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("📄 بياناتي"), KeyboardButton("📎 السيرة الذاتية")],
            [KeyboardButton("📊 حالة الاشتراك")],
            [KeyboardButton("⬅️ الرئيسية")],
        ],
        resize_keyboard=True,
    )


def cv_reply_keyboard():
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("➕ رفع سيرة ذاتية"), KeyboardButton("👁️ معاينة السيرة")],
            [KeyboardButton("⬅️ حسابي")],
        ],
        resize_keyboard=True,
    )


def settings_reply_keyboard():
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("📧 ربط الإيميل"), KeyboardButton("📘 دليل البدء")],
            [KeyboardButton("📞 تواصل معنا")],
            [KeyboardButton("⬅️ الرئيسية")],
        ],
        resize_keyboard=True,
    )


def admin_reply_keyboard():
    """لوحة تحكم الأدمن - Reply Keyboard (لا يظهر للمستخدمين؛ الأدمن يُعرَف بـ ID فقط)."""
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("🔑 توليد أكواد"), KeyboardButton("➕ كود يدوي")],
            [KeyboardButton("💼 إضافة وظيفة"), KeyboardButton("📢 إضافة إعلان")],
        ],
        resize_keyboard=True,
    )


# ─────────────────────────────────────────────
#  Inline Keyboards (للتأكيدات والقوائم الديناميكية)
# ─────────────────────────────────────────────

def main_start_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("مشترك لدي كود تفعيل", callback_data="start_has_code")],
        [InlineKeyboardButton("ارغب بالاشتراك في البوت", callback_data="start_subscribe")],
    ])


def register_user_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("تسجيل مستخدم", callback_data="register_user")],
        [InlineKeyboardButton("⬅️ الرجوع للخيارات الرئيسية", callback_data="main_start")],
    ])


def back_to_main_start_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("⬅️ الرجوع للخيارات الرئيسية", callback_data="main_start")],
    ])


# للتوافق مع الكود القديم
def main_menu_keyboard():
    return main_reply_keyboard()


def applications_menu_keyboard():
    return applications_reply_keyboard()


def account_menu_keyboard():
    return account_reply_keyboard()


def settings_menu_keyboard():
    return settings_reply_keyboard()


def cv_menu_keyboard():
    return cv_reply_keyboard()




def back_to_settings_keyboard():
    return settings_reply_keyboard()


# قالب تقديم واحد فقط — بدون اختيار بين عدة قوالب
def templates_menu_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📧 معاينة القالب وإرسال إلى إيميلك", callback_data="tpl_preview")],
        [InlineKeyboardButton("⬅️ الرجوع", callback_data="back_to_settings")],
    ])


def lang_menu_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("العربية", callback_data="lang_ar")],
        [InlineKeyboardButton("الانجليزية", callback_data="lang_en")],
        [InlineKeyboardButton("⬅️ الرجوع", callback_data="back_to_settings")],
    ])


def job_categories_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("مجالات عامة", callback_data="job_cat_general")],
        [InlineKeyboardButton("مجالات خاصة", callback_data="job_cat_specific")],
        [InlineKeyboardButton("الاثنين", callback_data="job_cat_both")],
        [InlineKeyboardButton("⬅️ الرجوع", callback_data="back_to_applications")],
    ])


def job_categories_reply_keyboard():
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("مجالات عامة")],
            [KeyboardButton("مجالات خاصة")],
            [KeyboardButton("الاثنين")],
            [KeyboardButton("⬅️ رجوع")],
        ],
        resize_keyboard=True,
    )


def job_fields_keyboard(fields: list, selected_ids: list, category: str, page: int = 0, search: str = ""):
    per_page = 8
    start = page * per_page
    end = start + per_page
    chunk = fields[start:end]
    buttons = []
    for f in chunk:
        sid = str(f["id"])
        label = f.get("name_ar") or f.get("name_en") or sid
        if sid in selected_ids:
            label = "✅ " + label
        buttons.append([InlineKeyboardButton(label, callback_data=f"job_toggle_{f['id']}")])
    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton("◀️ السابق", callback_data=f"job_page_{category}_{page-1}"))
    if end < len(fields):
        nav.append(InlineKeyboardButton("التالي ▶️", callback_data=f"job_page_{category}_{page+1}"))
    if nav:
        buttons.append(nav)
    buttons.append([InlineKeyboardButton("🔍 بحث", callback_data="job_search")])
    buttons.append([InlineKeyboardButton("✅ حفظ التفضيلات", callback_data="job_save_prefs")])
    buttons.append([InlineKeyboardButton("⬅️ الرجوع", callback_data="back_to_applications")])
    return InlineKeyboardMarkup(buttons)
