import os, re, sys, asyncio

ENV_PATH = os.path.join(os.path.dirname(__file__), "admin_frontend", ".env")
API_ID = "29840400"
API_HASH = "367a0fbdde42f2b8908c949400be091e"
CHANNELS = "jwkri"

def update_env(key: str, value: str):
    if not os.path.exists(ENV_PATH):
        print(f"ENV not found: {ENV_PATH}")
        return
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        text = f.read()
    text = re.sub(rf"^{key}=.*", f"{key}={value}", text, flags=re.MULTILINE)
    if f"{key}=" not in text:
        text += f"\n{key}={value}\n"
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Saved {key} to .env")

async def main():
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    from telethon.errors import SessionPasswordNeededError

    phone = sys.argv[1].strip() if len(sys.argv) > 1 else None
    code  = sys.argv[2].strip() if len(sys.argv) > 2 else None
    if not phone:
        print("Usage: python generate_session.py +97333926430 [code]")
        sys.exit(1)

    session = StringSession()
    client = TelegramClient(session, int(API_ID), API_HASH)
    await client.connect()

    if await client.is_user_authorized():
        print("Already authorized")
    else:
        if code is None:
            await client.send_code_request(phone)
            print(f"Code sent to {phone}")
            print(f"Run: python generate_session.py {phone} YOUR_CODE")
            await client.disconnect()
            return
        # Always request a fresh code to get the correct hash
        await client.send_code_request(phone)
        try:
            await client.sign_in(phone, code)
        except SessionPasswordNeededError:
            pw = os.environ.get("TG_PASSWORD")
            if not pw:
                print("2FA required. Set env TG_PASSWORD and re-run")
                await client.disconnect()
                return
            await client.sign_in(password=pw)

    session_str = session.save()
    update_env("TELEGRAM_SESSION_STRING", session_str)
    update_env("TELEGRAM_EXTRA_CHANNELS", CHANNELS)
    print("Done!")
    await client.disconnect()

asyncio.run(main())
