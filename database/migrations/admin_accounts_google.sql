-- إضافة حقل Google Email لحسابات الأدمن
-- شغّلها في Supabase SQL Editor

ALTER TABLE admin_accounts
  ADD COLUMN IF NOT EXISTS google_email TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS admin_accounts_google_email_idx ON admin_accounts(google_email);
