-- Migration: إضافة match_score و job_fingerprint لجدول applications
-- يُشغَّل مرة واحدة في Supabase SQL Editor

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS match_score     SMALLINT,
  ADD COLUMN IF NOT EXISTS job_fingerprint TEXT;

COMMENT ON COLUMN applications.match_score IS
  'نسبة توافق AI بين المستخدم والوظيفة (0-100) — تُحسب قبل كل تقديم';

COMMENT ON COLUMN applications.job_fingerprint IS
  'بصمة بيانات الوظيفة (SHA-256 مختصر) — يُكشف تغيير الوظيفة للسماح بإعادة التقديم';
