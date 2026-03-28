# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime

import httpx
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

import config
from services.channel_job_parser import parse_tweet_jobs_text

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", re.I)
_URL_RE = re.compile(r"https?://\S+", re.I)

_JOB_WORDS = (
    "وظيفة", "وظائف", "فرصة وظيفية", "شاغر", "مطلوب", "career", "careers", "job", "hiring", "vacancy",
)
_APPLY_WORDS = (
    "التقديم", "ارسال السيرة", "ارسل السيرة", "أرسل السيرة", "قدم الآن", "apply", "send cv", "submit cv",
)
_NON_JOB_WORDS = (
    "مسابقة", "خصم", "كوبون", "عرض", "بيع", "شراء", "توصيل", "تابعنا", "اعلان ممول", "giveaway", "promo",
)


def _tweet_signal_score(text: str) -> int:
    t = (text or "").lower()
    score = 0
    if any(k in t for k in _JOB_WORDS):
        score += 1
    if any(k in t for k in _APPLY_WORDS):
        score += 1
    if _EMAIL_RE.search(t):
        score += 2
    if _URL_RE.search(t):
        score += 1
    if any(k in t for k in _NON_JOB_WORDS):
        score -= 2
    return score


def _tweet_excluded_by_config(text: str) -> bool:
    t = (text or "").lower()
    for sub in getattr(config, "TWITTER_EXCLUDE_SUBSTRINGS", None) or []:
        s = (sub or "").strip().lower()
        if s and s in t:
            return True
    return False


def _is_relevant_tweet(text: str, require_email: bool, allow_link_apply: bool, min_score: int) -> bool:
    t = (text or "").strip()
    if len(t) < 30:
        return False
    has_email = bool(_EMAIL_RE.search(t))
    has_url = bool(_URL_RE.search(t))
    # في وضعك الافتراضي: لازم إيميل، ونرفض رابط بدون إيميل.
    if require_email and not has_email:
        return False
    if not allow_link_apply and has_url and not has_email:
        return False
    return _tweet_signal_score(t) >= max(1, int(min_score or 1))


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


def _sorted_pending_ids(bot_data: dict) -> list[str]:
    pending: dict = bot_data.setdefault("twitter_pending_jobs", {})
    rows: list[tuple[str, str]] = []
    for cid, item in pending.items():
        created = str((item or {}).get("created_at") or "")
        rows.append((cid, created))
    rows.sort(key=lambda x: x[1], reverse=True)
    return [cid for cid, _ in rows]


def _review_text(bot_data: dict, candidate_id: str, status_line: str = "") -> str:
    pending: dict = bot_data.setdefault("twitter_pending_jobs", {})
    item = pending.get(candidate_id) or {}
    fields = item.get("fields") or {}
    email = (item.get("email") or "").strip()
    tweet_url = (item.get("tweet_url") or "").strip()
    ids = _sorted_pending_ids(bot_data)
    total = len(ids)
    pos = (ids.index(candidate_id) + 1) if candidate_id in ids else 1
    final_post = _format_post(fields, email)
    final_post = final_post[:2600]
    parts = [
        "مراجعة وظائف تويتر (سلايدر)",
        f"العنصر: {pos}/{max(total, 1)}",
    ]
    if status_line:
        parts.append(status_line[:180])
    parts.extend([
        "",
        "المعاينة النهائية للنشر:",
        "--------------------",
        final_post,
        "--------------------",
    ])
    if tweet_url:
        parts.append(f"المصدر: {tweet_url}")
    return "\n".join(parts)[:3900]


def _review_keyboard(bot_data: dict, candidate_id: str) -> InlineKeyboardMarkup:
    ids = _sorted_pending_ids(bot_data)
    idx = ids.index(candidate_id) if candidate_id in ids else 0
    has_prev = idx > 0
    has_next = idx < (len(ids) - 1)
    row = [
        InlineKeyboardButton("⬅️ السابق", callback_data=f"twjob_nav:{candidate_id}:prev"),
        InlineKeyboardButton("✅ اعتماد", callback_data=f"twjob_appr:{candidate_id}"),
        InlineKeyboardButton("🗑 رفض", callback_data=f"twjob_rej:{candidate_id}"),
        InlineKeyboardButton("التالي ➡️", callback_data=f"twjob_nav:{candidate_id}:next"),
    ]
    if not has_prev:
        row[0] = InlineKeyboardButton("·", callback_data=f"twjob_noop:{candidate_id}")
    if not has_next:
        row[3] = InlineKeyboardButton("·", callback_data=f"twjob_noop:{candidate_id}")
    return InlineKeyboardMarkup([row])


def get_next_candidate_id(bot_data: dict, current_candidate_id: str, direction: str) -> str | None:
    ids = _sorted_pending_ids(bot_data)
    if not ids:
        return None
    if current_candidate_id not in ids:
        return ids[0]
    idx = ids.index(current_candidate_id)
    if direction == "prev":
        return ids[idx - 1] if idx > 0 else ids[0]
    return ids[idx + 1] if idx < (len(ids) - 1) else ids[-1]


def build_review_view(bot_data: dict, candidate_id: str, status_line: str = "") -> tuple[str, InlineKeyboardMarkup]:
    return _review_text(bot_data, candidate_id, status_line=status_line), _review_keyboard(bot_data, candidate_id)


async def refresh_admin_review_panel(bot, bot_data: dict, admin_id: int, preferred_candidate_id: str | None = None, status_line: str = "") -> None:
    pending_ids = _sorted_pending_ids(bot_data)
    state_all: dict = bot_data.setdefault("twitter_review_state", {})
    state = state_all.get(str(admin_id)) or {}
    message_id = state.get("message_id")
    if not pending_ids:
        if message_id:
            try:
                await bot.edit_message_text(
                    chat_id=admin_id,
                    message_id=message_id,
                    text="لا توجد وظائف تويتر معلّقة للمراجعة حالياً.",
                )
            except Exception:
                pass
        state_all[str(admin_id)] = {}
        return

    current_id = preferred_candidate_id if preferred_candidate_id in pending_ids else (state.get("current_candidate_id") if state.get("current_candidate_id") in pending_ids else pending_ids[0])
    text, kb = build_review_view(bot_data, current_id, status_line=status_line)
    if message_id:
        try:
            await bot.edit_message_text(
                chat_id=admin_id,
                message_id=message_id,
                text=text,
                reply_markup=kb,
                disable_web_page_preview=True,
            )
            state_all[str(admin_id)] = {"message_id": message_id, "current_candidate_id": current_id}
            return
        except Exception:
            pass

    msg = await bot.send_message(
        chat_id=admin_id,
        text=text,
        reply_markup=kb,
        disable_web_page_preview=True,
    )
    state_all[str(admin_id)] = {"message_id": msg.message_id, "current_candidate_id": current_id}


def _twitter_oauth1_configured() -> bool:
    return bool(
        getattr(config, "X_OAUTH1_API_KEY", "")
        and getattr(config, "X_OAUTH1_API_SECRET", "")
        and getattr(config, "X_OAUTH1_ACCESS_TOKEN", "")
        and getattr(config, "X_OAUTH1_ACCESS_TOKEN_SECRET", "")
    )


async def run_twitter_jobs_cycle(bot, bot_data: dict) -> None:
    if not config.TWITTER_TARGET_CHANNEL_ID:
        return

    params = {
        "query": config.TWITTER_JOB_QUERY,
        "max_results": "20",
        "tweet.fields": "created_at,lang",
    }
    url = "https://api.x.com/2/tweets/search/recent"

    use_oauth1 = _twitter_oauth1_configured()
    auth_token = (
        (getattr(config, "X_USER_ACCESS_TOKEN", "") or "").strip()
        or (getattr(config, "X_BEARER_TOKEN", "") or "").strip()
    )
    if not use_oauth1 and not auth_token:
        return

    auth_mode = "oauth1" if use_oauth1 else (
        "user_oauth2" if getattr(config, "X_USER_ACCESS_TOKEN", "") else "app_bearer"
    )

    def _log_fail(status: int, text: str, err_json: object | None) -> None:
        detail = (text or "")[:900]
        if isinstance(err_json, dict):
            detail = str(
                err_json.get("errors")
                or err_json.get("title")
                or err_json.get("detail")
                or err_json
            )[:900]
        logger.warning("Twitter API HTTP %s (%s): %s", status, auth_mode, detail)
        if status == 401 and auth_mode == "user_oauth2":
            logger.warning(
                "Twitter OAuth2: إن كان المفروض OAuth 1.0a، احذف أو صفّر X_USER_ACCESS_TOKEN في البيئة "
                "وأكمل مفاتيح X_OAUTH1_* الأربعة؛ Bearer منتهي أو غير مخوّل يسبب 401."
            )

    try:
        if use_oauth1:
            def _get_oauth1():
                import requests
                from requests_oauthlib import OAuth1

                auth = OAuth1(
                    config.X_OAUTH1_API_KEY,
                    client_secret=config.X_OAUTH1_API_SECRET,
                    resource_owner_key=config.X_OAUTH1_ACCESS_TOKEN,
                    resource_owner_secret=config.X_OAUTH1_ACCESS_TOKEN_SECRET,
                )
                return requests.get(url, params=params, auth=auth, timeout=20)

            r = await asyncio.to_thread(_get_oauth1)
            if r.status_code != 200:
                try:
                    ej = r.json()
                except Exception:
                    ej = None
                _log_fail(r.status_code, r.text, ej)
                return
            payload = r.json()
        else:
            headers = {"Authorization": f"Bearer {auth_token}"}
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(url, headers=headers, params=params)
                if r.status_code != 200:
                    try:
                        ej = r.json()
                    except Exception:
                        ej = None
                    _log_fail(r.status_code, r.text, ej)
                    return
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
        if _tweet_excluded_by_config(text):
            seen.add(tid)
            continue
        if not _is_relevant_tweet(
            text=text,
            require_email=getattr(config, "TWITTER_REQUIRE_EMAIL", True),
            allow_link_apply=getattr(config, "TWITTER_ALLOW_LINK_APPLY", False),
            min_score=getattr(config, "TWITTER_MIN_SIGNAL_SCORE", 3),
        ):
            seen.add(tid)
            continue

        tweet_url = f"https://x.com/i/web/status/{tid}"
        # dedup persisted by tweet URL link
        exists = await asyncio.to_thread(admin_job_exists_by_link, tweet_url)
        if exists:
            seen.add(tid)
            continue

        jobs = await asyncio.to_thread(parse_tweet_jobs_text, text)
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

        seen.add(tid)
        if queued_any:
            pending_tweet_ids.add(tid)
        if len(seen) > 4000:
            # keep memory bounded
            bot_data["twitter_seen_ids"] = set(list(seen)[-1500:])

    for admin_id in (config.ADMIN_TELEGRAM_IDS or []):
        try:
            await refresh_admin_review_panel(bot, bot_data, admin_id)
        except Exception:
            logger.warning("Failed refreshing twitter review panel for admin %s", admin_id)


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
