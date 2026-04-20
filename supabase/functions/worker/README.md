# Auto Apply Worker — Supabase Edge Function

## المتغيرات المطلوبة (Supabase Dashboard → Settings → Edge Functions)

```
SUPABASE_URL               رابط مشروع Supabase
SUPABASE_SERVICE_ROLE_KEY  مفتاح الخدمة (service_role)
RESEND_API_KEY             مفتاح Resend
RESEND_FROM_EMAIL          إيميل الإرسال
RESEND_FROM_NAME           اسم المرسل (اختياري)
GEMINI_API_KEY             مفتاح Google Gemini
WORKER_SECRET              كلمة سر لحماية الـ endpoint (اختياري)
```

## الرفع على Supabase

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy worker
```

## إعداد الكرون (كل 30 دقيقة)

شغّل هذا في Supabase SQL Editor:

```sql
-- تأكد من تفعيل الإضافتين
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- جدولة تشغيل الـ worker كل 30 دقيقة
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

## تشغيل يدوي للاختبار

```bash
curl -X POST https://<project-ref>.functions.supabase.co/worker \
  -H "Authorization: Bearer <WORKER_SECRET>"
```
