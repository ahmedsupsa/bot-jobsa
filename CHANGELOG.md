# سجل التحديثات — Jobbots
> آخر تحديث: 18 مايو 2026

---

## 🚀 إصدار 18 مايو 2026

### 1. تخفيض تكاليف Gemini AI بنسبة 75–85%

**الملف:** `supabase/functions/worker/index.ts`

#### المشكلة
كان الـ worker يستدعي Gemini لكل وظيفة لكل مستخدم بـ prompt طويل يشمل كامل نص السيرة الذاتية — تكلفة عالية جداً.

#### الحل
- **تخزين ملف CV منظّم (`cv_profile`)**: يُحلَّل السيرة الذاتية مرة واحدة فقط ويُخزَّن كـ JSON في `user_cvs.cv_profile` — لا تحليل مكرر.
- **تقييم محلي بدون AI (`computeLocalScore`)**: يُحسب score للوظيفة محلياً من المهارات والتخصص ومستوى الخبرة — الوظائف دون 20/100 تُحذف مباشرة بدون استدعاء Gemini.
- **قوالب رسائل التغطية (`buildCoverLetterTemplate`)**: وظائف عادية (score < 78) تحصل على رسالة من قالب جاهز بدون AI — Gemini فقط للوظائف المناسبة جداً.
- **Prompt مختصر**: بدل إرسال كامل نص السيرة (3000 حرف)، يُرسل ملف منظّم (200 حرف).

#### Migration مطلوب (Supabase SQL Editor)
```sql
ALTER TABLE user_cvs ADD COLUMN IF NOT EXISTS cv_profile jsonb;
```
**ملف:** `database/migrations/cv_profile_cache.sql`

---

### 2. إعادة تصميم الشريط الجانبي للوحة التحكم

**الملف:** `admin_frontend/components/shell.tsx`

#### التغييرات
- تنظيم جميع روابط التنقل في **5 مجموعات قابلة للطي** (Accordion):
  - لوحة التحكم (الرئيسية، حالة النظام)
  - إدارة المستخدمين (المستخدمون، أكواد التفعيل، إدارة المسؤولين)
  - الوظائف والتقديم (الوظائف، مراقبة التقديمات، قناة Telegram)
  - التواصل والعملاء (الدردشة، CRM، الدعم الفني، الإشعارات، البريد)
  - المتجر والربح (المتجر، برنامج الربح، المالية)
- المجموعة النشطة تفتح تلقائياً عند تغيير الصفحة
- أيقونة `ChevronDown` تدور 180° عند الفتح
- أزرار الأسفل (الوضع الليلي / تسجيل الخروج) مباشرة تحت المحتوى بدون فراغ
- لا فراغ بين آخر مجموعة وأزرار الأسفل — كل شيء في container واحد يسكرول

---

### 3. إصلاح بانر لوحة التحكم

**الملف:** `admin_frontend/components/dashboard.tsx`

- حذف البانر البرتقالي (amber) الذي كان يظهر تحذيراً غير دقيق
- استبداله بكارت "حالة التقديمات" بألوان محايدة تتناسب مع التصميم العام

---

### 4. إصلاح البوت — توقف التقديمات (0 تقديم)

**الملف:** `supabase/functions/worker/index.ts`

#### المشكلة
بعد إضافة `computeLocalScore`، كانت العقوبات أقوى من اللازم:
```
خريج جديد + وظيفة متوسطة (mid):
  50 - 25 (exp=0) - 20 (fresh_graduate+mid) = 5/100
  → أقل من العتبة 38 → يُحذف بدون ما يصل Gemini
```
نتيجة: 0 تقديم لجميع المستخدمين رغم وجود وظائف مناسبة.

#### الإصلاح
- حذف عقوبة الخريج الجديد للوظائف المتوسطة (Gemini هو الحكم)
- تخفيف عقوبة senior من -40 → -20
- تخفيف عقوبة mid من -25 → -10
- تنزيل العتبة المحلية من **38 → 20** (فقط الحالات السيئة جداً تُحذف)

#### النتيجة
Gemini الآن يُقيّم الوظائف بدقة، والفلتر المحلي يوفّر API calls فقط للحالات الواضحة.

---

### 5. نشر Edge Function على Supabase

- تحديث `supabase/functions/worker/index.ts` ونشره مباشرة عبر Supabase CLI
- **Project:** `vnbaksiabcdnnnoglycr`
- يعمل تلقائياً كل 30 دقيقة عبر pg_cron

---

### 6. إصلاح إعدادات Cloudflare

**الدومين:** `jobbots.org`

| الإعداد | قبل | بعد |
|---------|-----|-----|
| `www.jobbots.org` Proxy | ⬜ DNS only | ☁️ Proxied |
| SSL Mode | `full` | `full (strict)` |

- **www proxied**: الموقع الآن يستفيد من حماية Cloudflare والـ CDN على كل الـ subdomains
- **SSL strict**: اتصال أكثر أماناً بين Cloudflare وـ Vercel

---

## 📋 ملاحظات تقنية

### صفحة قناة Telegram (`/admin/telegram-channel`)
- إحصائيات القناة: المشتركون، المنشورات، المشاهدات
- إرسال منشورات مخصصة وحفظها في DB
- تعديل أي منشور لجميع المشتركين فوراً
- حذف المنشورات من القناة نهائياً

### DB Columns المضافة
```sql
-- cv_profile cache
ALTER TABLE user_cvs ADD COLUMN IF NOT EXISTS cv_profile jsonb;

-- Telegram message tracking
ALTER TABLE admin_jobs ADD COLUMN IF NOT EXISTS tg_message_id bigint;
ALTER TABLE admin_jobs ADD COLUMN IF NOT EXISTS tg_views integer DEFAULT 0;
```

### Secrets المطلوبة (Supabase Edge Function)
تأكد من وجود هذه المتغيرات في Supabase → Edge Functions → Secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `WORKER_SECRET`
- `SMTP_ENCRYPTION_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
