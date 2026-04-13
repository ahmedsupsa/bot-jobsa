# -*- coding: utf-8 -*-
"""
بوابة المستخدمين — Flask Blueprint
مسار الـ API: /api/portal/*
"""
import os
import datetime
import logging

import jwt
from flask import Blueprint, request, jsonify

portal_bp = Blueprint("portal", __name__, url_prefix="/api/portal")
logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 30


def _secret() -> str:
    return os.getenv("ADMIN_SECRET", "change-me")


def _make_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=JWT_EXPIRY_DAYS),
        "iat": datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except Exception:
        return None


def _get_current_user_id() -> str | None:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else auth
    if not token:
        return None
    data = _decode_token(token)
    return data.get("user_id") if data else None


def _require_auth():
    uid = _get_current_user_id()
    if not uid:
        return None, jsonify({"error": "غير مخوّل"}), 401
    return uid, None, None


# ─── تسجيل الدخول ────────────────────────────────────────────────────────────

@portal_bp.route("/login", methods=["POST"])
def portal_login():
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    if not code:
        return jsonify({"error": "أدخل كود التفعيل"}), 400

    from database.db import get_activation_code_any
    try:
        code_row = get_activation_code_any(code)
    except Exception as e:
        logger.exception("DB error on login: %s", e)
        return jsonify({"error": "خطأ في الاتصال بقاعدة البيانات"}), 500

    if not code_row:
        return jsonify({"error": "كود التفعيل غير صحيح"}), 400

    if code_row.get("used") and code_row.get("used_by_user_id"):
        user_id = str(code_row["used_by_user_id"])
        token = _make_token(user_id)
        return jsonify({"status": "ok", "token": token, "user_id": user_id})

    if not code_row.get("used"):
        return jsonify({
            "status": "needs_registration",
            "code_id": str(code_row["id"]),
            "subscription_days": code_row.get("subscription_days", 30),
        })

    return jsonify({"error": "كود التفعيل غير صالح"}), 400


# ─── تسجيل مستخدم جديد (عبر الويب) ──────────────────────────────────────────

@portal_bp.route("/register", methods=["POST"])
def portal_register():
    data = request.get_json(silent=True) or {}
    code_id = (data.get("code_id") or "").strip()
    full_name = (data.get("full_name") or "").strip()
    phone = (data.get("phone") or "").strip()
    city = (data.get("city") or "").strip()
    age_raw = data.get("age")

    if not all([code_id, full_name, phone, city]):
        return jsonify({"error": "جميع الحقول مطلوبة"}), 400

    age = None
    if age_raw:
        try:
            age = int(age_raw)
        except Exception:
            pass

    from database.db import get_activation_code_by_id, create_user
    try:
        code_row = get_activation_code_by_id(code_id)
    except Exception as e:
        logger.exception("DB error: %s", e)
        return jsonify({"error": "خطأ في الاتصال"}), 500

    if not code_row or code_row.get("used"):
        return jsonify({"error": "كود التفعيل غير صالح أو مستخدم مسبقاً"}), 400

    subscription_days = code_row.get("subscription_days", 30)

    try:
        user = create_user(
            telegram_id=0,
            code_id=code_id,
            subscription_days=subscription_days,
            full_name=full_name,
            phone=phone,
            age=age,
            city=city,
        )
        user_id = str(user["id"])
        token = _make_token(user_id)
        return jsonify({"status": "ok", "token": token, "user_id": user_id})
    except Exception as e:
        logger.exception("create_user failed: %s", e)
        return jsonify({"error": "فشل إنشاء الحساب، يرجى المحاولة لاحقاً"}), 500


# ─── بيانات المستخدم ─────────────────────────────────────────────────────────

@portal_bp.route("/me", methods=["GET"])
def portal_me():
    uid, err, code = _require_auth()
    if err:
        return err, code

    import datetime as dt
    from database.db import (
        get_user_by_id, get_or_create_user_settings,
        is_subscription_active, get_subscription_ends_at, get_applications_count,
    )

    user = get_user_by_id(uid)
    if not user:
        return jsonify({"error": "المستخدم غير موجود"}), 404

    settings = get_or_create_user_settings(uid)
    active = is_subscription_active(user)
    ends_at = get_subscription_ends_at(user)
    apps_count = get_applications_count(uid)

    days_left = 0
    if ends_at:
        try:
            end_dt = dt.datetime.fromisoformat(ends_at.replace("Z", "+00:00"))
            now = dt.datetime.now(dt.timezone.utc)
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=dt.timezone.utc)
            days_left = max(0, (end_dt - now).days)
        except Exception:
            pass

    return jsonify({
        "id": uid,
        "full_name": user.get("full_name") or "",
        "phone": user.get("phone") or "",
        "age": user.get("age"),
        "city": user.get("city") or "",
        "subscription_active": active,
        "subscription_ends_at": ends_at,
        "days_left": days_left,
        "email": settings.get("email") or "",
        "sender_email_alias": settings.get("sender_email_alias") or "",
        "applications_count": apps_count,
    })


# ─── التقديمات ───────────────────────────────────────────────────────────────

@portal_bp.route("/applications", methods=["GET"])
def portal_applications():
    uid, err, code = _require_auth()
    if err:
        return err, code

    from database.db import get_applications_log, get_applications_count
    log = get_applications_log(uid, limit=100)
    count = get_applications_count(uid)
    return jsonify({"count": count, "applications": log})


# ─── السيرة الذاتية ──────────────────────────────────────────────────────────

@portal_bp.route("/cv", methods=["GET"])
def portal_cv_get():
    uid, err, code = _require_auth()
    if err:
        return err, code

    from database.db import get_cv
    cv = get_cv(uid)
    if not cv:
        return jsonify({"has_cv": False})
    return jsonify({
        "has_cv": True,
        "file_name": cv.get("file_name") or "cv.pdf",
        "storage_path": cv.get("storage_path") or "",
        "updated_at": cv.get("updated_at") or cv.get("created_at") or "",
    })


@portal_bp.route("/cv/upload", methods=["POST"])
def portal_cv_upload():
    uid, err, code = _require_auth()
    if err:
        return err, code

    if "file" not in request.files:
        return jsonify({"error": "لم يتم إرفاق ملف"}), 400

    f = request.files["file"]
    file_name = f.filename or "cv.pdf"
    file_bytes = f.read()

    if len(file_bytes) > 10 * 1024 * 1024:
        return jsonify({"error": "حجم الملف كبير جداً (الحد الأقصى 10 ميغابايت)"}), 400

    ext = os.path.splitext(file_name)[1].lower()
    if ext not in [".pdf", ".jpg", ".jpeg", ".png"]:
        return jsonify({"error": "نوع الملف غير مدعوم (PDF أو صورة فقط)"}), 400

    from database.db import save_cv
    storage_path = None
    try:
        from database.storage import upload_cv
        storage_path = upload_cv(uid, file_bytes, file_name)
    except Exception as e:
        logger.warning("Storage upload failed: %s", e)

    save_cv(uid, file_id="web_upload", file_name=file_name, storage_path=storage_path)
    return jsonify({"status": "ok", "file_name": file_name})


@portal_bp.route("/cv/delete", methods=["DELETE"])
def portal_cv_delete():
    uid, err, code = _require_auth()
    if err:
        return err, code

    from database.db import delete_cv
    delete_cv(uid, delete_storage_file=True)
    return jsonify({"status": "ok"})


# ─── الإعدادات ───────────────────────────────────────────────────────────────

@portal_bp.route("/settings", methods=["GET"])
def portal_settings():
    uid, err, code = _require_auth()
    if err:
        return err, code

    from database.db import get_or_create_user_settings, get_user_job_preferences
    settings = get_or_create_user_settings(uid)
    prefs = get_user_job_preferences(uid)
    return jsonify({
        "email": settings.get("email") or "",
        "sender_email_alias": settings.get("sender_email_alias") or "",
        "template_type": settings.get("template_type") or "default",
        "application_language": settings.get("application_language") or "ar",
        "job_preferences_count": len(prefs),
    })


@portal_bp.route("/settings/email", methods=["POST"])
def portal_save_email():
    uid, err, code = _require_auth()
    if err:
        return err, code

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return jsonify({"error": "أدخل إيميلاً صحيحاً"}), 400

    from database.db import save_user_email, ensure_user_sender_alias
    save_user_email(uid, email)
    alias = ""
    try:
        alias = ensure_user_sender_alias(uid, email)
    except Exception as e:
        logger.warning("alias creation failed: %s", e)

    return jsonify({"status": "ok", "sender_alias": alias})
