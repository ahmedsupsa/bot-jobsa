# -*- coding: utf-8 -*-
import os
import time
from datetime import datetime, timedelta

from dotenv import load_dotenv

load_dotenv()

# تخزين مؤقت للمستخدم (تقليل استدعاءات Supabase)
_USER_CACHE: dict[int, tuple[dict, float]] = {}
_USER_CACHE_TTL = 90  # ثانية


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
        rows = _rest_insert("user_settings", {"user_id": user_id})
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


def save_user_email_password(user_id: str, email: str, app_password: str) -> None:
    get_or_create_user_settings(user_id)
    update_user_settings(user_id, email=email, app_password_encrypted=app_password)


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


def delete_admin_job(job_id: str) -> None:
    if _use_rest:
        _rest_delete("admin_jobs", id=job_id)
        return
    get_supabase().table("admin_jobs").delete().eq("id", job_id).execute()


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
) -> dict:
    row = {
        "title": title or None,
        "body_text": body_text,
        "image_file_id": image_file_id,
        "expires_at": expires_at.isoformat() if expires_at else None,
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


if _use_rest:
    def get_supabase():
        raise RuntimeError("Supabase يعمل عبر REST؛ استخدم دوال db مباشرة.")
else:
    pass  # get_supabase معرّف في البلوك else أعلاه
