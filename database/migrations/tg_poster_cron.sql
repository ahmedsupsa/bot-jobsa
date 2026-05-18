-- pg_cron: تشغيل tg-poster Edge Function كل 10 دقائق
-- شغّله في Supabase SQL Editor مرة واحدة بعد deploy الـ Edge Function

-- تأكد أن الإضافات مفعّلة
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- حذف الجدولة القديمة إن وجدت
select cron.unschedule('tg-poster') where exists (
  select 1 from cron.job where jobname = 'tg-poster'
);

-- جدولة جديدة: كل 10 دقائق
select cron.schedule(
  'tg-poster',
  '*/10 * * * *',
  $$
    select net.http_post(
      url := 'https://vnbaksiabcdnnnoglycr.supabase.co/functions/v1/tg-poster',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.worker_secret', true),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- تحقق من الجداول النشطة
select jobname, schedule, active from cron.job order by jobname;
