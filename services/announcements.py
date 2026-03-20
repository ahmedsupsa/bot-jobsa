# -*- coding: utf-8 -*-
import asyncio
from datetime import datetime, timedelta


ANNOUNCEMENT_REPEAT_INTERVAL_HOURS = 24


async def run_announcements_cycle(bot) -> None:
    from database.db import (
        get_admin_announcements,
        get_announcement_delivery,
        upsert_announcement_delivery,
        is_subscription_active,
    )
    from services.auto_apply import _get_all_active_users

    anns = await asyncio.to_thread(get_admin_announcements, True, True)
    if not anns:
        return
    users = await asyncio.to_thread(_get_all_active_users)
    if not users:
        return

    now = datetime.utcnow()
    for ann in anns:
        ann_id = str(ann.get("id") or "")
        if not ann_id:
            continue
        repeat_count = int(ann.get("repeat_count") or 1)
        title = (ann.get("title") or "إعلان").strip()
        body = (ann.get("body_text") or "").strip()
        image_id = ann.get("image_file_id")
        text = f"📢 {title}\n\n{body}".strip()

        for user in users:
            if not is_subscription_active(user):
                continue
            telegram_id = user.get("telegram_id")
            user_id = str(user.get("id") or "")
            if not telegram_id or not user_id:
                continue

            delivery = await asyncio.to_thread(get_announcement_delivery, ann_id, user_id)
            sent = int((delivery or {}).get("send_count") or 0)
            if sent >= repeat_count:
                continue

            last_sent_raw = (delivery or {}).get("last_sent_at")
            if last_sent_raw:
                try:
                    last_sent = datetime.fromisoformat(str(last_sent_raw).replace("Z", "+00:00")).replace(tzinfo=None)
                    if (now - last_sent) < timedelta(hours=ANNOUNCEMENT_REPEAT_INTERVAL_HOURS):
                        continue
                except Exception:
                    pass

            try:
                if image_id:
                    await bot.send_photo(chat_id=telegram_id, photo=image_id, caption=text[:1024])
                else:
                    await bot.send_message(chat_id=telegram_id, text=text)
                await asyncio.to_thread(upsert_announcement_delivery, ann_id, user_id, sent + 1)
            except Exception:
                continue

