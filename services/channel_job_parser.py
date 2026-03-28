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


def _gemini_model_flash() -> str:
    try:
        from config import GEMINI_MODEL_FLASH

        return (GEMINI_MODEL_FLASH or "").strip() or "gemini-2.5-flash"
    except ImportError:
        return "gemini-2.5-flash"


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


def _split_job_blocks(raw: str) -> list[str]:
    text = (raw or "").strip()
    if len(text) < 10:
        return []

    # 1) فواصل واضحة بين الوظائف
    by_gap = re.split(r"\n\s*\n\s*\n+|\n[-=]{3,}\n", text)
    by_gap = [b.strip() for b in by_gap if len(b.strip()) >= 20]
    if len(by_gap) > 1:
        return by_gap[:30]

    # 2) تقسيم حسب بداية سطر "المسمى/وظيفة/job title"
    lines = text.splitlines()
    starts: list[int] = []
    start_re = re.compile(
        r"^\s*(?:[^\w\u0600-\u06FF]+)?(?:\d+[\)\.\-]\s*)?(?:المسمى|الوظيفة|وظيفة|job\s*title|position|vacancy)\b",
        re.I,
    )
    for i, ln in enumerate(lines):
        if start_re.search(ln or ""):
            starts.append(i)
    if len(starts) > 1:
        blocks: list[str] = []
        starts.append(len(lines))
        for a, b in zip(starts, starts[1:]):
            chunk = "\n".join(lines[a:b]).strip()
            if len(chunk) >= 20:
                blocks.append(chunk)
        if blocks:
            return blocks[:30]

    # 3) نمط شائع: "الوظيفة الأولى/الثانية/الثالثة..."
    marker_re = re.compile(
        r"(?:^|\n)\s*(?:[^\w\u0600-\u06FF]+)?الوظيفة\s+(?:الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة|\d+)\s*[:：\-]",
        re.I,
    )
    markers = list(marker_re.finditer(text))
    if len(markers) > 1:
        blocks = []
        for idx, m in enumerate(markers):
            start = m.start()
            end = markers[idx + 1].start() if idx + 1 < len(markers) else len(text)
            chunk = text[start:end].strip()
            if len(chunk) >= 20:
                blocks.append(chunk)
        if blocks:
            return blocks[:30]

    # 4) تقسيم تقريبي حسب الترقيم المتسلسل داخل نص واحد طويل
    numbered = re.split(r"(?:(?<=\n)|^)\s*\d+\s*[\)\.\-]\s+", text)
    numbered = [b.strip() for b in numbered if len(b.strip()) >= 20]
    if len(numbered) > 1:
        return numbered[:30]

    return [text]


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


def _coerce_parsed(data: dict[str, Any], raw: str, *, tweet_merge: bool = False) -> dict[str, Any]:
    rt = (raw or "").strip()
    fb = None if tweet_merge else _fallback_parse(rt)

    title_ar = str(data.get("title_ar") or "").strip()[:300]
    title_en = str(data.get("title_en") or "").strip()[:300]
    if not title_ar and title_en:
        title_ar = title_en
    if fb:
        title_ar = title_ar or str(fb.get("title_ar") or "").strip()[:300]

    company = str(data.get("company") or "").strip()[:200]
    city = str(data.get("city") or "").strip()[:160]
    employment_type = str(data.get("employment_type") or "").strip()[:120]
    salary = str(data.get("salary") or "").strip()[:200]
    requirements = str(data.get("requirements") or "").strip()[:4000]
    application_email = str(data.get("application_email") or "").strip()[:320]
    if application_email and not _EMAIL_RE.search(application_email):
        application_email = ""
    emails = _EMAIL_RE.findall(rt)
    fe = emails[0] if emails else ""
    flink = _extract_first_url(rt)
    if not application_email:
        application_email = (str(fb.get("application_email") or "").strip()[:320] if fb else "") or fe
    link_url = str(data.get("link_url") or "").strip()[:2000]
    if link_url and not link_url.startswith("http"):
        link_url = ""
    if not link_url:
        link_url = (str(fb.get("link_url") or "").strip()[:2000] if fb else "") or flink
    specializations = str(data.get("specializations") or "").strip()[:1000]
    summary_ar = str(data.get("summary_ar") or "").strip()[:4000]
    summary_en = str(data.get("summary_en") or "").strip()[:4000]
    if not summary_ar:
        summary_ar = (str(fb.get("summary_ar") or "").strip()[:4000] if fb else "") or rt[:4000]
    if not requirements:
        requirements = summary_ar
    if not tweet_merge and not title_ar:
        title_ar = rt[:300] or "وظيفة"
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


def _parse_single_job_text(raw: str, source: str = "channel") -> dict[str, str]:
    """تحليل وظيفة واحدة (AI + fallback للقناة؛ للتغريدات: AI فقط إن وُجد مفتاح)."""
    raw = (raw or "").strip()
    if len(raw) < 5:
        return {}

    is_tweet = source == "tweet"
    api_key = _gemini_api_key()
    parsed: dict[str, Any] = {}
    if api_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(_gemini_model_flash())
            if is_tweet:
                prompt = f"""أنت تستخرج إعلان وظيفة من تغريدة (X/Twitter) — نص قد يكون قصيراً ويحوي روابط مختصرة وهاشتاقات ومنشنات.

أعد JSON فقط بالمفاتيح:
title_ar, title_en, company, city, employment_type, salary, requirements, application_email, link_url, specializations, summary_ar, summary_en

قواعد صارمة:
- إن لم يكن النص يصف وظيفة واضحة (مسمى/شركة/مدينة أو طريقة تقديم)، اجعل title_ar و title_en والحقول الأخرى فارغة "" (لا تملأ عنواناً من السطر الأول إن لم يكن وظيفة).
- لا تخترع بريداً أو شركة من الهاشتاق أو المنشن.
- application_email فقط إن وُجد بريد صريح في النص.
- link_url: رابط التقديم أو صفحة الوظيفة إن وُجد (واحد الأنسب).
- requirements: جملة أو سطران من نص التغريدة فقط.
- city: المدينة أو الدولة إن ذُكرت صراحة (مثلاً الرياض، دبي، الكويت).

النص:
---
{raw[:6000]}
---
"""
            else:
                prompt = f"""استخرج بيانات وظيفة واحدة من النص التالي.
أعد JSON فقط بالمفاتيح:
title_ar, title_en, company, city, employment_type, salary, requirements, application_email, link_url, specializations, summary_ar, summary_en

قواعد:
- لا تخترع أي قيمة غير موجودة.
- application_email بريد فقط إن وجد.
- إن كان الحقل غير موجود اتركه فارغاً.

النص:
---
{raw[:9000]}
---
"""
            out = (model.generate_content(prompt).text or "").strip()
            parsed = json.loads(_strip_code_fence(out))
        except Exception as e:
            logger.warning("Single-job AI parse failed: %s", e)
            parsed = {}

    if is_tweet:
        if not api_key or not parsed or not isinstance(parsed, dict):
            return {}
        if not str(parsed.get("title_ar") or parsed.get("title_en") or "").strip():
            return {}
        merged = _coerce_parsed(parsed, raw, tweet_merge=True)
    else:
        merged = _coerce_parsed(parsed if isinstance(parsed, dict) else {}, raw)
    return _single_from_merged(merged)


def parse_tweet_jobs_text(raw_text: str) -> list[dict[str, str]]:
    """تغريدة واحدة ككتلة واحدة + مخرجات AI مخصصة (لا تقسيم كقناة طويلة)."""
    raw = (raw_text or "").strip()
    if len(raw) < 10:
        return []
    item = _parse_single_job_text(raw, source="tweet")
    return [item] if item else []


def parse_job_posts_text(raw_text: str) -> list[dict[str, str]]:
    """
    يعيد قائمة وظائف جاهزة للإدراج/النشر الموحد.
    يدعم رسالة فيها عدة وظائف.
    """
    raw = (raw_text or "").strip()
    if len(raw) < 5:
        return []

    # نعتمد أولاً على التقسيم اليدوي، ثم تحليل كل وظيفة على حدة.
    blocks = _split_job_blocks(raw)
    out: list[dict[str, str]] = []
    for b in blocks[:30]:
        item = _parse_single_job_text(b)
        if not item:
            continue
        out.append(item)

    if out:
        return out

    merged = _coerce_parsed({}, raw)
    return [_single_from_merged(merged)]


def parse_job_post_text(raw_text: str) -> dict[str, str]:
    """
    للتوافق مع الكود القديم: يعيد أول وظيفة فقط.
    """
    jobs = parse_job_posts_text(raw_text)
    return jobs[0] if jobs else {}
