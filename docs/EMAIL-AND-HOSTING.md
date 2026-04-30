# لماذا لا يصل البريد من بعض الاستضافات؟

## السبب

البوت يرسل عبر **Gmail SMTP** (الاتصال بـ `smtp.gmail.com` على المنفذ **465** أو **587**).

### DigitalOcean

حسب [توثيق DigitalOcean](https://docs.digitalocean.com/support/smtp-is-blocked-on-droplets/): منافذ **25 و465 و587** محظورة **افتراضياً على كل الـ Droplets** (لمنع إساءة الاستخدام والسبام).  
يعني **Gmail SMTP لن يعمل من Droplet عادي** — هذا ليس خطأ في إعدادك أو في إيميلك.

### Railway وغيرها

منصات مثل **Railway** قد تمنع أيضاً الخروج إلى منافذ البريد. النتيجة: **Network is unreachable** أو **Timed out** — وليس بالضرورة بسبب كلمة مرور التطبيق.

الاتصال بـ **HTTPS** (Supabase) يعمل؛ **SMTP** هو المحظور.

## ماذا تفعل؟

| الخيار | ملاحظة |
|--------|--------|
| **جهازك (كمبيوتر منزلي)** | غالباً يسمح بـ SMTP — الإرسال من إيميل المستخدم يعمل. |
| **VPS لا يحجب SMTP** | مثل **Hetzner**، **Oracle Cloud** (تحقق من السياسة)، أو استضافة تسمح صراحة بـ 587/465. |
| **البقاء على DigitalOcean Droplet** | إرسال Gmail SMTP **لن يعمل** مع الحظر الافتراضي — DigitalOcean يوصي بخدمة بريد طرف ثالث عبر API. |
| **مستقبلاً (تطوير)** | **Gmail API** عبر المنفذ **443** قد يعمل من DO لأنه ليس SMTP — يحتاج OAuth وتعديل كود. |

## التأكد من الإيميل وكلمة المرور

بعد تشغيل البوت في بيئة تسمح بـ SMTP:

1. إيميل **Gmail** (أو googlemail).
2. **كلمة مرور التطبيق** (16 حرفاً من Google).
3. التحقق بخطوتين مفعّل في Google.

---

رابط رسمي: [Why is SMTP blocked? (DigitalOcean)](https://docs.digitalocean.com/support/smtp-is-blocked-on-droplets/)
