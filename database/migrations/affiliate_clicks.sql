-- تتبّع زيارات روابط المسوّقين
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_code text NOT NULL,
  session_id  text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_code    ON affiliate_clicks (affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_created ON affiliate_clicks (created_at);

-- تعليق: لتجنّب العدّ المضاعف للجلسة الواحدة
-- يتحقق الـ API من وجود session_id قبل الإدراج
