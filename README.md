# Jobbots - التقديم التلقائي على الوظائف (SMTP Worker)

هذا المشروع هو نظام مؤتمت للتقديم على الوظائف عبر البريد الإلكتروني (SMTP).

## المتطلبات

- Python 3.10+
- حساب Supabase (قاعدة بيانات)
- إيميل Gmail (لاستخدامه في SMTP للتقديم)

## الإعداد

1. **إعداد Supabase**
   - ادخل إلى [Supabase Dashboard](https://supabase.com/dashboard) → مشروعك.
   - من **SQL Editor** شغّل محتوى الملف `database/schema.sql` لإنشاء الجداول.
   - من **Settings → API** انسخ:
     - Project URL → `SUPABASE_URL`
     - anon/public key أو Service Role key → `SUPABASE_KEY`

2. **ملف البيئة `.env`**
   - انسخ `.env.example` إلى `.env`
   - املأ القيم:
     ```
     SUPABASE_URL=https://xxx.supabase.co
     SUPABASE_KEY=المفتاح_الذي_نسخته
     ```

3. **تشغيل الـ Worker**
   ```bash
   python worker/main.py
   ```

## ملاحظات
- **كلمة مرور التطبيق (Gmail)**: استخدم "كلمة مرور التطبيقات" من Google لتشغيل إرسال الإيميلات عبر SMTP.

(تم حذف جميع الإشارات الخاصة ببوت تليجرام).
