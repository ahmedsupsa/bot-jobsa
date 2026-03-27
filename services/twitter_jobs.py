# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime

import httpx
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

import config
from services.channel_job_parser import parse_job_posts_text

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", re.I)


def _format_post(fields: dict, email: str) -> str:
    title = (fields.get("title_ar") or fields.get("title_en") or "وظيفة").strip()
    title = re.sub(r"^\s*(?:الوظيفة\s+\S+)\s*[:\-–—]*\s*", "", title, flags=re.I).strip() or "وظيفة"
    company = (fields.get("company") or "").strip()
    city = (fields.get("city") or "").strip()
    emp = (fields.get("employment_type") or "").strip()
    salary = (fields.get("salary") or "").strip()
    req = (fields.get("requirements") or fields.get("description_ar") or "").strip() or "مذكورة في نص الإعلان."

    lines = ["فرصة وظيفية جديدة", "", f"المسمى: {title}"]
    if company:
        lines.append(f"الشركة: {company}")
    if city:
        lines.append(f"المدينة: {city}")
    if emp:
        lines.append(f"نوع الدوام: {emp}")
    if salary:
        lines.append(f"الراتب: {salary}")
    lines.append("المتطلبات:")
    for p in [x.strip(" -*•\t") for x in req.splitlines() if x.strip()][:4]:
        lines.append(f"• {p[:220]}")
    if email:
        lines.append(f"التقديم: {email}")
    lines.extend(["", "اشترك في بوت التقديم الذكي"])
    return "\n".join(lines).strip()


async def run_twitter_jobs_cycle(bot, bot_data: dict) -> None:
    if not config.X_BEARER_TOKEN or not config.TWITTER_TARGET_CHANNEL_ID:
        return

    headers = {"Authorization": f"Bearer {config.X_BEARER_TOKEN}"}
    params = {
        "query": config.TWITTER_JOB_QUERY,
        "max_results": "20",
        "tweet.fields": "created_at,lang",
    }
    url = "https://api.x.com/2/tweets/search/recent"

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, headers=headers, params=params)
            r.raise_for_status()
            payload = r.json()
    except Exception as e:
        logger.warning("Twitter ingest failed: %s", e)
        return

    tweets = payload.get("data") or []
    if not tweets:
        return

    seen: set[str] = bot_data.setdefault("twitter_seen_ids", set())
    pending: dict = bot_data.setdefault("twitter_pending_jobs", {})
    pending_tweet_ids: set[str] = bot_data.setdefault("twitter_pending_tweet_ids", set())
    try:
        from database.db import admin_job_exists_by_link
    except Exception:
        return

    for tw in tweets:
        tid = str(tw.get("id") or "").strip()
        if not tid or tid in seen:
            continue
        text = (tw.get("text") or "").strip()
        if len(text) < 20:
            seen.add(tid)
            continue

        tweet_url = f"https://x.com/i/web/status/{tid}"
        # dedup persisted by tweet URL link
        exists = await asyncio.to_thread(admin_job_exists_by_link, tweet_url)
        if exists:
            seen.add(tid)
            continue

        jobs = await asyncio.to_thread(parse_job_posts_text, text)
        if not jobs:
            seen.add(tid)
            continue
        common_email_m = _EMAIL_RE.search(text)
        common_email = common_email_m.group(0).strip() if common_email_m else ""

        queued_any = False
        for idx, fields in enumerate(jobs[:10], 1):
            email = (fields.get("application_email") or "").strip() or common_email
            if email and not _EMAIL_RE.fullmatch(email):
                email = ""
            candidate_id = f"{tid}:{idx}"
            if candidate_id in pending:
                continue
            pending[candidate_id] = {
                "tweet_id": tid,
                "tweet_url": tweet_url,
                "text": text[:3500],
                "fields": fields,
                "email": email,
                "created_at": datetime.utcnow().isoformat(),
            }
            queued_any = True

            title = (fields.get("title_ar") or fields.get("title_en") or "وظيفة").strip()
            company = (fields.get("company") or "").strip()
            city = (fields.get("city") or "").strip()
            review_msg = (
                "طلب اعتماد وظيفة من تويتر\n\n"
                f"المعرف: `{candidate_id}`\n"
                f"المسمى: {title}\n"
                f"{'الشركة: ' + company + chr(10) if company else ''}"
                f"{'المدينة: ' + city + chr(10) if city else ''}"
                f"{'التقديم: ' + email + chr(10) if email else ''}"
                f"المصدر: {tweet_url}\n\n"
                "اعتماد = نشر بالقناة + حفظ بقاعدة البيانات\n"
                "رفض = تجاهل الوظيفة"
            )
            kb = InlineKeyboardMarkup([[
                InlineKeyboardButton("اعتماد", callback_data=f"twjob_appr:{candidate_id}"),
                InlineKeyboardButton("رفض", callback_data=f"twjob_rej:{candidate_id}"),
            ]])
            for admin_id in (config.ADMIN_TELEGRAM_IDS or []):
                try:
                    await bot.send_message(
                        chat_id=admin_id,
                        text=review_msg,
                        parse_mode="Markdown",
                        reply_markup=kb,
                        disable_web_page_preview=True,
                    )
                except Exception:
                    logger.warning("Failed sending twitter review card to admin %s", admin_id)

        seen.add(tid)
        if queued_any:
            pending_tweet_ids.add(tid)
        if len(seen) > 4000:
            # keep memory bounded
            bot_data["twitter_seen_ids"] = set(list(seen)[-1500:])


async def publish_pending_twitter_job(bot, bot_data: dict, candidate_id: str) -> tuple[bool, str]:
    pending: dict = bot_data.setdefault("twitter_pending_jobs", {})
    item = pending.get(candidate_id)
    if not item:
        return False, "هذا الطلب غير موجود أو تمت معالجته."

    fields = item.get("fields") or {}
    email = (item.get("email") or "").strip()
    tweet_url = (item.get("tweet_url") or "").strip()
    try:
        from database.db import add_admin_job, admin_job_exists_by_link
    except Exception:
        return False, "فشل الوصول لقاعدة البيانات."

    exists = await asyncio.to_thread(admin_job_exists_by_link, tweet_url)
    if exists:
        pending.pop(candidate_id, None)
        return False, "تم تجاهل الطلب لأنه موجود مسبقاً."

    post_text = _format_post(fields, email)
    try:
        await bot.send_message(
            chat_id=config.TWITTER_TARGET_CHANNEL_ID,
            text=post_text,
            disable_web_page_preview=True,
        )
    except Exception as e:
        return False, f"فشل نشر القناة: {e}"

    try:
        await asyncio.to_thread(
            add_admin_job,
            title_ar=fields.get("title_ar") or "وظيفة",
            title_en=fields.get("title_en") or "",
            description_ar=post_text[:4000],
            description_en=fields.get("description_en") or "",
            company=fields.get("company") or "",
            link_url=tweet_url,
            application_email=email,
            specializations=fields.get("specializations") or "",
        )
    except Exception as e:
        return False, f"فشل حفظ قاعدة البيانات: {e}"

    pending.pop(candidate_id, None)
    return True, "تم الاعتماد والنشر بنجاح."


def reject_pending_twitter_job(bot_data: dict, candidate_id: str) -> tuple[bool, str]:
    pending: dict = bot_data.setdefault("twitter_pending_jobs", {})
    if candidate_id not in pending:
        return False, "هذا الطلب غير موجود أو تمت معالجته."
    pending.pop(candidate_id, None)
    return True, "تم رفض الوظيفة."
