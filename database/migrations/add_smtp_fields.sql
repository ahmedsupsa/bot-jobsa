-- ─── ترقية نظام الإرسال: SMTP لكل مستخدم ───
-- شغّل هذا الملف في Supabase SQL Editor مرة واحدة

-- 1. إضافة حقول SMTP إلى user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS smtp_email TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS smtp_host TEXT DEFAULT 'smtp.gmail.com';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 465;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS smtp_app_password_encrypted TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS email_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS last_email_test_at TIMESTAMPTZ;

-- 2. إضافة حقول التتبع إلى applications
ALTER TABLE applications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS provider_used TEXT DEFAULT 'smtp';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS error_reason TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
