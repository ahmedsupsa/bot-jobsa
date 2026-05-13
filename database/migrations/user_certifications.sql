-- Migration: إنشاء جدول user_certifications للشهادات والرخص المهنية
-- يُشغَّل مرة واحدة في Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_certifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('license', 'certificate', 'course', 'qiyas', 'other')),
  name        TEXT NOT NULL,
  issuer      TEXT,
  issued_at   DATE,
  expires_at  DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_certifications_user_id_idx ON user_certifications(user_id);

-- RLS
ALTER TABLE user_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_certifications"
  ON user_certifications FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "users_insert_own_certifications"
  ON user_certifications FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "users_update_own_certifications"
  ON user_certifications FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "users_delete_own_certifications"
  ON user_certifications FOR DELETE
  USING (auth.uid()::text = user_id::text);

COMMENT ON TABLE user_certifications IS
  'شهادات ورخص المستخدمين المهنية — تُستخدم في محرك التطابق الذكي للـ Worker';
