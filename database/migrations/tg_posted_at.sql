-- Migration: أضف عمود tg_posted_at لتتبع وقت نشر كل وظيفة في القناة
-- شغّله في Supabase SQL Editor مرة واحدة

ALTER TABLE admin_jobs
  ADD COLUMN IF NOT EXISTS tg_posted_at timestamptz;

-- فهرس للبحث السريع عند عدّ منشورات اليوم
CREATE INDEX IF NOT EXISTS idx_admin_jobs_tg_posted_at
  ON admin_jobs (tg_posted_at)
  WHERE tg_posted_at IS NOT NULL;
