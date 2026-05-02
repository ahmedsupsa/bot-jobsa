-- أضف أعمدة مصدر التغريدة لجدول admin_jobs
-- شغّل هذا الـ SQL مرة واحدة في Supabase > SQL Editor

ALTER TABLE admin_jobs
  ADD COLUMN IF NOT EXISTS tweet_uid TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS source_account TEXT;

-- فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_admin_jobs_tweet_uid ON admin_jobs(tweet_uid);
CREATE INDEX IF NOT EXISTS idx_admin_jobs_source_account ON admin_jobs(source_account);
