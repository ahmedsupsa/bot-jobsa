# -*- coding: utf-8 -*-
"""
استخراج حقول وظيفة من منشور قناة (نص/تعليق) عبر Gemini عند توفر المفتاح،
مع fallback بسيط (سطر أول + باقي النص + إيميل/رابط) بدون API.
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
    if not title_ar:
        title_ar = (raw or "").strip()[:300] or "وظيفة"
    return {
        "title_ar": title_ar,
        "title_en": title_en,
        "company": company,
        "application_email": application_email,
        "link_url": link_url,
        "specializations": specializations,
        "summary_ar": summary_ar,
        "summary_en": summary_en,
    }


def parse_job_post_text(raw_text: str) -> dict[str, str]:
    """
    يعيد حقولاً جاهزة لـ add_admin_job:
    title_ar, title_en, description_ar, description_en, company,
    application_email, link_url, specializations
    """
    raw = (raw_text or "").strip()
    if len(raw) < 5:
        return {}

    api_key = _gemini_api_key()
    parsed: dict[str, Any] = {}

    if api_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.0-flash")
            prompt = f"""أنت تستخرج معلومات من منشور وظيفة (عربي/إنجليزي/مختلط).

قواعد:
- لا تخترع معلومات غير ظاهرة في النص.
- إن غاب حقل اتركه كسلسلة فارغة "".
- application_email: بريد التقديم فقط إن وُجد صراحة.
- link_url: رابط http/https واحد الأنسب للتقديم أو تفاصيل الإعلان.
- specializations: التخصص أو المجال (مفصول بفواصل إن تعدد).
- summary_ar: ملخص منظم بالعربية (المسمى، الشركة إن وُجدت، الموقع/العمل عن بُعد، المؤهلات، الخبرة، المهارات، الراتب إن وُجد، طريقة التقديم) — فقط ما ورد في النص.
- summary_en: ملخص إنجليزي قصير إن كان الإعلان إنجليزياً أساساً وإلا "".

أعد **JSON فقط** بدون markdown، بالمفاتيح:
title_ar, title_en, company, application_email, link_url, specializations, summary_ar, summary_en

النص:
---
{raw[:12000]}
---
"""
            response = model.generate_content(prompt)
            text_out = (response.text or "").strip()
            parsed = json.loads(_strip_code_fence(text_out))
        except json.JSONDecodeError as e:
            logger.warning("تعذر تحليل JSON من جيميني لوظيفة القناة: %s", e)
            parsed = {}
        except Exception as e:
            logger.warning("خطأ جيميني عند تحليل منشور وظيفة: %s", e)
            parsed = {}

    merged = _coerce_parsed(parsed if isinstance(parsed, dict) else {}, raw)
    return {
        "title_ar": merged["title_ar"],
        "title_en": merged["title_en"],
        "description_ar": merged["summary_ar"],
        "description_en": merged["summary_en"],
        "company": merged["company"],
        "link_url": merged["link_url"],
        "application_email": merged["application_email"],
        "specializations": merged["specializations"],
    }
