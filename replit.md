# Jobbots — منصة التقديم التلقائي على الوظائف

A job application automation platform. Users register via activation codes or email, upload CVs, and the system automatically matches their profiles with job openings and submits applications using AI-generated cover letters.

## Architecture

- **`admin_frontend/`** — Next.js 14 admin dashboard + user portal (port 5000), deployed on Vercel
- **`supabase/functions/worker/`** — Auto-Apply Worker as a Supabase Edge Function (Deno/TypeScript)
- **`worker/main.py`** — Python worker (development/testing only, not used in production)
- **`worker/telegram_listener.py`** — Telethon personal account listener (monitors Telegram channels)
- **`database/`** — Supabase database schemas and utilities
- **`scripts/`** — Admin utility scripts

## Production Architecture

```
Vercel (Next.js frontend)
    ↓ API routes for admin/portal UI
Supabase (database + storage + edge functions)
    → supabase/functions/worker  ← تشغيل تلقائي كل 30 دقيقة عبر pg_cron
    → Resend (إرسال إيميلات)
    → Gemini AI (رسائل التغطية + استخراج الوظائف)

Replit (Python Worker — يعمل دائماً)
    → telegram_listener.py  ← Telethon يراقب قنوات Telegram الشخصية
    → main.py               ← جلب وظائف تويتر + استدعاء Edge Function
```

## Workflows (Replit)

- **Start application** — Next.js dev server (`cd admin_frontend && npm run dev`) on port 5000
- **Auto Apply Worker** — Python worker: يشغّل `telegram_listener.py` (Telethon) + جلب وظائف تويتر + استدعاء Supabase Edge Function كل 30 دقيقة

## Telegram Integration

### Bot (@jobbotssa_bot)
- Webhook على `/api/telegram/webhook` — يستقبل رسائل القنوات ويستخرج الوظائف عبر Gemini
- ينشر الوظائف تلقائياً في قناة الوظائف ويحفظ `tg_message_id`

### Telethon Personal Listener (`worker/telegram_listener.py`)
- يستخدم `TELEGRAM_SESSION_STRING` لحساب +973 33926430
- عند الاتصال: يجلب آخر 10 أيام من رسائل كل قناة مشترك فيها (حتى 200 رسالة/قناة)
- يراقب الرسائل الجديدة في الوقت الفعلي
- يستخرج الوظائف عبر Gemini ويحفظها في `admin_jobs` مع `tg_message_id`

### صفحة إدارة القناة (`/admin/telegram-channel`)
- إحصائيات: عدد المشتركين، إجمالي المنشورات، إجمالي المشاهدات
- إرسال منشور مخصص للقناة (يُحفظ في DB ويظهر في القائمة)
- قائمة بآخر 20 منشور مع:
  - **فتح** في Telegram مباشرة
  - **تعديل** النص (يتعدّل لجميع المشتركين عبر `editMessageText`)
  - **حذف** من القناة (يُحذف لجميع المشتركين نهائياً)

### DB Columns (admin_jobs)
```sql
ALTER TABLE admin_jobs ADD COLUMN IF NOT EXISTS tg_message_id bigint;
ALTER TABLE admin_jobs ADD COLUMN IF NOT EXISTS tg_views integer DEFAULT 0;
```

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
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — VAPID public key for push notifications
- `VAPID_PRIVATE_KEY` — VAPID private key for push notifications
- `VAPID_EMAIL` — VAPID contact email (default: mailto:admin@jobbots.app)
- `TELEGRAM_BOT_TOKEN` — Bot token (@jobbotssa_bot)
- `TELEGRAM_JOB_CHANNEL_ID` — Job channel ID (e.g. -1003049097618)
- `TELEGRAM_ADMIN_CHAT_ID` — Admin chat ID for notifications
- `TELEGRAM_API_ID` — Telethon API ID
- `TELEGRAM_API_HASH` — Telethon API Hash
- `TELEGRAM_SESSION_STRING` — Telethon session string (generated once)

### Edge Function env vars (Supabase Dashboard → Edge Functions → Secrets)

- `APP_URL` — Full URL of the deployed Next.js app (e.g., `https://jobbots.vercel.app`) — enables worker to send achievement push notifications after each cycle

## Smart Push Notifications

Admin page `/notifications` supports 6 segments:
- `no_email` — active users without linked email
- `no_cv` — active users without uploaded CV  
- `expiring` — subscription ending within 3 days
- `expired` — users with expired subscription
- `achievement` — users who received job applications today
- `all` — broadcast to all subscribers

Each notification is personalized with `{name}` → user's first name. Worker automatically sends achievement notifications via `/api/internal/notify-achievements` (secured by WORKER_SECRET).

## Store Purchase → Auto Account Creation Flow

1. User fills in name, email, phone in checkout modal → redirected to StreamPay
2. After successful payment → `/store/success` → calls `/api/store/verify`
3. Verify API auto-creates user account (or extends existing subscription)
4. Token is saved to browser (localStorage + cookie) → user is logged in immediately
5. Email login (`/portal/login` → tab "بريد إلكتروني") works automatically since `user_settings.email` is populated

**DB migration (run once in Supabase SQL Editor):**
```sql
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS user_phone text;
```

## Discount Codes

Admin → Store → tab **«أكواد الخصم»** to create/manage codes.
- Types: `percent` (0–100%) or `fixed` (SAR amount).
- Optional product restriction, usage limit, and expiry date.
- Customer enters code in store checkout modal → validates live via `/api/store/validate-discount` → applied amount is sent through Tamara/StreamPay/bank-transfer.
- The legacy automatic 15% bank-transfer discount still applies only if no explicit discount code is used.
- Migration: `database/migrations/discount_codes.sql` — creates `discount_codes` table + adds `discount_code`, `discount_code_id`, `original_amount` columns to `store_orders`.

## Database (Supabase)

Tables: `users`, `admin_jobs`, `applications`, `job_fields`, `user_settings`, `user_cvs`, `user_job_preferences`, `worker_logs`, `push_subscriptions`, `store_orders`, `store_products`, `activation_codes`, `affiliates`, `affiliate_referrals`
Storage bucket: `cvs` — stores user CV files

## DB Migration — cv_profile (تشغيل مرة واحدة في Supabase SQL Editor)

```sql
ALTER TABLE user_cvs ADD COLUMN IF NOT EXISTS cv_profile jsonb;
```
ملف جاهز: `database/migrations/cv_profile_cache.sql`

---

## تحديثات اليوم — 18 مايو 2026

### Telegram Channel Admin Page
- صفحة جديدة `/admin/telegram-channel` في لوحة التحكم
- إحصائيات القناة: المشتركون، المنشورات، المشاهدات
- إرسال منشورات مخصصة مع حفظها في DB
- تعديل أي منشور (يتعدّل لجميع المشتركين فوراً عبر `editMessageText`)
- حذف المنشورات من القناة لجميع المستخدمين نهائياً

### Historical Telegram Fetch
- عند كل إعادة تشغيل للـ Worker، يجلب آخر 10 أيام من رسائل كل قناة
- الوظائف المكررة محمية بـ `tweet_uid`

### tg_message_id Tracking
- كل وظيفة تُنشر في القناة (يدوياً أو بالبوت) يُحفظ معها `tg_message_id`
- يتيح التعديل والحذف والربط المباشر بالمنشور في Telegram
