# Jobbots — Auto-Apply Platform

A Telegram bot for job applications (Arabic language), with a Flask admin panel, Next.js admin dashboard, and a user-facing web portal.

## Architecture

- **`main.py`** — Telegram bot entry point (python-telegram-bot v21, polling or webhook mode)
- **`admin/app.py`** — Flask admin web panel + user portal API (port 8080)
- **`admin/portal_api.py`** — Flask Blueprint for user portal REST API (`/api/portal/*`)
- **`admin_frontend/`** — Next.js admin dashboard + user portal (port 5000, proxies API calls to Flask)
- **`admin_frontend/app/portal/`** — User-facing web portal (login, dashboard, applications, CV, settings)
- **`admin_frontend/lib/portal-auth.ts`** — JWT token management for user portal
- **`database/`** — Supabase database layer
- **`handlers/`** — Telegram bot command/message handlers
- **`services/`** — Business logic (auto-apply, cover letters, announcements, etc.)
- **`config.py`** — Configuration loaded from environment variables

## User Portal

- URL: `/portal/` (login at `/portal/login`)
- Auth: JWT token stored in localStorage, signed with ADMIN_SECRET
- Login: activation code (same codes from admin panel)
- Pages: dashboard, applications, profile, CV upload, email settings

## Workflows

- **Start application** — Next.js admin frontend (`cd admin_frontend && npm run dev`) on port 5000
- **Admin Backend** — Flask admin panel (`python admin/app.py`) on port 8080
- **Telegram Bot** — Telegram bot polling (`python main.py`) as console service

## Required Secrets

- `BOT_TOKEN` — Telegram Bot token (from @BotFather)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_KEY` — Supabase API key (service role recommended)
- `ADMIN_TELEGRAM_IDS` — Comma-separated Telegram user IDs for admin access
- `ADMIN_PASSWORD` — Password for the web admin panel
- `ADMIN_SECRET` — Flask session secret key

## Optional Secrets

- `GEMINI_API_KEY` — Google Gemini API key (for AI cover letter generation)
- `JOBS_SOURCE_CHANNEL_ID` — Telegram channel ID to import jobs from
- `RESEND_API_KEY` — Resend email API key
- `RESEND_FROM_EMAIL` — Sender email for Resend

## Running in Webhook Mode

Set these environment variables to enable webhook instead of polling:
- `USE_WEBHOOK=true`
- `WEBHOOK_URL=https://your-domain.com`
- `WEBHOOK_PORT=8080`
- `WEBHOOK_PATH=webhook`

## Dependencies

- Python: `requirements.txt` — python-telegram-bot, supabase, flask, google-generativeai, etc.
- Node.js: `admin_frontend/package.json` — Next.js 14, Tailwind CSS, framer-motion
