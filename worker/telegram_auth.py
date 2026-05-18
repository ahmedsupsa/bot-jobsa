#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
telegram_auth.py — سكريبت لمرة واحدة لتوليد TELEGRAM_SESSION_STRING
شغّله محلياً: python worker/telegram_auth.py
ثم انسخ الـ session string وضعه في متغيرات البيئة
"""
import asyncio
import os
import sys

async def main():
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
    except ImportError:
        print("❌ ثبّت telethon أولاً: pip install telethon")
        sys.exit(1)

    print("=" * 60)
    print("  إنشاء جلسة Telegram لحسابك الشخصي")
    print("=" * 60)
    print()
    print("تحتاج API_ID و API_HASH من:")
    print("  https://my.telegram.org → App configuration")
    print()

    api_id   = input("API ID: ").strip()
    api_hash = input("API Hash: ").strip()

    if not api_id or not api_hash:
        print("❌ API_ID و API_HASH مطلوبان")
        sys.exit(1)

    client = TelegramClient(StringSession(), int(api_id), api_hash)
    await client.start()

    session_string = client.session.save()
    await client.disconnect()

    print()
    print("=" * 60)
    print("✅ تم إنشاء الجلسة بنجاح!")
    print()
    print("انسخ هذه القيمة وضعها في Vercel كـ Environment Variable:")
    print()
    print(f"  TELEGRAM_SESSION_STRING = {session_string}")
    print()
    print("وأيضاً:")
    print(f"  TELEGRAM_API_ID = {api_id}")
    print(f"  TELEGRAM_API_HASH = {api_hash}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
