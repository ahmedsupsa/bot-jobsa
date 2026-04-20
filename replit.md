# Jobbots — Auto-Apply Platform

A job application automation platform. Users register via Telegram bot, upload CVs, and the system automatically matches their profiles with job openings and submits applications on their behalf using AI-generated cover letters.

## Architecture

- **`admin_frontend/`** — Next.js 14 admin dashboard + user portal (port 5000)
- **`worker/main.py`** — Auto-Apply Worker: periodic Python service that matches users to jobs and sends emails via Resend
- **`database/`** — Supabase database schemas and utilities
- **`scripts/`** — Admin utility scripts (e.g., generating activation codes)
- **`config.py`** — Central configuration loaded from environment variables

## Workflows

- **Start application** — Next.js admin frontend (`cd admin_frontend && npm run dev`) on port 5000
- **Auto Apply Worker** — Python worker (`python3 worker/main.py`) — runs every 30 minutes

## Required Secrets

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_KEY` — Supabase API key (service role recommended)
- `RESEND_API_KEY` — Resend email API key
- `RESEND_FROM_EMAIL` — Sender email for Resend
- `ADMIN_PASSWORD` — Password for the web admin panel
- `ADMIN_SECRET` — JWT signing secret for admin sessions

## Optional Secrets

- `BOT_TOKEN` — Telegram Bot token (from @BotFather)
- `ADMIN_TELEGRAM_IDS` — Comma-separated Telegram user IDs for admin access
- `GEMINI_API_KEY` — Google Gemini API key (for AI cover letter generation)
- `JOBS_SOURCE_CHANNEL_ID` — Telegram channel ID to import jobs from
- `RESEND_FROM_NAME` — Display name for emails (default: "Jobsa")
- `AUTO_APPLY_INTERVAL` — Seconds between worker cycles (default: 1800)

## Dependencies

- Python: `httpx`, `python-dotenv` (installed via pip)
- Node.js: `admin_frontend/package.json` — Next.js 14, Tailwind CSS, framer-motion, @supabase/supabase-js

## Database (Supabase)

Tables: `users`, `admin_jobs`, `applications`, `job_fields`, `user_settings`, `user_cvs`, `user_job_preferences`
Storage bucket: `cvs` — stores user CV files

## Replit Environment Notes

- The Next.js dev server runs on port 5000 with `0.0.0.0` host binding for Replit proxy compatibility
- `allowedDevOrigins` in `next.config.mjs` permits requests from Replit's proxy domains
- Google Fonts are loaded via CSS `@import` in `globals.css` to avoid hydration mismatches
- All pages are fully responsive (mobile/tablet/desktop) with RTL Arabic layout and cross-browser support (iOS Safari, Firefox, Chrome, Edge)
