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


def _fallback_suggest(cv_text: str, fields: list[dict], max_items: int = 12) -> list[str]:
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
        # مطابقة بسيطة ومرنة: اسم المجال بالعربي أو الإنجليزي داخل السيرة
        if n_ar and n_ar in t:
            selected.append(fid)
            continue
        if n_en and n_en in t:
            selected.append(fid)
            continue
        # مطابقة جزئية للكلمات الطويلة نسبياً
        tokens = re.split(r"\s+", n_ar or n_en)
        tokens = [x for x in tokens if len(x) >= 4]
        if tokens and any(tok in t for tok in tokens[:3]):
            selected.append(fid)

    # إزالة التكرار مع الحفاظ على الترتيب
    uniq = []
    seen = set()
    for fid in selected:
        if fid in seen:
            continue
        seen.add(fid)
        uniq.append(fid)
    return uniq[:max_items]


def suggest_job_field_ids_from_cv(cv_text: str, fields: list[dict], max_items: int = 12) -> list[str]:
    cv_text = (cv_text or "").strip()
    if not cv_text or not fields:
        return []

    api_key = _gemini_api_key()
    if not api_key:
        return _fallback_suggest(cv_text, fields, max_items=max_items)

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        fields_blob = _build_field_blob(fields)
        prompt = f"""أنت مساعد توظيف.
حلّل نص السيرة الذاتية ثم اختر أنسب المجالات الوظيفية من القائمة المتاحة فقط.

أعد JSON فقط بالمفتاح:
selected_ids: string[]

قواعد:
- لا تختر إلا من ids الموجودة في القائمة.
- اختر المجالات الأقرب فعلياً لمهارات وخبرات السيرة.
- لا تتجاوز {int(max_items)} مجالاً.
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
            return selected[:max_items]
    except Exception as e:
        logger.warning("AI job preferences suggestion failed, fallback used: %s", e)

    return _fallback_suggest(cv_text, fields, max_items=max_items)

