-- تشغيل هذا الملف في Supabase SQL Editor لإنشاء الجداول

-- رموز التفعيل (يضيفها الأدمن يدوياً أو عبر لوحة)
CREATE TABLE IF NOT EXISTS activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  used_by_user_id UUID,
  subscription_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- المستخدمون
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  activation_code_id UUID REFERENCES activation_codes(id),
  subscription_ends_at TIMESTAMPTZ,
  full_name TEXT,
  phone TEXT,
  age INTEGER,
  city TEXT,
  application_language TEXT DEFAULT 'ar',  -- ar | en (لا يُغيّر حتى انتهاء الاشتراك)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إعدادات المستخدم (إيميل، قالب، إلخ)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  app_password_encrypted TEXT,  -- كلمة مرور التطبيق (يفضل تشفيرها لاحقاً)
  email_change_count INTEGER DEFAULT 0,          -- عدد مرات تغيير الإيميل داخل النافذة
  email_change_window_start TIMESTAMPTZ,         -- بداية نافذة الـ 30 يوم
  template_type TEXT DEFAULT 'normal',  -- formal | normal | professional
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- دعم الجداول القديمة
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS email_change_count INTEGER DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS email_change_window_start TIMESTAMPTZ;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS sender_email_alias TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS sender_email_alias_created_at TIMESTAMPTZ;

-- السير الذاتية (ملف واحد فقط للمستخدم - نتحقق بالكود)
CREATE TABLE IF NOT EXISTS user_cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL,   -- telegram file_id للمعاينة في البوت
  file_name TEXT,
  storage_path TEXT,      -- مسار الملف في Supabase Storage (bucket cvs)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- إضافة العمود إن كان الجدول موجوداً مسبقاً (شغّل مرة واحدة)
ALTER TABLE user_cvs ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- المجالات/الوظائف المفضلة (عامة وخاصة)
CREATE TABLE IF NOT EXISTS job_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  category TEXT NOT NULL,  -- general | specific
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- تفضيلات المستخدم للوظائف (علاقة many-to-many)
CREATE TABLE IF NOT EXISTS user_job_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_field_id UUID NOT NULL REFERENCES job_fields(id) ON DELETE CASCADE,
  UNIQUE(user_id, job_field_id)
);

-- سجل التقديمات
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  job_field_id UUID REFERENCES job_fields(id),
  job_id UUID REFERENCES admin_jobs(id),
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- إضافة عمود job_id إن كان الجدول موجوداً
ALTER TABLE applications ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES admin_jobs(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_user_job ON applications(user_id, job_id) WHERE job_id IS NOT NULL;

-- فهارس
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_job_preferences_user ON user_job_preferences(user_id);

-- إدراج مجالات افتراضية (عامة وخاصة) - يمكن توسيعها
-- إدراج مجالات افتراضية (شغّل مرة واحدة)
INSERT INTO job_fields (name_ar, name_en, category) VALUES
  ('تقنية معلومات', 'IT', 'general'),
  ('مالية ومحاسبة', 'Finance & Accounting', 'general'),
  ('موارد بشرية', 'HR', 'general'),
  ('مبيعات وتسويق', 'Sales & Marketing', 'general'),
  ('هندسة', 'Engineering', 'general'),
  ('طب وصحة', 'Healthcare', 'general'),
  ('تعليم', 'Education', 'general'),
  ('برمجة وتطوير', 'Programming', 'specific'),
  ('تصميم جرافيك', 'Graphic Design', 'specific'),
  ('إدارة مشاريع', 'Project Management', 'specific'),
  ('دعم فني', 'Technical Support', 'specific'),
  ('كتابة ومحتوى', 'Content Writing', 'specific')
ON CONFLICT DO NOTHING;

-- مثال: إضافة كود تفعيل (شغّل واستبدل الكود والأيام حسب الحاجة)
-- INSERT INTO activation_codes (code, subscription_days) VALUES ('MYCODE123', 30);

-- الوظائف التي يضيفها الأدمن (تظهر في البوت)
CREATE TABLE IF NOT EXISTS admin_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  title_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  company TEXT,
  link_url TEXT,
  application_email TEXT,   -- إيميل استقبال التقديمات
  specializations TEXT,     -- تخصصات (مفصولة بفاصلة أو سطر)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_jobs ADD COLUMN IF NOT EXISTS application_email TEXT;
ALTER TABLE admin_jobs ADD COLUMN IF NOT EXISTS specializations TEXT;

-- الإعلانات التي يرسلها الأدمن للمستخدمين
CREATE TABLE IF NOT EXISTS admin_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  body_text TEXT NOT NULL,
  image_file_id TEXT,       -- صورة اختيارية (file_id تليجرام)
  expires_at TIMESTAMPTZ,   -- انتهاء عرض الإعلان (NULL = بدون انتهاء)
  repeat_count INTEGER DEFAULT 1, -- عدد مرات إرسال الإعلان لكل مستخدم
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS image_file_id TEXT;
ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS repeat_count INTEGER DEFAULT 1;

-- تتبع مرات إرسال كل إعلان لكل مستخدم
CREATE TABLE IF NOT EXISTS admin_announcement_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES admin_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  send_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, user_id)
);

-- أدمنين لوحة التحكم (رقم تليجرام أو اسم مستخدم)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_jobs_active ON admin_jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_announcements_active ON admin_announcements(is_active);

-- ─── حفظ الإيميل في user_settings لا يعمل؟ ───
-- ضع في البيئة SUPABASE_KEY = مفتاح service_role / secret من لوحة Supabase (ليس المفتاح العام anon).
-- مفتاح الخدمة يتجاوز RLS. إذا بقي المنع، نفّذ (للتشخيص فقط):
-- ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;
