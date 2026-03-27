# -*- coding: utf-8 -*-
"""
استخراج وظيفة أو عدة وظائف من منشور قناة (نص/تعليق) عبر Gemini عند توفر المفتاح،
مع fallback بسيط بدون API.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.I,
)
_URL_RE = re.compile(r"https?://[^\s\]>\"')،]+")


def _gemini_api_key() -> str:
    try:
        from config import GEMINI_API_KEY

        return (GEMINI_API_KEY or "").strip()
    except ImportError:
        import os

        return os.getenv("GEMINI_API_KEY", "").strip()


def _extract_first_url(text: str) -> str:
    m = _URL_RE.search(text or "")
    if not m:
        return ""
    return m.group(0).rstrip(".,);،")


def _strip_code_fence(s: str) -> str:
    s = (s or "").strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.I)
        s = re.sub(r"\s*```\s*$", "", s)
    return s.strip()


def _fallback_parse(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if len(text) < 5:
        return {}
    first_line, _, rest = (text + "\n").partition("\n")
    title_ar = (first_line or text)[:300].strip()
    description_ar = rest.strip()[:4000] if rest else text[:4000]
    emails = _EMAIL_RE.findall(text)
    return {
        "title_ar": title_ar,
        "title_en": "",
        "company": "",
        "city": "",
        "employment_type": "",
        "salary": "",
        "requirements": description_ar,
        "application_email": emails[0] if emails else "",
        "link_url": _extract_first_url(text),
        "specializations": "",
        "summary_ar": description_ar,
        "summary_en": "",
    }


def _coerce_parsed(data: dict[str, Any], raw: str) -> dict[str, Any]:
    fb = _fallback_parse(raw)
    title_ar = str(data.get("title_ar") or "").strip()[:300] or fb.get("title_ar", "")
    title_en = str(data.get("title_en") or "").strip()[:300]
    company = str(data.get("company") or "").strip()[:200]
    city = str(data.get("city") or "").strip()[:160]
    employment_type = str(data.get("employment_type") or "").strip()[:120]
    salary = str(data.get("salary") or "").strip()[:200]
    requirements = str(data.get("requirements") or "").strip()[:4000]
    application_email = str(data.get("application_email") or "").strip()[:320]
    if application_email and not _EMAIL_RE.search(application_email):
        application_email = ""
    if not application_email:
        application_email = fb.get("application_email", "") or ""
    link_url = str(data.get("link_url") or "").strip()[:2000]
    if link_url and not link_url.startswith("http"):
        link_url = ""
    if not link_url:
        link_url = fb.get("link_url", "") or ""
    specializations = str(data.get("specializations") or "").strip()[:1000]
    summary_ar = str(data.get("summary_ar") or "").strip()[:4000]
    summary_en = str(data.get("summary_en") or "").strip()[:4000]
    if not summary_ar:
        summary_ar = fb.get("summary_ar", "") or (raw or "").strip()[:4000]
    if not requirements:
        requirements = summary_ar
    if not title_ar:
        title_ar = (raw or "").strip()[:300] or "وظيفة"
    return {
        "title_ar": title_ar,
        "title_en": title_en,
        "company": company,
        "city": city,
        "employment_type": employment_type,
        "salary": salary,
        "requirements": requirements,
        "application_email": application_email,
        "link_url": link_url,
        "specializations": specializations,
        "summary_ar": summary_ar,
        "summary_en": summary_en,
    }


def _single_from_merged(merged: dict[str, Any]) -> dict[str, str]:
    return {
        "title_ar": merged["title_ar"],
        "title_en": merged["title_en"],
        "description_ar": merged["summary_ar"],
        "description_en": merged["summary_en"],
        "company": merged["company"],
        "city": merged.get("city", ""),
        "employment_type": merged.get("employment_type", ""),
        "salary": merged.get("salary", ""),
        "requirements": merged.get("requirements", ""),
        "link_url": merged["link_url"],
        "application_email": merged["application_email"],
        "specializations": merged["specializations"],
    }


def parse_job_posts_text(raw_text: str) -> list[dict[str, str]]:
    """
    يعيد قائمة وظائف جاهزة للإدراج/النشر الموحد.
    يدعم رسالة فيها عدة وظائف.
    """
    raw = (raw_text or "").strip()
    if len(raw) < 5:
        return []

    api_key = _gemini_api_key()
    parsed_jobs: list[dict[str, Any]] = []

    if api_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.0-flash")
            prompt = f"""حلّل النص التالي واستخرج كل الوظائف المذكورة فيه (قد تكون وظيفة واحدة أو عدة وظائف).

أعد JSON فقط بهذا الشكل:
{{
  "jobs": [
    {{
      "title_ar": "",
      "title_en": "",
      "company": "",
      "city": "",
      "employment_type": "",
      "salary": "",
      "requirements": "",
      "application_email": "",
      "link_url": "",
      "specializations": "",
      "summary_ar": "",
      "summary_en": ""
    }}
  ]
}}

قواعد:
- لا تخترع بيانات غير موجودة.
- application_email يجب أن يكون إيميل فقط (بدون نص إضافي).
- لو حقل غير موجود اتركه فارغاً.
- لو النص يحتوي عدة وظائف، افصلها داخل jobs.
- summary_ar يكون ملخصاً موجزاً من النص نفسه.

النص:
---
{raw[:14000]}
---
"""
            response = model.generate_content(prompt)
            text_out = (response.text or "").strip()
            data = json.loads(_strip_code_fence(text_out))
            jobs_raw = data.get("jobs") if isinstance(data, dict) else []
            if isinstance(jobs_raw, list):
                parsed_jobs = [x for x in jobs_raw if isinstance(x, dict)]
        except Exception as e:
            logger.warning("خطأ جيميني عند تحليل وظائف القناة المتعددة: %s", e)
            parsed_jobs = []

    if not parsed_jobs:
        # fallback: محاولة تقسيم يدوي بسيط حسب فواصل كبيرة
        blocks = re.split(r"\n\s*\n\s*\n+|\n[-=]{3,}\n", raw)
        blocks = [b.strip() for b in blocks if len(b.strip()) >= 20]
        if len(blocks) <= 1:
            blocks = [raw]
        out = []
        for b in blocks[:12]:
            merged = _coerce_parsed({}, b)
            out.append(_single_from_merged(merged))
        return out

    out: list[dict[str, str]] = []
    for item in parsed_jobs[:20]:
        merged = _coerce_parsed(item, raw)
        out.append(_single_from_merged(merged))
    return out


def parse_job_post_text(raw_text: str) -> dict[str, str]:
    """
    للتوافق مع الكود القديم: يعيد أول وظيفة فقط.
    """
    jobs = parse_job_posts_text(raw_text)
    return jobs[0] if jobs else {}
