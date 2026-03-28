# -*- coding: utf-8 -*-
"""
تنسيق موحّد لمنشورات الوظائف في القناة (يدوي من القناة أو معتمد من تويتر).
"""
from __future__ import annotations

import re

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

SUBSCRIPTION_STORE_URL = "https://ahmedsup.com/VDPvOWx"
_BOT_PROMO = "اشترك في بوت التقديم الذكي"


def _clean_text_block(text: str) -> str:
    t = (text or "").strip()
    t = re.sub(r"\[[^\]]+\]\([^)]+\)", "", t)
    t = re.sub(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def normalize_job_title(title: str) -> str:
    t = _clean_text_block(title)
    t = re.sub(
        r"^\s*(?:الوظيفة\s+(?:الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة|\d+)|وظيفة(?:\s+رقم)?\s*\d*)\s*[:\-–—]*\s*",
        "",
        t,
        flags=re.I,
    )
    return t.strip(" -:") or "وظيفة"


def _pick_requirement_points(req: str) -> list[str]:
    raw = (req or "").strip()
    if not raw:
        return ["مذكورة في الإعلان."]
    lines = [x.strip(" -*•\t") for x in re.split(r"[\r\n]+", raw) if x.strip()]
    points = []
    for ln in lines:
        if len(ln) < 6:
            continue
        if re.search(r"^(الوصف|الشروط|المتطلبات|طريقة التقديم)\b", ln, re.I):
            continue
        points.append(_clean_text_block(ln))
        if len(points) >= 4:
            break
    if points:
        return points
    return [_clean_text_block(raw)[:220]]


def build_job_channel_post(fields: dict, email: str) -> str:
    """نفس تنسيق المنشور بعد إدخال وظيفة من القناة (فرصة وظيفية جديدة + المتطلبات + التقديم + دعوة البوت)."""
    title = normalize_job_title((fields.get("title_ar") or fields.get("title_en") or "وظيفة").strip())
    company = _clean_text_block((fields.get("company") or "").strip())
    city = _clean_text_block((fields.get("city") or "").strip())
    emp = _clean_text_block((fields.get("employment_type") or "").strip())
    salary = _clean_text_block((fields.get("salary") or "").strip())
    req = (fields.get("requirements") or fields.get("description_ar") or "").strip()

    lines = [
        "فرصة وظيفية جديدة",
        "",
        f"المسمى: {title}",
    ]
    if company:
        lines.append(f"الشركة: {company}")
    if city:
        lines.append(f"المدينة: {city}")
    if emp:
        lines.append(f"نوع الدوام: {emp}")
    if salary:
        lines.append(f"الراتب: {salary}")

    lines.append("المتطلبات:")
    for p in _pick_requirement_points(req):
        lines.append(f"• {p[:220]}")

    if email:
        lines.append(f"التقديم: {email}")
    lines.extend(["", _BOT_PROMO])
    return "\n".join(lines).strip()


def subscription_reply_markup() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton("رابط الاشتراك", url=SUBSCRIPTION_STORE_URL)]])
