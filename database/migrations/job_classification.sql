-- Migration: إضافة أعمدة التصنيف التلقائي للوظائف
-- شغّلها مرة واحدة في Supabase SQL Editor

ALTER TABLE admin_jobs ADD COLUMN IF NOT EXISTS is_classified    boolean   DEFAULT false;
ALTER TABLE admin_jobs ADD COLUMN IF NOT EXISTS job_type         text      DEFAULT 'job';
ALTER TABLE admin_jobs ADD COLUMN IF NOT EXISTS gender_req       text      DEFAULT 'unknown';
ALTER TABLE admin_jobs ADD COLUMN IF NOT EXISTS mapped_majors    jsonb     DEFAULT '[]';
ALTER TABLE admin_jobs ADD COLUMN IF NOT EXISTS confidence_score numeric   DEFAULT 0;
ALTER TABLE admin_jobs ADD COLUMN IF NOT EXISTS classified_at    timestamptz;

-- فهرس لتسريع جلب الوظائف غير المصنفة
CREATE INDEX IF NOT EXISTS admin_jobs_unclassified_idx
  ON admin_jobs (is_classified, is_active, created_at)
  WHERE is_classified = false AND is_active = true;

-- فهرس لتسريع جلب الوظائف الجاهزة للتقديم
CREATE INDEX IF NOT EXISTS admin_jobs_ready_idx
  ON admin_jobs (is_classified, is_active, job_type, created_at DESC)
  WHERE is_classified = true AND is_active = true;
