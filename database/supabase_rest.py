# -*- coding: utf-8 -*-
"""
عميل Supabase عبر REST API ليدعم مفاتيح sb_secret_ و sb_publishable_
لأن مكتبة supabase-py تقبل فقط مفاتيح JWT (eyJ...).
"""
import os
import re
from typing import Any, Optional
import httpx
from dotenv import load_dotenv

load_dotenv()

_BASE_URL: Optional[str] = None
_KEY: Optional[str] = None
_CLIENT: Optional[httpx.Client] = None

# مكتبة supabase-py ترفض أي مفتاح ليس بصيغة JWT
JWT_PATTERN = re.compile(r"^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$")


def _is_jwt_key(key: str) -> bool:
    return bool(key and JWT_PATTERN.match(key.strip()))


def _get_client() -> httpx.Client:
    global _CLIENT, _BASE_URL, _KEY
    if _CLIENT is not None:
        return _CLIENT
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_KEY", "")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY required")
    _BASE_URL = f"{url}/rest/v1"
    _KEY = key
    _CLIENT = httpx.Client(
        base_url=_BASE_URL,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        timeout=30.0,
    )
    return _CLIENT


def _req(
    method: str,
    path: str,
    params: Optional[dict] = None,
    json: Optional[dict] = None,
    count_exact: bool = False,
) -> httpx.Response:
    client = _get_client()
    headers = {"Prefer": "count=exact"} if count_exact else None
    return client.request(method, path, params=params or {}, json=json, headers=headers)


def _eq(k: str, v: Any) -> str:
    if v is None:
        return f"{k}=is.null"
    if isinstance(v, bool):
        return f"{k}=eq.{str(v).lower()}"
    # باقي الأنواع (نحو UUID, نصوص, أرقام...) تُرسل كما هي بدون اقتباس إضافي
    s = str(v)
    return f"{k}=eq.{s}"


def select_one(table: str, **filters) -> Optional[dict]:
    parts = ["select=*"]
    for k, v in filters.items():
        parts.append(_eq(k, v))
    q = "&".join(parts)
    r = _req("GET", f"/{table}?{q}")
    if r.status_code != 200:
        r.raise_for_status()
    data = r.json()
    return data[0] if isinstance(data, list) and len(data) > 0 else None


def select_all(table: str, order: Optional[str] = None, limit: Optional[int] = None, **filters) -> list:
    q = "select=*"
    for k, v in filters.items():
        q += "&" + _eq(k, v)
    if order:
        q += f"&order={order}"
    if limit is not None:
        q += f"&limit={limit}"
    r = _req("GET", f"/{table}?{q}")
    if r.status_code != 200:
        r.raise_for_status()
    out = r.json()
    return out if isinstance(out, list) else []


def select_columns(table: str, columns: str, order: Optional[str] = None, limit: Optional[int] = None, **filters) -> list:
    q = f"select={columns}"
    for k, v in filters.items():
        q += "&" + _eq(k, v)
    if order:
        q += f"&order={order}"
    if limit is not None:
        q += f"&limit={limit}"
    r = _req("GET", f"/{table}?{q}")
    if r.status_code != 200:
        r.raise_for_status()
    out = r.json()
    return out if isinstance(out, list) else []


def count(table: str, **filters) -> int:
    q = "select=id"
    for k, v in filters.items():
        q += "&" + _eq(k, v)
    r = _req("GET", f"/{table}?{q}", count_exact=True)
    if r.status_code != 200:
        r.raise_for_status()
    # Content-Range: 0-9/42 يعني 42 سجل
    cr = r.headers.get("content-range") or ""
    if "/" in cr:
        return int(cr.split("/")[1].strip())
    return 0


def insert(table: str, data: dict) -> list:
    r = _req("POST", f"/{table}", json=data)
    if r.status_code not in (200, 201):
        r.raise_for_status()
    out = r.json()
    return out if isinstance(out, list) else [out] if out else []


def insert_many(table: str, rows: list[dict]) -> list:
    """إدراج عدة صفوف دفعة واحدة."""
    if not rows:
        return []
    r = _req("POST", f"/{table}", json=rows)
    if r.status_code not in (200, 201):
        r.raise_for_status()
    out = r.json()
    return out if isinstance(out, list) else []


def update(table: str, data: dict, **filters) -> None:
    q = "&".join(f"{k}=eq.{v}" for k, v in filters.items())
    r = _req("PATCH", f"/{table}?{q}", json=data)
    # PostgREST قد يرجع 204 بدون جسم عند نجاح PATCH
    if r.status_code not in (200, 204):
        r.raise_for_status()


def upsert_merge(table: str, row: dict, on_conflict: str) -> list:
    """
    إدراج أو دمج (تحديث عند التعارض) — مفيد لـ user_settings حتى لا يضيع الحفظ
    إذا كان الصف غير موجود أو التحديث لم يطابق أي صف.
    """
    client = _get_client()
    path = f"/{table}?on_conflict={on_conflict}"
    r = client.post(
        path,
        json=row,
        headers={
            "Prefer": "resolution=merge-duplicates,return=representation",
            "Content-Type": "application/json",
            "apikey": _KEY or "",
            "Authorization": f"Bearer {_KEY}",
        },
    )
    if r.status_code not in (200, 201):
        r.raise_for_status()
    try:
        out = r.json()
    except Exception:
        return []
    if isinstance(out, list):
        return out
    return [out] if out else []


def delete(table: str, **filters) -> None:
    q = "&".join(f"{k}=eq.{v}" for k, v in filters.items())
    r = _req("DELETE", f"/{table}?{q}")
    if r.status_code != 200:
        r.raise_for_status()


def or_filter(column: str, pattern: str) -> str:
    """للبحث: name_ar.ilike.*pattern*,name_en.ilike.*pattern*"""
    return f"or=({column}.ilike.*{pattern}*,{column}.ilike.*{pattern}*)"


def use_rest_api() -> bool:
    """استخدام REST إذا المفتاح ليس JWT (مثل sb_secret_)."""
    key = os.getenv("SUPABASE_KEY", "")
    return bool(key and not _is_jwt_key(key))
