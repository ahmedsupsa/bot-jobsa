-- Migration: Add cv_profile column for structured CV caching
-- Run once in Supabase SQL Editor
-- Part of Gemini cost reduction (75-85% savings)

ALTER TABLE user_cvs ADD COLUMN IF NOT EXISTS cv_profile jsonb;

-- Optional index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_cvs_cv_profile ON user_cvs USING GIN (cv_profile)
  WHERE cv_profile IS NOT NULL;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_cvs'
  AND column_name IN ('cv_parsed_text', 'cv_parsed_at', 'cv_profile');
