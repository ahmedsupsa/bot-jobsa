-- Migration: taxonomy columns for user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS taxonomy_major_ids  jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS taxonomy_keywords   jsonb DEFAULT '[]'::jsonb;
