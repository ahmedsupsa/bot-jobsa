-- system_settings — جدول لحفظ إعدادات النظام العامة
-- شغّله مرة واحدة في Supabase SQL Editor

CREATE TABLE IF NOT EXISTS system_settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- إدراج قيمة افتراضية لإعداد الإيقاف
INSERT INTO system_settings (key, value)
VALUES ('applications_pause', '{"paused": false, "until": null, "reason": "", "paused_at": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;
