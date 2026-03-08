-- سياسات التخزين (Storage) لرفع السير الذاتية إلى bucket "cvs"
-- نفّذ هذا الملف من Supabase → SQL Editor إذا كان الـ bucket فارغاً بعد رفع ملف من البوت.
-- يتطلب أن يكون الـ bucket "cvs" موجوداً (أنشئه من Storage → New bucket).

-- السماح بالرفع (INSERT) إلى bucket cvs
CREATE POLICY "Allow uploads to cvs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'cvs');

-- السماح بالقراءة (SELECT) من bucket cvs (للمعاينة أو التحميل لاحقاً)
CREATE POLICY "Allow read cvs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'cvs');

-- اختياري: السماح بالتحديث والحذف لنفس المستخدم لاحقاً إن احتجت
-- CREATE POLICY "Allow update cvs" ON storage.objects FOR UPDATE USING (bucket_id = 'cvs');
-- CREATE POLICY "Allow delete cvs" ON storage.objects FOR DELETE USING (bucket_id = 'cvs');
