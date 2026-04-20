# Jobbots — منصة التقديم التلقائي على الوظائف

A job application automation platform. Users register via activation codes or email, upload CVs, and the system automatically matches their profiles with job openings and submits applications using AI-generated cover letters.

## Architecture

- **`admin_frontend/`** — Next.js 14 admin dashboard + user portal (port 5000), deployed on Vercel
- **`supabase/functions/worker/`** — Auto-Apply Worker as a Supabase Edge Function (Deno/TypeScript)
- **`worker/main.py`** — Python worker (development/testing only, not used in production)
- **`database/`** — Supabase database schemas and utilities
- **`scripts/`** — Admin utility scripts

## Production Architecture

```
Vercel (Next.js frontend)
    ↓ API routes for admin/portal UI
Supabase (database + storage + edge functions)
    → supabase/functions/worker  ← تشغيل تلقائي كل 30 دقيقة عبر pg_cron
    → Resend (إرسال إيميلات)
    → Gemini AI (رسائل التغطية)
```

## Workflows (Replit — للتطوير فقط)

- **Start application** — Next.js dev server (`cd admin_frontend && npm run dev`) on port 5000
- **Auto Apply Worker** — Python worker for local testing only (not production)

## Deploying the Edge Function

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy worker
```

## Supabase Cron Setup (SQL Editor)

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'auto-apply-worker',
  '*/30 * * * *',
  $$
    select net.http_post(
      url := 'https://<project-ref>.functions.supabase.co/worker',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <WORKER_SECRET>',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

## Required Secrets (Vercel + Supabase Edge Function)

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `RESEND_API_KEY` — Resend email API key
- `RESEND_FROM_EMAIL` — Sender email
- `RESEND_FROM_NAME` — Sender display name (default: Jobbots)
- `GEMINI_API_KEY` — Google Gemini API key
- `WORKER_SECRET` — Secret to protect the Edge Function endpoint
- `SUPABASE_WORKER_URL` — Full URL of the Edge Function (for admin trigger button)

## Database (Supabase)

Tables: `users`, `admin_jobs`, `applications`, `job_fields`, `user_settings`, `user_cvs`, `user_job_preferences`, `worker_logs`, `push_subscriptions`
Storage bucket: `cvs` — stores user CV files
