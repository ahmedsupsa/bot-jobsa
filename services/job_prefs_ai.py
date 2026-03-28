# -*- coding: utf-8 -*-
"""
اقتراح تفضيلات المجالات الوظيفية من نص السيرة الذاتية.
- يستخدم Gemini إن توفر المفتاح.
- fallback بالكلمات المفتاحية عند عدم توفر Gemini أو فشل الطلب.
"""
from __future__ import annotations

import json
import logging
import os
import re

logger = logging.getLogger(__name__)

# حد أعلى لعدد المجالات المختارة (يمكن أن تتجاوز 20 حسب السيرة والقائمة)
_MAX_PREFS_CAP = 120


def _gemini_api_key() -> str:
    try:
        from config import GEMINI_API_KEY

        return (GEMINI_API_KEY or "").strip()
    except Exception:
        return os.getenv("GEMINI_API_KEY", "").strip()


def _normalize(text: str) -> str:
    return (text or "").strip().lower()


def _build_field_blob(fields: list[dict]) -> str:
    rows = []
    for f in fields:
        fid = str(f.get("id") or "").strip()
        if not fid:
            continue
        ar = (f.get("name_ar") or "").strip()
        en = (f.get("name_en") or "").strip()
        cat = (f.get("category") or "").strip()
        rows.append({"id": fid, "name_ar": ar, "name_en": en, "category": cat})
    return json.dumps(rows, ensure_ascii=False)


def _effective_cap(fields: list[dict], max_items: int | None) -> int:
    n = len(fields)
    if n <= 0:
        return 0
    if max_items is not None and max_items > 0:
        return min(max_items, n)
    return min(_MAX_PREFS_CAP, n)


def _fallback_suggest(cv_text: str, fields: list[dict], max_items: int) -> list[str]:
    t = _normalize(cv_text)
    if not t:
        return []

    selected: list[str] = []
    for f in fields:
        fid = str(f.get("id") or "").strip()
        if not fid:
            continue
        n_ar = _normalize(f.get("name_ar") or "")
        n_en = _normalize(f.get("name_en") or "")
        if n_ar and n_ar in t:
            selected.append(fid)
            continue
        if n_en and n_en in t:
            selected.append(fid)
            continue
        tokens = re.split(r"\s+", n_ar or n_en)
        tokens = [x for x in tokens if len(x) >= 4]
        if tokens and any(tok in t for tok in tokens[:3]):
            selected.append(fid)

    uniq: list[str] = []
    seen: set[str] = set()
    for fid in selected:
        if fid in seen:
            continue
        seen.add(fid)
        uniq.append(fid)
    return uniq[:max_items]


def suggest_job_field_ids_from_cv(
    cv_text: str, fields: list[dict], max_items: int | None = None,
) -> list[str]:
    cv_text = (cv_text or "").strip()
    if not cv_text or not fields:
        return []

    cap = _effective_cap(fields, max_items)
    if cap <= 0:
        return []

    api_key = _gemini_api_key()
    if not api_key:
        return _fallback_suggest(cv_text, fields, max_items=cap)

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        try:
            from config import GEMINI_MODEL_FLASH as _gm
        except ImportError:
            _gm = "gemini-2.5-flash"
        model = genai.GenerativeModel((_gm or "").strip() or "gemini-2.5-flash")
        fields_blob = _build_field_blob(fields)
        prompt = f"""أنت مساعد توظيف.
حلّل نص السيرة الذاتية ثم اختر **كل** المجالات الوظيفية المنطبقة من القائمة المتاحة فقط (حتى {cap} مجالاً كحد أقصى).

أعد JSON فقط بالمفتاح:
selected_ids: string[]

قواعد:
- لا تختر إلا من ids الموجودة في القائمة.
- اختر كل المجالات ذات الصلة بمهارات وخبرات وتعليم السيرة (لا تقتصر على مجال واحد إن وُجد عدة تخصصات).
- لا تتجاوز {cap} معرفاً في المصفوفة.
- لا تكتب أي نص خارج JSON.

القائمة المتاحة:
{fields_blob}

نص السيرة:
---
{cv_text[:7000]}
---
"""
        out = (model.generate_content(prompt).text or "").strip()
        out = re.sub(r"^```(?:json)?\s*", "", out, flags=re.I)
        out = re.sub(r"\s*```$", "", out)
        data = json.loads(out)
        raw = data.get("selected_ids") or []
        valid_ids = {str(f.get("id")) for f in fields if f.get("id")}
        selected: list[str] = []
        for x in raw:
            sid = str(x).strip()
            if sid and sid in valid_ids and sid not in selected:
                selected.append(sid)
        if selected:
            return selected[:cap]
    except Exception as e:
        logger.warning("AI job preferences suggestion failed, fallback used: %s", e)

    return _fallback_suggest(cv_text, fields, max_items=cap)


def apply_preferences_from_cv_text(user_id: str, cv_text: str) -> list[str]:
    """يحلّل السيرة ويحدّث جدول تفضيلات المستخدم. يعيد قائمة معرفات المجالات المحفوظة."""
    from database.db import get_job_fields, set_user_job_preferences

    uid = str(user_id)
    fields = get_job_fields()
    if not fields:
        return []
    cv_text = (cv_text or "").strip()
    if len(cv_text) < 80:
        return []
    cap = _effective_cap(fields, None)
    ids = suggest_job_field_ids_from_cv(cv_text, fields, max_items=cap)
    if ids:
        set_user_job_preferences(uid, ids)
    return ids
