import os, re

ENV_PATH = os.path.join(os.path.dirname(__file__), "admin_frontend", ".env")
API_ID = "29840400"
API_HASH = "367a0fbdde42f2b8908c949400be091e"
CHANNELS = "jwkri"

def save(key, val):
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        txt = f.read()
    txt = re.sub(rf"^{key}=.*", f"{key}={val}", txt, flags=re.MULTILINE)
    if f"{key}=" not in txt:
        txt += f"\n{key}={val}\n"
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.write(txt)
    print(f"OK: {key}")

import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError

async def main():
    phone = input("Phone (+xxx): ").strip()
    s = StringSession()
    c = TelegramClient(s, int(API_ID), API_HASH)
    await c.connect()
    await c.send_code_request(phone)
    code = input("Code from Telegram: ").strip()
    try:
        await c.sign_in(phone, code)
    except SessionPasswordNeededError:
        pw = input("2FA password: ").strip()
        await c.sign_in(password=pw)
    save("TELEGRAM_SESSION_STRING", s.save())
    save("TELEGRAM_EXTRA_CHANNELS", CHANNELS)
    print("Done! You can now run the bot.")
    await c.disconnect()

asyncio.run(main())
