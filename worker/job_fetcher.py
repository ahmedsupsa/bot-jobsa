# -*- coding: utf-8 -*-
"""
job_fetcher.py — يجلب تغريدات حسابات الوظائف عبر Nitter RSS
ويستخرج بيانات الوظيفة بـ Gemini ويحفظها في Supabase تلقائياً
"""
import asyncio
import hashlib
import json
import logging
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

_SB_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# حسابات تويتر المصادر
TWITTER_ACCOUNTS = [
    "cvcv0789",
    "BarqJobs",
    "sjn800",
    "Acct_Jobs",
    "m_alwahebi",
    "mnor3990",
    "wazaeef",
]

# نسخ Nitter متعددة للضمان
NITTER_INSTANCES = [
    "https://nitter.poast.org",
    "https://nitter.privacydev.net",
    "https://nitter.1d4.us",
    "https://nitter.cz",
    "https://nitter.unixfox.eu",
]

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


def _tweet_id(text: str, account: str) -> str:
    return hashlib.md5(f"{account}:{text[:200]}".encode()).hexdigest()


async def _fetch_rss(client: httpx.AsyncClient, account: str) -> list[dict]:
    """يجلب RSS من Nitter مع تجربة عدة نسخ."""
    for instance in NITTER_INSTANCES:
        url = f"{instance}/{account}/rss"
        try:
            r = await client.get(url, timeout=15, follow_redirects=True)
            if r.status_code != 200:
                continue
            root = ET.fromstring(r.text)
            ns = {"dc": "http://purl.org/dc/elements/1.1/"}
            items = []
            for item in root.findall(".//item"):
                title_el = item.find("title")
                desc_el = item.find("description")
                link_el = item.find("link")
                pub_el = item.find("pubDate")
                title = title_el.text or "" if title_el is not None else ""
                desc = desc_el.text or "" if desc_el is not None else ""
                link = link_el.text or "" if link_el is not None else ""
                pub = pub_el.text or "" if pub_el is not None else ""
                # نزيل HTML tags من الوصف
                clean_desc = re.sub(r"<[^>]+>", " ", desc).strip()
                full_text = f"{title}\n{clean_desc}".strip()
                items.append({
                    "account": account,
                    "text": full_text,
                    "link": link,
                    "pub_date": pub,
                    "uid": _tweet_id(full_text, account),
                })
            logger.info("✅ جلب %d تغريدة من @%s عبر %s", len(items), account, instance)
            return items
        except Exception as e:
            logger.debug("Nitter %s فشل لـ @%s: %s", instance, account, e)
            continue
    logger.warning("⚠️ تعذّر جلب @%s من جميع نسخ Nitter", account)
    return []


def _extract_emails(text: str) -> list[str]:
    return _EMAIL_RE.findall(text)


async def _extract_job_with_gemini(text: str, link: str) -> dict | None:
    """يستخدم Gemini لاستخراج بيانات الوظيفة من نص التغريدة."""
    if not GEMINI_API_KEY:
        return None

    prompt = f"""أنت نظام استخراج بيانات وظائف. اقرأ التغريدة التالية وحدّد إذا كانت تحتوي على إعلان وظيفة.
إذا كانت تحتوي على وظيفة، استخرج البيانات التالية بتنسيق JSON فقط (بدون أي نص آخر):
{{
  "is_job": true,
  "title_ar": "مسمى الوظيفة بالعربي",
  "company": "اسم الشركة أو المؤسسة إن وجد",
  "description_ar": "وصف الوظيفة والمتطلبات",
  "application_email": "البريد الإلكتروني للتقديم إن وجد أو null",
  "specializations": "5 كلمات مفتاحية مفصولة بفاصلة"
}}

إذا لم تكن تحتوي على وظيفة، أرجع: {{"is_job": false}}

التغريدة:
{text[:800]}

الرابط: {link}
"""

    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
                json={"contents": [{"parts": [{"text": prompt}]}],
                      "generationConfig": {"temperature": 0.1}},
            )
            data = r.json()
            raw = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            # نستخرج JSON من الرد
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if not match:
                return None
            result = json.loads(match.group())
            if not result.get("is_job"):
                return None
            # إذا لم يجد Gemini الإيميل، نحاول نستخرجه من النص
            if not result.get("application_email"):
                emails = _extract_emails(text)
                result["application_email"] = emails[0] if emails else None
            return result
    except Exception as e:
        logger.debug("Gemini خطأ: %s", e)
        return None


async def _already_exists(client: httpx.AsyncClient, uid: str) -> bool:
    """يتحقق إذا كانت الوظيفة موجودة مسبقاً عبر tweet_uid."""
    try:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/admin_jobs",
            headers=_SB_HEADERS,
            params={"tweet_uid": f"eq.{uid}", "select": "id", "limit": "1"},
        )
        return bool(r.is_success and r.json())
    except Exception:
        return False


async def _save_job(client: httpx.AsyncClient, job: dict, uid: str, source_account: str) -> bool:
    """يحفظ الوظيفة في Supabase."""
    try:
        payload = {
            "title_ar": (job.get("title_ar") or "").strip()[:255],
            "company": (job.get("company") or "").strip()[:200],
            "description_ar": (job.get("description_ar") or "").strip()[:3000],
            "application_email": (job.get("application_email") or "").strip() or None,
            "specializations": (job.get("specializations") or "").strip()[:500],
            "is_active": True,
            "tweet_uid": uid,
            "source_account": source_account,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/admin_jobs",
            headers=_SB_HEADERS,
            json=payload,
        )
        return r.is_success
    except Exception as e:
        logger.error("خطأ حفظ الوظيفة: %s", e)
        return False


async def fetch_jobs_from_twitter(accounts: list[str] = None) -> dict:
    """
    الدالة الرئيسية — تجلب الوظائف من تويتر وتحفظها في Supabase.
    تُرجع إحصائيات العملية.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {"ok": False, "error": "SUPABASE_URL/SUPABASE_KEY غير مضبوطة", "inserted": 0, "skipped": 0, "total": 0}

    targets = accounts or TWITTER_ACCOUNTS
    stats = {"total": 0, "inserted": 0, "skipped": 0, "no_job": 0, "errors": 0}

    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "Mozilla/5.0"}) as client:
        for account in targets:
            tweets = await _fetch_rss(client, account)
            if not tweets:
                continue

            for tweet in tweets[:20]:  # أقصى 20 تغريدة لكل حساب
                stats["total"] += 1
                uid = tweet["uid"]

                if await _already_exists(client, uid):
                    stats["skipped"] += 1
                    continue

                job = await _extract_job_with_gemini(tweet["text"], tweet["link"])

                if not job:
                    stats["no_job"] += 1
                    continue

                if not job.get("title_ar", "").strip():
                    stats["no_job"] += 1
                    continue

                saved = await _save_job(client, job, uid, account)
                if saved:
                    stats["inserted"] += 1
                    logger.info("💼 وظيفة جديدة: %s من @%s", job.get("title_ar"), account)
                else:
                    stats["errors"] += 1

            await asyncio.sleep(1)  # تأخير بسيط بين الحسابات

    logger.info("📊 النتيجة: %d وظيفة جديدة / %d مكررة / %d ليست وظائف من %d تغريدة",
                stats["inserted"], stats["skipped"], stats["no_job"], stats["total"])
    return {"ok": True, **stats}


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO)
    result = asyncio.run(fetch_jobs_from_twitter())
    print(result)
