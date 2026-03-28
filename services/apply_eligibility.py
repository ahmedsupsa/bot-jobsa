# -*- coding: utf-8 -*-
"""
تقديم ذكي: مطابقة الجنس بين السيرة والإعلان (وظائف للنساء/للرجال).
"""
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)


def _gemini_api_key() -> str:
    try:
        from config import GEMINI_API_KEY

        return (GEMINI_API_KEY or "").strip()
    except Exception:
        import os

        return os.getenv("GEMINI_API_KEY", "").strip()


def infer_job_gender_requirement(job: dict) -> str | None:
    """
    يحدد إن كان الإعلان يخصّ جنساً معيّناً.

    - صيغ مؤنثة في المسمى (مثل أخصائية، موظفة، مهندسة) → للنساء.
    - صيغ مذكرة واضحة (مثل أخصائي، مهندس، ممرض) → للرجال (مع استبعاد ما يدخل في صيغة مؤنثى).
    - «مطلوب موظف» دون ذيل بعد «موظف» → عام؛ «مطلوب موظف خدمة عملاء» → مذكر صريح.
    - «وظيفة خدمة عملاء» ونحوها بلا تأنيث/تذكير → للجميع.
    - عبارات صريحة (للنساء، women only، …).
    """
    parts = [
        str(job.get("title_ar") or ""),
        str(job.get("title_en") or ""),
        str(job.get("description_ar") or ""),
        str(job.get("description_en") or ""),
        str(job.get("specializations") or ""),
    ]
    t = "\n".join(parts)
    t_compact = re.sub(r"\s+", " ", t).strip()
    blob = t_compact.lower()
    joined = " ".join(parts)

    female_explicit = (
        "للنساء فقط",
        "نساء فقط",
        "للنساء",
        "بنات فقط",
        "للطالبات",
        "طالبات فقط",
        "وظيفة نسائية",
        "عنصر نسائي",
        "خدمة نسائية",
        "موظفات فقط",
        "مطلوب موظفات",
        "مطلوبة موظفات",
    )
    male_explicit = (
        "للرجال فقط",
        "رجال فقط",
        "للرجال",
        "للذكور",
        "ذكور فقط",
        "موظفين رجال",
    )
    female_en = (
        "women only",
        "female only",
        "for women",
        "ladies only",
        "female candidates",
        "women candidates",
    )
    male_en = ("men only", "male only", "for men", "male candidates", "men candidates")

    f_explicit = any(p in joined for p in female_explicit) or any(p in blob for p in female_en)
    m_explicit = any(p in joined for p in male_explicit) or any(p in blob for p in male_en)

    # مؤنث صريح في المسمى/النص (يشمل أخصائية، موظفة، …)
    fem_title_rx = re.compile(
        r"(أخصائية|مهندسة|طبيبة|طبيبة\s+أسنان|ممرضة|موظفة|معلمة|محاسبة|سكرتيرة|مديرة|مشرفة|محامية|بائعة|مستشارة)\b",
    )
    f_morph = bool(fem_title_rx.search(t))

    # مذكر من مسمى مهني؛ لا نطابق «مهندس» داخل «مهندسة» أو «موظف» داخل «موظفة»
    m_morph = False
    if re.search(r"\bأخصائي\b", t) and "أخصائية" not in t:
        m_morph = True
    if "مهندسة" not in t and re.search(r"\bمهندس\b", t):
        m_morph = True
    if "طبيبة" not in t and re.search(r"\bطبيب\b", t):
        m_morph = True
    if "ممرضة" not in t and re.search(r"\bممرض\b", t):
        m_morph = True
    if "معلمة" not in t and re.search(r"\bمعلم\b", t):
        m_morph = True

    # «مطلوب موظف خدمة» → مذكر صريح؛ «مطلوب موظف» أو «مطلوب موظف.» → عام (لا يُشترط حرف بعد موظف)
    if "موظفة" not in t and re.search(
        r"(?:مطلوب|نبحث عن|نبحث)\s+(?:عن\s+)?موظف\s+[\u0600-\u06FFa-zA-Z]",
        t_compact,
    ):
        m_morph = True

    f_hit = f_explicit or f_morph
    m_hit = m_explicit or m_morph

    if f_hit and m_hit:
        return None
    if f_hit:
        return "female_only"
    if m_hit:
        return "male_only"
    return None


def _heuristic_cv_gender(cv_text: str) -> str:
    """female | male | unknown من حقول صريحة أو لقب إنجليزي في مقدمة السيرة."""
    t = (cv_text or "").strip()
    if len(t) < 20:
        return "unknown"
    head = t[:3500]
    tl = head.lower()

    if re.search(r"الجنس\s*[:：]\s*أنثى|الجنس\s*[:：]\s*انثى", head, re.I):
        return "female"
    if re.search(r"الجنس\s*[:：]\s*ذكر\b", head, re.I):
        return "male"
    if re.search(r"gender\s*[:：]\s*female\b", tl, re.I):
        return "female"
    if re.search(r"gender\s*[:：]\s*male\b", tl, re.I):
        return "male"

    first_lines = "\n".join(head.splitlines()[:12]).lower()
    if re.search(r"\b(mrs\.?|miss\b|ms\.?)\b", first_lines):
        return "female"
    if re.search(r"(^|\n)mr\.?\s+", first_lines) and "mrs" not in first_lines[:200]:
        return "male"

    return "unknown"


def _ai_infer_cv_gender(cv_text: str) -> str | None:
    api_key = _gemini_api_key()
    if not api_key or len((cv_text or "").strip()) < 80:
        return None
    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        try:
            from config import GEMINI_MODEL_FLASH as _gm
        except ImportError:
            _gm = "gemini-2.5-flash"
        model = genai.GenerativeModel((_gm or "").strip() or "gemini-2.5-flash")
        prompt = f"""أنت تتحقق من جنس صاحب/ة السيرة الذاتية للتوظيف فقط.

أعد JSON فقط بهذا الشكل:
{{"gender":"female"|"male"|"unknown"}}

قواعد:
- female إذا واضح من الاسم العربي/الإنجليزي، اللقب (Mrs/Ms/Miss)، أو حقل الجنس، أو الصياغة أن المتقدم أنثى.
- male إذا واضح أن المتقدم ذكر (Mr، الجنس ذكر، الاسم الشائع للذكور مع سياق واضح).
- unknown إذا غير مؤكد أو السيرة لا تحتوي ما يكفي.

نص السيرة (مقتطف):
---
{cv_text[:6000]}
---
"""
        out = (model.generate_content(prompt).text or "").strip()
        out = re.sub(r"^```(?:json)?\s*", "", out, flags=re.I)
        out = re.sub(r"\s*```$", "", out)
        data = json.loads(out)
        g = str(data.get("gender") or "").strip().lower()
        if g in ("female", "male", "unknown"):
            return g
    except Exception as e:
        logger.debug("AI CV gender inference failed: %s", e)
    return None


def infer_applicant_gender_from_cv(cv_text: str) -> str:
    """يعيد 'female' أو 'male' أو 'unknown'."""
    h = _heuristic_cv_gender(cv_text)
    if h != "unknown":
        return h
    ai = _ai_infer_cv_gender(cv_text)
    if ai and ai != "unknown":
        return ai
    return "unknown"


def applicant_matches_job_gender(cv_gender: str, job: dict) -> bool:
    """
    يمنع التقديم عند تعارض واضح فقط:
    - وظيفة للنساء + سيرة تُشير صراحة لذكر → لا.
    - وظيفة للرجال + سيرة تُشير صراحة لأنثى → لا.
    إن لم يُستنتج الجنس من السيرة (unknown) لا نحجب (لا نفترض الذكر).
    """
    req = infer_job_gender_requirement(job)
    if not req:
        return True
    g = (cv_gender or "unknown").strip().lower()
    if req == "female_only":
        if g == "male":
            logger.info("تخطي وظيفة للنساء فقط: السيرة تُشير لذكر")
            return False
        return True
    if req == "male_only":
        if g == "female":
            logger.info("تخطي وظيفة للرجال فقط: السيرة تُشير لأنثى")
            return False
        return True
    return True
