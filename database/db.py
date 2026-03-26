# -*- coding: utf-8 -*-
import os
import time
import re
from datetime import datetime, timedelta

import httpx
from dotenv import load_dotenv

load_dotenv()

# تخزين مؤقت للمستخدم (تقليل استدعاءات Supabase)
# يُمسح تلقائياً بعد 90 ثانية أو عند استدعاء invalidate_user_cache أو عند إعادة تشغيل البوت
_USER_CACHE: dict[int, tuple[dict, float]] = {}
_USER_CACHE_TTL = 90  # ثانية
_EMAIL_CHANGE_LIMIT = 3


def _user_cache_get(telegram_id: int) -> dict | None:
    now = time.time()
    if telegram_id in _USER_CACHE:
        user, exp = _USER_CACHE[telegram_id]
        if now < exp:
            return user
        del _USER_CACHE[telegram_id]
    return None


def _user_cache_set(telegram_id: int, user: dict | None) -> None:
    if user is None:
        _USER_CACHE.pop(telegram_id, None)
        return
    _USER_CACHE[telegram_id] = (user, time.time() + _USER_CACHE_TTL)


def invalidate_user_cache(telegram_id: int) -> None:
    _USER_CACHE.pop(telegram_id, None)


def get_user_by_id(user_id: str) -> dict | None:
    """جلب مستخدم بالـ UUID (للوحة الأدمن)."""
    if _use_rest:
        return _rest_select_one("users", id=user_id)
    sb = get_supabase()
    r = sb.table("users").select("*").eq("id", user_id).execute()
    return r.data[0] if r.data else None

# دعم مفاتيح sb_secret_ عبر REST (مكتبة supabase-py تقبل JWT فقط)
try:
    from . import supabase_rest as rest
    _use_rest = rest.use_rest_api()
except Exception:
    _use_rest = False

if _use_rest:
    from .supabase_rest import (
        select_one as _rest_select_one,
        select_all as _rest_select_all,
        select_columns as _rest_select_columns,
        count as _rest_count,
        insert as _rest_insert,
        insert_many as _rest_insert_many,
        update as _rest_update,
        delete as _rest_delete,
        upsert_merge as _rest_upsert_merge,
    )
else:
    from supabase import create_client, Client
    _supabase: Client | None = None

    def get_supabase() -> Client:
        global _supabase
        if _supabase is None:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_KEY")
            if not url or not key:
                raise ValueError("SUPABASE_URL and SUPABASE_KEY required")
            _supabase = create_client(url, key)
        return _supabase


def get_user_by_telegram(telegram_id: int) -> dict | None:
    cached = _user_cache_get(telegram_id)
    if cached is not None:
        return cached
    if _use_rest:
        user = _rest_select_one("users", telegram_id=telegram_id)
    else:
        sb = get_supabase()
        r = sb.table("users").select("*").eq("telegram_id", telegram_id).execute()
        user = r.data[0] if r.data and len(r.data) > 0 else None
    _user_cache_set(telegram_id, user)
    return user


def validate_activation_code(code: str) -> dict | None:
    if _use_rest:
        rows = _rest_select_all("activation_codes", code=code.strip(), used=False)
        return rows[0] if rows else None
    sb = get_supabase()
    r = sb.table("activation_codes").select("*").eq("code", code.strip()).eq("used", False).execute()
    if r.data and len(r.data) > 0:
        return r.data[0]
    return None


def use_activation_code(code_id: str, user_id: str) -> None:
    if _use_rest:
        _rest_update("activation_codes", {
            "used": True,
            "used_at": datetime.utcnow().isoformat(),
            "used_by_user_id": user_id,
        }, id=code_id)
        return
    sb = get_supabase()
    sb.table("activation_codes").update({
        "used": True,
        "used_at": datetime.utcnow().isoformat(),
        "used_by_user_id": user_id,
    }).eq("id", code_id).execute()


def create_user(telegram_id: int, code_id: str, subscription_days: int,
                full_name: str, phone: str, age: int | None, city: str) -> dict:
    ends_at = (datetime.utcnow() + timedelta(days=subscription_days)).isoformat()
    user = {
        "telegram_id": telegram_id,
        "activation_code_id": code_id,
        "subscription_ends_at": ends_at,
        "full_name": full_name,
        "phone": phone,
        "age": age,
        "city": city,
    }
    if _use_rest:
        rows = _rest_insert("users", user)
        if not rows:
            raise RuntimeError("فشل إنشاء المستخدم")
        use_activation_code(code_id, rows[0]["id"])
        invalidate_user_cache(telegram_id)
        return rows[0]
    sb = get_supabase()
    r = sb.table("users").insert(user).execute()
    if not r.data or len(r.data) == 0:
        raise RuntimeError("فشل إنشاء المستخدم")
    use_activation_code(code_id, r.data[0]["id"])
    invalidate_user_cache(telegram_id)
    return r.data[0]


def get_or_create_user_settings(user_id: str) -> dict:
    if _use_rest:
        row = _rest_select_one("user_settings", user_id=user_id)
        if row:
            return row
        try:
            rows = _rest_insert("user_settings", {"user_id": user_id})
        except Exception:
            row = _rest_select_one("user_settings", user_id=user_id)
            if row:
                return row
            raise
        return rows[0] if rows else {}
    sb = get_supabase()
    r = sb.table("user_settings").select("*").eq("user_id", user_id).execute()
    if r.data and len(r.data) > 0:
        return r.data[0]
    ins = sb.table("user_settings").insert({"user_id": user_id}).execute()
    return ins.data[0] if ins.data else {}


def update_user_settings(user_id: str, **kwargs) -> None:
    kwargs["updated_at"] = datetime.utcnow().isoformat()
    if _use_rest:
        _rest_update("user_settings", kwargs, user_id=user_id)
        return
    sb = get_supabase()
    sb.table("user_settings").update(kwargs).eq("user_id", user_id).execute()


def _parse_iso_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _compute_email_change_update(existing_row: dict | None, new_email: str) -> dict:
    """
    يحسب تحديثات عداد تغيير الإيميل (3 مرات فقط إجمالاً).
    - نفس الإيميل الحالي لا يستهلك محاولة.
    """
    row = existing_row or {}
    current_email = (row.get("email") or "").strip().lower()
    target_email = (new_email or "").strip().lower()
    if current_email and target_email and current_email == target_email:
        return {}

    count = int(row.get("email_change_count") or 0)

    if count >= _EMAIL_CHANGE_LIMIT:
        raise RuntimeError(
            "وصلت للحد الأعلى لتغيير الإيميل (3 مرات فقط). "
            "إذا احتجت تعديل إضافي تواصل مع الدعم."
        )

    out = {"email_change_count": count + 1}
    if not row.get("email_change_window_start"):
        out["email_change_window_start"] = datetime.utcnow().isoformat()
    return out


def _resend_alias_domain() -> str:
    """نطاق الإيميل الخاص بالمستخدمين (يفضل RESEND_ALIAS_DOMAIN)."""
    domain = (os.getenv("RESEND_ALIAS_DOMAIN", "") or "").strip().lower()
    if domain:
        return domain
    from_email = (os.getenv("RESEND_FROM_EMAIL", "") or "").strip().lower()
    if "@" in from_email:
        return from_email.split("@", 1)[1].strip().lower()
    return ""


def _resend_enabled() -> bool:
    return bool((os.getenv("RESEND_API_KEY", "") or "").strip() and _resend_alias_domain())


def _build_sender_alias_email(personal_email: str, domain: str) -> str:
    local = (personal_email or "").split("@", 1)[0].strip().lower()
    local = re.sub(r"[^a-z0-9._-]+", "-", local)
    local = re.sub(r"[-_.]{2,}", "-", local).strip("-_.")
    if not local:
        local = "user"
    local = local[:48]
    return f"{local}@{domain}"


def ensure_user_sender_alias(user_id: str, personal_email: str) -> str:
    """
    إنشاء/إرجاع إيميل التقديم الخاص بالمستخدم على نطاقنا.
    لا يُنشأ إلا عند تفعيل Resend وتوفر نطاق صالح.
    """
    if not personal_email or not _resend_enabled():
        return ""
    row = get_or_create_user_settings(user_id)
    existing = (row.get("sender_email_alias") or "").strip().lower()
    preferred = _build_sender_alias_email(personal_email, _resend_alias_domain())
    if existing == preferred:
        return existing
    alias = preferred
    update_user_settings(
        user_id,
        sender_email_alias=alias,
        sender_email_alias_created_at=datetime.utcnow().isoformat(),
    )
    return alias


def save_user_email_password(user_id: str, email: str, app_password: str) -> None:
    """
    حفظ إيميل Gmail وكلمة مرور التطبيق.
    يستخدم Upsert لضمان كتابة الصف حتى لو لم يكن موجوداً أو فشل التحديث السابق.
    """
    email = (email or "").strip()
    # Gmail يقبل كلمة المرور بمسافات أو بدون — نخزن بدون مسافات
    pwd = (app_password or "").replace(" ", "").strip()
    if not email or not pwd:
        raise ValueError("الإيميل وكلمة مرور التطبيق مطلوبان.")
    now = datetime.utcnow().isoformat()
    payload = {
        "user_id": user_id,
        "email": email,
        "app_password_encrypted": pwd,
        "updated_at": now,
    }
    current = get_or_create_user_settings(user_id)
    payload.update(_compute_email_change_update(current, email))
    if _resend_enabled():
        payload["sender_email_alias"] = ensure_user_sender_alias(user_id, email)
        if not current.get("sender_email_alias_created_at"):
            payload["sender_email_alias_created_at"] = datetime.utcnow().isoformat()
    if _use_rest:
        rows = _rest_upsert_merge("user_settings", payload, on_conflict="user_id")
        if not rows:
            # تحقق: ربما RLS أو مفتاح غير كافٍ
            row = _rest_select_one("user_settings", user_id=user_id)
            if not row or (row.get("email") or "").strip() != email:
                raise RuntimeError(
                    "لم يُحفظ الإيميل في قاعدة البيانات. "
                    "استخدم في المتغيرات مفتاح Supabase من نوع **service_role / secret** (ليس المفتاح العام فقط)، "
                    "أو راجع سياسات RLS لجدول user_settings في لوحة Supabase."
                )
            if (row.get("app_password_encrypted") or "").replace(" ", "") != pwd:
                raise RuntimeError(
                    "لم تُحفظ كلمة مرور التطبيق. تحقق من مفتاح Supabase (service role) وسياسات RLS."
                )
        else:
            r0 = rows[0]
            if (r0.get("email") or "").strip() != email:
                raise RuntimeError("فشل التحقق من حفظ الإيميل.")
            if (r0.get("app_password_encrypted") or "").replace(" ", "") != pwd:
                raise RuntimeError("فشل التحقق من حفظ كلمة مرور التطبيق.")
        return
    sb = get_supabase()
    sb.table("user_settings").upsert(payload, on_conflict="user_id").execute()
    r = sb.table("user_settings").select("*").eq("user_id", user_id).execute()
    row = r.data[0] if r.data else None
    if not row or (row.get("email") or "").strip() != email:
        raise RuntimeError("لم يُحفظ الإيميل. تحقق من الصلاحيات في Supabase.")
    if (row.get("app_password_encrypted") or "").replace(" ", "") != pwd:
        raise RuntimeError("لم تُحفظ كلمة مرور التطبيق.")


def save_user_email(user_id: str, email: str) -> None:
    """حفظ إيميل المستخدم فقط (مفيد عند استخدام Resend بدل SMTP)."""
    email = (email or "").strip()
    if not email:
        raise ValueError("الإيميل مطلوب.")
    current = get_or_create_user_settings(user_id)
    extra = _compute_email_change_update(current, email)
    payload = {"email": email, **extra}
    if _resend_enabled():
        payload["sender_email_alias"] = ensure_user_sender_alias(user_id, email)
        if not current.get("sender_email_alias_created_at"):
            payload["sender_email_alias_created_at"] = datetime.utcnow().isoformat()
    update_user_settings(user_id, **payload)


def save_user_template(user_id: str, template_type: str) -> None:
    update_user_settings(user_id, template_type=template_type)


def set_application_language(user_id: str, lang: str) -> None:
    if _use_rest:
        _rest_update("users", {
            "application_language": lang,
            "updated_at": datetime.utcnow().isoformat(),
        }, id=user_id)
        return
    get_supabase().table("users").update({
        "application_language": lang,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", user_id).execute()


def save_cv(user_id: str, file_id: str, file_name: str | None, storage_path: str | None = None) -> None:
    row = {
        "file_id": file_id,
        "file_name": file_name or "cv.pdf",
        "storage_path": storage_path,
    }
    if _use_rest:
        existing = _rest_select_one("user_cvs", user_id=user_id)
        if existing:
            _rest_update("user_cvs", {k: v for k, v in row.items() if v is not None}, user_id=user_id)
        else:
            _rest_insert("user_cvs", {"user_id": user_id, **{k: v for k, v in row.items() if v is not None}})
        return
    sb = get_supabase()
    existing = sb.table("user_cvs").select("id").eq("user_id", user_id).execute()
    if existing.data and len(existing.data) > 0:
        sb.table("user_cvs").update(row).eq("user_id", user_id).execute()
    else:
        sb.table("user_cvs").insert({"user_id": user_id, **row}).execute()


def get_cv(user_id: str) -> dict | None:
    if _use_rest:
        return _rest_select_one("user_cvs", user_id=user_id)
    sb = get_supabase()
    r = sb.table("user_cvs").select("*").eq("user_id", user_id).execute()
    return r.data[0] if r.data else None


def get_applications_count(user_id: str) -> int:
    if _use_rest:
        return _rest_count("applications", user_id=user_id)
    sb = get_supabase()
    r = sb.table("applications").select("*", count="exact", head=True).eq("user_id", user_id).execute()
    return getattr(r, "count", None) or 0


def get_applications_log(user_id: str, limit: int = 50) -> list:
    if _use_rest:
        return _rest_select_columns("applications", "id,job_title,applied_at", order="applied_at.desc", limit=limit, user_id=user_id)
    sb = get_supabase()
    r = sb.table("applications").select("id, job_title, applied_at").eq("user_id", user_id).order("applied_at", desc=True).limit(limit).execute()
    return r.data or []


def get_job_fields(category: str | None = None, search: str | None = None) -> list:
    if _use_rest:
        if category:
            rows = _rest_select_all("job_fields", category=category)
        else:
            rows = _rest_select_all("job_fields")
        if search:
            search_lower = search.lower()
            rows = [r for r in rows if search_lower in (r.get("name_ar") or "").lower() or search_lower in (r.get("name_en") or "").lower()]
        return rows
    sb = get_supabase()
    q = sb.table("job_fields").select("*")
    if category:
        q = q.eq("category", category)
    if search:
        q = q.or_(f"name_ar.ilike.%{search}%,name_en.ilike.%{search}%")
    r = q.execute()
    return r.data or []


def get_user_job_preferences(user_id: str) -> list:
    if _use_rest:
        rows = _rest_select_columns("user_job_preferences", "job_field_id", user_id=user_id)
        return [x["job_field_id"] for x in rows]
    sb = get_supabase()
    r = sb.table("user_job_preferences").select("job_field_id").eq("user_id", user_id).execute()
    return [x["job_field_id"] for x in (r.data or [])]


def set_user_job_preferences(user_id: str, job_field_ids: list) -> None:
    if _use_rest:
        _rest_delete("user_job_preferences", user_id=user_id)
        if job_field_ids:
            for fid in job_field_ids:
                _rest_insert("user_job_preferences", {"user_id": user_id, "job_field_id": fid})
        return
    sb = get_supabase()
    sb.table("user_job_preferences").delete().eq("user_id", user_id).execute()
    if job_field_ids:
        rows = [{"user_id": user_id, "job_field_id": fid} for fid in job_field_ids]
        sb.table("user_job_preferences").insert(rows).execute()


def has_applied_to_job(user_id: str, job_id: str) -> bool:
    """تحقق إذا كان المستخدم قدّم على هذه الوظيفة مسبقاً."""
    if _use_rest:
        rows = _rest_select_columns("applications", "id", user_id=user_id, job_id=job_id, limit=1)
        return len(rows) > 0
    sb = get_supabase()
    r = sb.table("applications").select("id", count="exact", head=True).eq("user_id", user_id).eq("job_id", job_id).execute()
    return (getattr(r, "count", None) or 0) > 0


def add_application(user_id: str, job_title: str, job_field_id: str | None = None, job_id: str | None = None) -> dict:
    row = {"user_id": user_id, "job_title": job_title, "job_field_id": job_field_id, "job_id": job_id}
    if _use_rest:
        rows = _rest_insert("applications", row)
        return rows[0] if rows else {}
    sb = get_supabase()
    r = sb.table("applications").insert(row).execute()
    return r.data[0] if r.data else {}


def is_subscription_active(user: dict) -> bool:
    if not user or not user.get("subscription_ends_at"):
        return False
    try:
        end = datetime.fromisoformat(user["subscription_ends_at"].replace("Z", "+00:00"))
        return datetime.utcnow() < end.replace(tzinfo=None) if end.tzinfo else end
    except Exception:
        return False


def get_subscription_ends_at(user: dict) -> str | None:
    return user.get("subscription_ends_at")


def insert_activation_codes(codes: list[dict]) -> int:
    """إدراج رموز تفعيل في الجدول. كل عنصر: {"code": "...", "subscription_days": 30}."""
    if not codes:
        return 0
    if _use_rest:
        _rest_insert_many("activation_codes", codes)
        return len(codes)
    sb = get_supabase()
    sb.table("activation_codes").insert(codes).execute()
    return len(codes)


# --- لوحة التحكم: وظائف وإعلانات ---
def get_admin_jobs(active_only: bool = True) -> list:
    if _use_rest:
        if active_only:
            return _rest_select_all("admin_jobs", is_active=True)
        return _rest_select_all("admin_jobs")
    sb = get_supabase()
    q = sb.table("admin_jobs").select("*")
    if active_only:
        q = q.eq("is_active", True)
    return (q.order("created_at", desc=True).execute()).data or []


def add_admin_job(
    title_ar: str,
    title_en: str = "",
    description_ar: str = "",
    description_en: str = "",
    company: str = "",
    link_url: str = "",
    application_email: str = "",
    specializations: str = "",
) -> dict:
    row = {
        "title_ar": title_ar,
        "title_en": title_en or None,
        "description_ar": description_ar or None,
        "description_en": description_en or None,
        "company": company or None,
        "link_url": link_url or None,
        "application_email": application_email or None,
        "specializations": specializations or None,
        "is_active": True,
    }
    if _use_rest:
        out = _rest_insert("admin_jobs", row)
        return out[0] if out else {}
    sb = get_supabase()
    r = sb.table("admin_jobs").insert(row).execute()
    return r.data[0] if r.data else {}


def deactivate_admin_job(job_id: str) -> None:
    """إخفاء الوظيفة من القائمة دون حذف الصف (مطلوب عند وجود تقديمات مرتبطة بـ job_id)."""
    if _use_rest:
        _rest_update("admin_jobs", {"is_active": False}, id=job_id)
        return
    get_supabase().table("admin_jobs").update({"is_active": False}).eq("id", job_id).execute()


def delete_admin_job(job_id: str) -> str:
    """
    حذف نهائي من القاعدة. إن رفضت القاعدة الحذف (409 — تقديمات مرتبطة)، تُعطّل الوظيفة فقط.
    يعيد: 'deleted' أو 'deactivated'.
    """
    try:
        if _use_rest:
            _rest_delete("admin_jobs", id=job_id)
        else:
            get_supabase().table("admin_jobs").delete().eq("id", job_id).execute()
        return "deleted"
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 409:
            deactivate_admin_job(job_id)
            return "deactivated"
        raise
    except Exception as e:
        err = str(e).lower()
        if "409" in err or "conflict" in err:
            deactivate_admin_job(job_id)
            return "deactivated"
        raise


def get_admin_announcements(active_only: bool = True, only_visible: bool = True) -> list:
    """only_visible: استبعاد الإعلانات المنتهية (expires_at < now)."""
    now_iso = datetime.utcnow().isoformat() + "Z"
    if _use_rest:
        rows = _rest_select_all("admin_announcements", is_active=True) if active_only else _rest_select_all("admin_announcements")
        if only_visible:
            rows = [r for r in rows if r.get("expires_at") is None or (r.get("expires_at") or "") > now_iso]
        return rows
    sb = get_supabase()
    q = sb.table("admin_announcements").select("*")
    if active_only:
        q = q.eq("is_active", True)
    data = (q.order("created_at", desc=True).execute()).data or []
    if only_visible:
        data = [r for r in data if r.get("expires_at") is None or (r.get("expires_at") or "") > now_iso]
    return data


def add_admin_announcement(
    title: str,
    body_text: str,
    image_file_id: str | None = None,
    expires_at: datetime | None = None,
    repeat_count: int = 1,
) -> dict:
    repeat_count = max(1, min(int(repeat_count or 1), 10))
    row = {
        "title": title or None,
        "body_text": body_text,
        "image_file_id": image_file_id,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "repeat_count": repeat_count,
        "is_active": True,
    }
    if _use_rest:
        out = _rest_insert("admin_announcements", row)
        return out[0] if out else {}
    sb = get_supabase()
    r = sb.table("admin_announcements").insert(row).execute()
    return r.data[0] if r.data else {}


def get_applications_count_today(user_id: str) -> int:
    """عدد التقديمات التي قدمها المستخدم اليوم (لتطبيق حد 10 يومياً)."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)
    today_start_iso = today_start.isoformat() + "Z"
    tomorrow_start_iso = tomorrow_start.isoformat() + "Z"
    if _use_rest:
        rows = _rest_select_columns("applications", "id,applied_at", user_id=user_id, limit=500)
        return sum(1 for r in rows if (r.get("applied_at") or "") >= today_start_iso and (r.get("applied_at") or "") < tomorrow_start_iso)
    sb = get_supabase()
    r = sb.table("applications").select("id", count="exact", head=True).eq("user_id", user_id).gte("applied_at", today_start_iso).lt("applied_at", tomorrow_start_iso).execute()
    return getattr(r, "count", None) or 0


def delete_admin_announcement(ann_id: str) -> None:
    if _use_rest:
        _rest_delete("admin_announcements", id=ann_id)
        return
    get_supabase().table("admin_announcements").delete().eq("id", ann_id).execute()


def get_announcement_delivery(announcement_id: str, user_id: str) -> dict | None:
    if _use_rest:
        return _rest_select_one("admin_announcement_deliveries", announcement_id=announcement_id, user_id=user_id)
    sb = get_supabase()
    r = sb.table("admin_announcement_deliveries").select("*").eq("announcement_id", announcement_id).eq("user_id", user_id).execute()
    return r.data[0] if r.data else None


def upsert_announcement_delivery(announcement_id: str, user_id: str, send_count: int) -> None:
    payload = {
        "announcement_id": announcement_id,
        "user_id": user_id,
        "send_count": int(send_count),
        "last_sent_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    if _use_rest:
        _rest_upsert_merge("admin_announcement_deliveries", payload, on_conflict="announcement_id,user_id")
        return
    sb = get_supabase()
    sb.table("admin_announcement_deliveries").upsert(payload, on_conflict="announcement_id,user_id").execute()


def is_admin(telegram_id: int) -> bool:
    import config
    if config.ADMIN_TELEGRAM_IDS and telegram_id in config.ADMIN_TELEGRAM_IDS:
        return True
    if _use_rest:
        row = _rest_select_one("admin_users", telegram_id=telegram_id)
        return row is not None
    sb = get_supabase()
    r = sb.table("admin_users").select("id").eq("telegram_id", telegram_id).execute()
    return bool(r.data and len(r.data) > 0)


# ─── إحصائيات لوحة تحكم الأدمن ───

def admin_stats_users_count() -> int:
    if _use_rest:
        return _rest_count("users")
    r = get_supabase().table("users").select("*", count="exact", head=True).execute()
    return getattr(r, "count", None) or 0


def admin_stats_applications_total() -> int:
    if _use_rest:
        return _rest_count("applications")
    r = get_supabase().table("applications").select("*", count="exact", head=True).execute()
    return getattr(r, "count", None) or 0


def admin_stats_applications_today() -> int:
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_iso = today_start.isoformat() + "Z"
    tomorrow = today_start + timedelta(days=1)
    tomorrow_iso = tomorrow.isoformat() + "Z"
    if _use_rest:
        rows = _rest_select_columns("applications", "id,applied_at", limit=2000)
        return sum(1 for r in rows if (r.get("applied_at") or "") >= today_start_iso and (r.get("applied_at") or "") < tomorrow_iso)
    r = get_supabase().table("applications").select("id", count="exact", head=True).gte("applied_at", today_start_iso).lt("applied_at", tomorrow_iso).execute()
    return getattr(r, "count", None) or 0


def admin_stats_applications_recent(limit: int = 15) -> list:
    """آخر التقديمات: [{user_id, job_title, applied_at}, ...]"""
    if _use_rest:
        return _rest_select_columns("applications", "user_id,job_title,applied_at", order="applied_at.desc", limit=limit)
    r = get_supabase().table("applications").select("user_id, job_title, applied_at").order("applied_at", desc=True).limit(limit).execute()
    return r.data or []


def admin_stats_jobs_applied_count() -> int:
    """عدد الوظائف (المميزة) التي تم التقديم عليها (عدد job_id مختلف)."""
    if _use_rest:
        rows = _rest_select_columns("applications", "job_id", limit=5000)
        return len(set(r["job_id"] for r in rows if r.get("job_id")))
    r = get_supabase().table("applications").select("job_id").execute()
    return len(set(x["job_id"] for x in (r.data or []) if x.get("job_id")))


def admin_stats_activation_codes_used() -> int:
    if _use_rest:
        return _rest_count("activation_codes", used=True)
    r = get_supabase().table("activation_codes").select("*", count="exact", head=True).eq("used", True).execute()
    return getattr(r, "count", None) or 0


def admin_stats_activation_codes_unused() -> int:
    if _use_rest:
        return _rest_count("activation_codes", used=False)
    r = get_supabase().table("activation_codes").select("*", count="exact", head=True).eq("used", False).execute()
    return getattr(r, "count", None) or 0


def admin_list_users(limit: int = 50) -> list:
    """قائمة المشتركين (للوحة الأدمن)."""
    if _use_rest:
        return _rest_select_all("users", order="created_at.desc", limit=limit)
    r = get_supabase().table("users").select("*").order("created_at", desc=True).limit(limit).execute()
    return r.data or []


def admin_get_user_settings(user_id: str) -> dict | None:
    """جلب إعدادات مستخدم محدد (للوحة الأدمن)."""
    if _use_rest:
        return _rest_select_one("user_settings", user_id=user_id)
    r = get_supabase().table("user_settings").select("*").eq("user_id", user_id).execute()
    return r.data[0] if r.data else None


def admin_update_user_email(user_id: str, email: str) -> None:
    """
    تحديث إيميل المستخدم من لوحة الأدمن مباشرة (بدون حد التغيير للمستخدم).
    مفيد للدعم/التصحيح.
    """
    email = (email or "").strip()
    if not email or "@" not in email:
        raise ValueError("إيميل غير صالح.")
    payload = {
        "email": email,
        "updated_at": datetime.utcnow().isoformat(),
    }
    if _use_rest:
        row = _rest_select_one("user_settings", user_id=user_id)
        if row:
            _rest_update("user_settings", payload, user_id=user_id)
        else:
            _rest_insert("user_settings", {"user_id": user_id, **payload})
        return
    sb = get_supabase()
    r = sb.table("user_settings").select("id").eq("user_id", user_id).execute()
    if r.data:
        sb.table("user_settings").update(payload).eq("user_id", user_id).execute()
    else:
        sb.table("user_settings").insert({"user_id": user_id, **payload}).execute()


def delete_user_completely(user_id: str) -> bool:
    """
    حذف المستخدم وكل بياناته من قاعدة البيانات والتخزين:
    - السيرة الذاتية من Storage إن وُجدت
    - إعدادات المستخدم، السير الذاتية، التفضيلات، التقديمات (CASCADE)
    - سجل ربط كود التفعيل (تحرير الكود إن أردت)
    - المستخدم نفسه
    """
    user = get_user_by_id(user_id)
    if not user:
        return False
    telegram_id = user.get("telegram_id")
    # حذف ملف السيرة من Supabase Storage إن وُجد
    cv = get_cv(user_id)
    if cv and cv.get("storage_path"):
        try:
            from database.storage import delete_object, BUCKET_CVS
            delete_object(BUCKET_CVS, cv["storage_path"])
        except Exception:
            pass
    # تحرير كود التفعيل المرتبط بهذا المستخدم (يعود غير مستعمل بعد الحذف)
    code_id = user.get("activation_code_id")
    if code_id:
        code_id = str(code_id)
        if _use_rest:
            try:
                _rest_update(
                    "activation_codes",
                    {"used": False, "used_at": None, "used_by_user_id": None},
                    id=code_id,
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning("تحرير كود التفعيل عند حذف المستخدم: %s", e)
        else:
            try:
                get_supabase().table("activation_codes").update(
                    {"used": False, "used_at": None, "used_by_user_id": None}
                ).eq("id", code_id).execute()
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning("تحرير كود التفعيل عند حذف المستخدم: %s", e)
    # حذف المستخدم (CASCADE يحذف user_settings, user_cvs, user_job_preferences, applications)
    if _use_rest:
        _rest_delete("users", id=user_id)
    else:
        get_supabase().table("users").delete().eq("id", user_id).execute()
    if telegram_id is not None:
        invalidate_user_cache(int(telegram_id))
    return True


def admin_list_activation_codes_unused(limit: int = 30) -> list:
    """أكواد غير مستخدمة (عينة)."""
    if _use_rest:
        return _rest_select_all("activation_codes", order="created_at.desc", limit=limit, used=False)
    r = get_supabase().table("activation_codes").select("*").eq("used", False).order("created_at", desc=True).limit(limit).execute()
    return r.data or []


def admin_list_activation_codes_used(limit: int = 20) -> list:
    """أكواد مستخدمة (آخرها)."""
    if _use_rest:
        return _rest_select_all("activation_codes", order="used_at.desc", limit=limit, used=True)
    r = get_supabase().table("activation_codes").select("*").eq("used", True).order("used_at", desc=True).limit(limit).execute()
    return r.data or []


if _use_rest:
    def get_supabase():
        raise RuntimeError("Supabase يعمل عبر REST؛ استخدم دوال db مباشرة.")
else:
    pass  # get_supabase معرّف في البلوك else أعلاه
