-- Migration: إضافة أعمدة Decision Engine لجدول applications
-- يُشغَّل مرة واحدة في Supabase SQL Editor

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS skip_reason      TEXT,
  ADD COLUMN IF NOT EXISTS decision_reasons JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS missing_skills   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS matched_skills   JSONB DEFAULT '[]'::jsonb;

-- السماح بقيمة 'skipped' في عمود status
ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
    CHECK (status IN ('sent', 'error', 'skipped'));

COMMENT ON COLUMN applications.skip_reason IS
  'سبب عدم التقديم بشكل موجز — يُملأ فقط إذا كانت status = skipped';

COMMENT ON COLUMN applications.decision_reasons IS
  'أسباب قرار AI التفصيلية كمصفوفة نصوص';

COMMENT ON COLUMN applications.missing_skills IS
  'المهارات والمتطلبات الغائبة عن السيرة الذاتية';

COMMENT ON COLUMN applications.matched_skills IS
  'المهارات والمتطلبات المطابقة في السيرة الذاتية';
