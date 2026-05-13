-- Migration: إضافة عمود match_score لتخزين نسبة توافق AI لكل تقديم
-- يُشغَّل مرة واحدة في Supabase SQL Editor

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS match_score SMALLINT;

COMMENT ON COLUMN applications.match_score IS
  'نسبة توافق AI بين المستخدم والوظيفة (0-100) — تُحسب قبل كل تقديم';
