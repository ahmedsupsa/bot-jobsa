-- Schedule worker to run every 30 minutes via pg_cron + pg_net
-- Requires pg_net extension (enabled by default on Supabase)

SELECT cron.schedule(
  'run-worker-every-30min',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url:='https://vnbaksiabcdnnnoglycr.supabase.co/functions/v1/worker',
      headers:='{"Content-Type":"application/json","x-worker-secret":"1e4f8453d44b4d4f8719b7e9d241cc4e"}'::jsonb,
      body:='{}'::jsonb
    ) AS request_id;
  $$
);
