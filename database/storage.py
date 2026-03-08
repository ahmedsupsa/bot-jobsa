# -*- coding: utf-8 -*-
"""
رفع الملفات إلى Supabase Storage (مثل السير الذاتية).
- أنشئ bucket باسم "cvs" من: Supabase → Storage → New bucket
- أضف سياسة (Policy) للسماح بالرفع: Storage → cvs → Policies → New policy
  أو نفّذ في SQL Editor:
  INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', false) ON CONFLICT (id) DO NOTHING;
  CREATE POLICY "Allow uploads to cvs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cvs');
  CREATE POLICY "Allow read cvs" ON storage.objects FOR SELECT USING (bucket_id = 'cvs');
"""
import logging
import os
import uuid
from typing import Optional
from urllib.parse import quote
import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

BUCKET_CVS = "cvs"
_STORAGE_CLIENT: Optional[httpx.Client] = None


def _get_storage_client() -> httpx.Client:
    global _STORAGE_CLIENT
    if _STORAGE_CLIENT is not None:
        return _STORAGE_CLIENT
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_KEY", "")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY required")
    _STORAGE_CLIENT = httpx.Client(
        base_url=f"{url}/storage/v1",
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
        },
        timeout=60.0,
    )
    return _STORAGE_CLIENT


def _content_type_from_filename(filename: str) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return "application/pdf"
    if name.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if name.endswith(".png"):
        return "image/png"
    if name.endswith(".doc"):
        return "application/msword"
    if name.endswith(".docx"):
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return "application/octet-stream"


def upload_cv(user_id: str, file_bytes: bytes, file_name: str) -> str:
    """
    يرفع ملف السيرة الذاتية إلى bucket "cvs".
    يرجع المسار المحفوظ (مثل user_id/filename_uuid).
    """
    client = _get_storage_client()
    ext = os.path.splitext(file_name)[1] or ".bin"
    unique_name = f"{uuid.uuid4().hex[:12]}{ext}"
    path = f"{user_id}/{unique_name}"
    # ترميز المسار للـ URL (الـ UUID والامتداد آمنان لكن نضمن عدم كسر الطلب)
    path_encoded = "/".join(quote(segment, safe="") for segment in path.split("/"))
    content_type = _content_type_from_filename(file_name)
    url_path = f"/object/{BUCKET_CVS}/{path_encoded}"
    r = client.post(
        url_path,
        content=file_bytes,
        headers={"Content-Type": content_type},
    )
    if r.status_code not in (200, 201):
        err_msg = f"فشل رفع الملف إلى التخزين: {r.status_code} {r.text}"
        logger.warning("Storage upload failed: %s", err_msg)
        raise RuntimeError(err_msg)
    return path


def get_cv_public_url(storage_path: str) -> str:
    """رابط التحميل العام (يعمل إذا كان الـ bucket عاماً)."""
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    return f"{url}/storage/v1/object/public/{BUCKET_CVS}/{storage_path}"


def ensure_bucket_exists() -> bool:
    """يتحقق من وجود bucket أو يحاول إنشاءه (قد يتطلب صلاحيات)."""
    client = _get_storage_client()
    r = client.post("/bucket", json={"name": BUCKET_CVS, "public": False})
    if r.status_code in (200, 201):
        return True
    if r.status_code == 409:
        return True
    return False
