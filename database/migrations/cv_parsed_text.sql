-- Migration: إضافة عمود cv_parsed_text لتخزين ملخص السيرة الذاتية المُعالَج بالذكاء الاصطناعي
-- يُشغَّل مرة واحدة في Supabase SQL Editor

ALTER TABLE user_cvs
  ADD COLUMN IF NOT EXISTS cv_parsed_text TEXT,
  ADD COLUMN IF NOT EXISTS cv_parsed_at   TIMESTAMPTZ;

COMMENT ON COLUMN user_cvs.cv_parsed_text IS
  'ملخص منظّم للسيرة الذاتية يُنتجه Gemini مرة واحدة ويُستخدم في كل تقديم لتوفير التوكن';
COMMENT ON COLUMN user_cvs.cv_parsed_at IS
  'وقت آخر تحليل للسيرة الذاتية — يُعاد التحليل إذا رُفعت نسخة جديدة';
