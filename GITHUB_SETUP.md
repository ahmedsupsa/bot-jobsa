# رفع المشروع إلى GitHub

## تم تنفيذه
- ✅ تهيئة Git (`git init`)
- ✅ ملف `.gitignore` (لا يرفع `.env` أو `venv/` أو أسرار)
- ✅ أول commit جاهز

---

## خطوات الرفع إلى GitHub

### 1. إنشاء مستودع جديد على GitHub
1. ادخل إلى [github.com](https://github.com) وسجّل الدخول.
2. اضغط **New repository** (أو **+** → **New repository**).
3. اختر اسم المستودع (مثلاً `bot-jobsa`).
4. اختر **Private** أو **Public**.
5. **لا** تختر "Add a README" ولا "Add .gitignore" (المشروع فيهما مسبقاً).
6. اضغط **Create repository**.

### 2. ربط المشروع المحلي بالمستودع ورفع الكود
افتح الطرفية في مجلد المشروع وشغّل (استبدل `YOUR_USERNAME` و `REPO_NAME` باسمك واسم المستودع):

```bash
cd "c:\Users\ahmad\ملجد بوت تليجرام"

git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

git branch -M main
git push -u origin main
```

**مثال:** إذا كان المستودع `https://github.com/ahmad/bot-jobsa`:

```bash
git remote add origin https://github.com/ahmad/bot-jobsa.git
git branch -M main
git push -u origin main
```

### 3. إذا طلب منك GitHub اسم مستخدم وكلمة مرور
- **اسم المستخدم:** حساب GitHub.
- **كلمة المرور:** استخدم **Personal Access Token** وليس كلمة مرور الحساب.
  - من GitHub: **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**.
  - فعّل صلاحية `repo` ثم انسخ الـ token واستخدمه مكان كلمة المرور عند `git push`.

---

بعد تنفيذ هذه الخطوات يكون المشروع مرفوعاً على GitHub وجاهزاً لأي تحديثات لاحقة بـ `git push`.
