# -*- coding: utf-8 -*-
"""
تحقق صلاحية السيرة الذاتية قبل اعتمادها للتقديم.
- يستخدم Gemini إن توفر (تصنيف نص CV صالح/غير صالح)
- مع fallback heuristics عند عدم توفر المفتاح
"""
from __future__ import annotations

import json
import re


def _gemini_api_key() -> str:
    try:
        from config import GEMINI_API_KEY
        return (GEMINI_API_KEY or "").strip()
    except Exception:
        return ""


_BAD_HINTS = (
    "تسريبات",
    "قياس",
    "اختبار التحصيلي",
    "القدرات",
    "نموذج إجابة",
    "ملخص مادة",
    "حلول",
    "الحاسد والاحتطاب",
)

_GOOD_HINTS = (
    "السيرة الذاتية",
    "cv",
    "resume",
    "الخبرات",
    "خبرة",
    "education",
    "skills",
    "experience",
    "المهارات",
    "المؤهلات",
    "الاسم",
    "البريد",
    "الهاتف",
)


def _fallback_validate(text: str) -> tuple[bool, str]:
    t = (text or "").strip().lower()
    if len(t) < 180:
        return False, "نص السيرة قصير جداً أو غير واضح."
    if any(k.lower() in t for k in _BAD_HINTS):
        return False, "المحتوى يبدو غير متعلق بسيرة ذاتية مهنية."
    score = sum(1 for k in _GOOD_HINTS if k in t)
    if score < 2:
        return False, "لم يتم العثور على مؤشرات كافية لكونه CV (خبرات/مهارات/تعليم...)."
    # وجود بريد أو هاتف عادة مؤشر قوي لسيرة
    has_email = bool(re.search(r"[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}", t, re.I))
    has_phone = bool(re.search(r"(?:\+?\d[\d\s\-]{7,}\d)", t))
    if not (has_email or has_phone) and score < 3:
        return False, "لا يظهر أي بيانات تعريف أساسية مثل بريد/هاتف."
    return True, "السيرة الذاتية مقبولة."


def validate_cv_text(text: str) -> tuple[bool, str]:
    t = (text or "").strip()
    if not t:
        return False, "تعذر قراءة محتوى السيرة الذاتية."

    api_key = _gemini_api_key()
    if api_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = f"""صنّف النص التالي:
هل هو "سيرة ذاتية مهنية حقيقية لشخص" أم لا؟

أعد JSON فقط بالمفاتيح:
is_valid (true/false), reason (string)

القواعد:
- إذا كان النص اختبارات/ملخصات/تسريبات/محتوى تعليمي غير CV => is_valid=false
- إذا كان النص CV واضح (بيانات + مهارات/خبرات/تعليم) => is_valid=true
- لا تكتب أي شيء خارج JSON.

النص:
---
{t[:7000]}
---
"""
            out = (model.generate_content(prompt).text or "").strip()
            out = re.sub(r"^```(?:json)?\s*", "", out, flags=re.I)
            out = re.sub(r"\s*```$", "", out)
            data = json.loads(out)
            ok = bool(data.get("is_valid"))
            reason = str(data.get("reason") or "").strip() or ("السيرة الذاتية مقبولة." if ok else "تم رفض الملف.")
            return ok, reason
        except Exception:
            # fallback إن فشل AI لأي سبب
            pass

    return _fallback_validate(t)
