# -*- coding: utf-8 -*-
"""
لوحة تحكم الأدمن: أكواد تفعيل، وظائف، إعلانات.
تشغيل: من مجلد المشروع: python -m admin.app
أو: flask --app admin.app run
"""
import os
import random
import string
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, redirect, url_for, session, render_template_string
from dotenv import load_dotenv
from admin.web_access import verify_gate_token

load_dotenv()

from database.db import (
    insert_activation_codes,
    get_admin_jobs,
    add_admin_job,
    delete_admin_job,
    get_admin_announcements,
    add_admin_announcement,
    delete_admin_announcement,
)

app = Flask(__name__)
app.secret_key = os.getenv("ADMIN_SECRET", "change-me-in-production")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
_raw_admin_ids = (os.getenv("ADMIN_TELEGRAM_IDS") or "").strip()
ADMIN_TELEGRAM_IDS = {
    int(x.strip()) for x in _raw_admin_ids.split(",") if x.strip().lstrip("-").isdigit()
}


@app.after_request
def add_no_cache_headers(response):
    """منع كاش المتصفح حتى تظهر تحديثات اللوحة فوراً."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


def login_required(f):
    from functools import wraps
    @wraps(f)
    def inner(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return inner


def generate_codes(count: int, subscription_days: int) -> list[str]:
    seen = set()
    codes = []
    while len(codes) < count:
        digits = "".join(random.choices(string.digits, k=7))
        letters = "".join(random.choices(string.ascii_uppercase, k=2))
        code = digits + letters
        if code not in seen:
            seen.add(code)
            codes.append(code)
    return codes


# --- قوالب HTML بسيطة ---
BASE_HTML = """
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>لوحة التحكم - بوت الوظائف</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 20px; background: #f5f5f5; }
    h1 { color: #1a5276; }
    nav { margin: 20px 0; }
    nav a { margin-left: 12px; color: #1a5276; text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; max-width: 700px; }
    input, textarea, button { width: 100%; padding: 10px; margin: 6px 0; font-size: 1em; }
    textarea { min-height: 100px; resize: vertical; }
    button { background: #1a5276; color: white; border: none; cursor: pointer; border-radius: 6px; }
    button:hover { background: #154360; }
    .logout { display: inline-block; margin-top: 20px; color: #666; font-size: 0.9em; }
    .item { padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
    .item:last-child { border-bottom: none; }
    .del { color: #c0392b; text-decoration: none; font-size: 0.9em; }
    .del:hover { text-decoration: underline; }
    .msg { padding: 10px; background: #d5f5e3; border-radius: 6px; margin-bottom: 15px; }
    label { display: block; margin-top: 10px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>لوحة تحكم البوت</h1>
  <nav>
    <a href="{{ url_for('dashboard') }}">الرئيسية</a>
    <a href="{{ url_for('codes') }}">أكواد التفعيل</a>
    <a href="{{ url_for('jobs') }}">الوظائف</a>
    <a href="{{ url_for('announcements') }}">الإعلانات</a>
    <a href="{{ url_for('logout') }}" class="logout">تسجيل الخروج</a>
  </nav>
  {{ content | safe }}
</body>
</html>
"""


@app.route("/login", methods=["GET", "POST"])
def login():
    # الوصول لصفحة تسجيل الدخول مسموح فقط عبر رابط بوابة آمن من تليجرام الأدمن.
    if request.method == "GET":
        gate = (request.args.get("gate") or "").strip()
        payload = verify_gate_token(gate)
        if not payload:
            return render_template_string(
                BASE_HTML, url_for=url_for, content="""
                <div class="card">
                  <h2>وصول غير مصرح</h2>
                  <p>افتح لوحة الويب من زر الأدمن داخل تليجرام أولاً.</p>
                </div>
                """
            ), 403
        aid = int(payload.get("aid") or 0)
        if ADMIN_TELEGRAM_IDS and aid not in ADMIN_TELEGRAM_IDS:
            return render_template_string(
                BASE_HTML, url_for=url_for, content="""
                <div class="card"><p style="color:#c0392b;">لا تملك صلاحية الوصول.</p></div>
                """
            ), 403
        session["admin_gate_ok"] = True
        session["admin_gate_aid"] = aid
        session["admin_gate_exp"] = int(payload.get("exp") or 0)

    if request.method == "POST":
        if not session.get("admin_gate_ok"):
            return redirect(url_for("login"))
        if request.form.get("password") == ADMIN_PASSWORD:
            session["admin_logged_in"] = True
            return redirect(url_for("dashboard"))
        return render_template_string(BASE_HTML, url_for=url_for, content="""
            <div class="card">
              <p style="color: #c0392b;">كلمة المرور غير صحيحة.</p>
              <form method="post">
                <label>كلمة المرور</label>
                <input type="password" name="password" required>
                <button type="submit">دخول</button>
              </form>
            </div>
            """)
    return render_template_string(BASE_HTML, url_for=url_for, content="""
        <div class="card">
          <h2>تسجيل الدخول</h2>
          <form method="post">
            <label>كلمة المرور</label>
            <input type="password" name="password" required autofocus>
            <button type="submit">دخول</button>
          </form>
        </div>
        """)


@app.route("/logout")
def logout():
    session.pop("admin_logged_in", None)
    session.pop("admin_gate_ok", None)
    session.pop("admin_gate_aid", None)
    session.pop("admin_gate_exp", None)
    return redirect(url_for("login"))


@app.route("/")
@login_required
def dashboard():
    jobs = get_admin_jobs(active_only=False)
    anns = get_admin_announcements(active_only=False)
    return render_template_string(
        BASE_HTML,
        url_for=url_for,
        content="""
        <div class="card">
          <h2>الرئيسية</h2>
          <p>عدد الوظائف المضافة: <strong>""" + str(len(jobs)) + """</strong></p>
          <p>عدد الإعلانات: <strong>""" + str(len(anns)) + """</strong></p>
          <p>من القائمة أعلاه يمكنك: توليد أكواد تفعيل، إضافة وظائف، ونشر إعلانات تظهر للمستخدمين في البوت.</p>
        </div>
        """,
    )


@app.route("/codes", methods=["GET", "POST"])
@login_required
def codes():
    msg = ""
    if request.method == "POST":
        try:
            count = int(request.form.get("count", 49))
            days = int(request.form.get("days", 365))
            codes_list = generate_codes(count, days)
            rows = [{"code": c, "subscription_days": days} for c in codes_list]
            insert_activation_codes(rows)
            msg = f"تم إضافة {len(rows)} كود بنجاح (اشتراك {days} يوم)."
        except Exception as e:
            msg = f"خطأ: {e}"
    return render_template_string(
        BASE_HTML,
        url_for=url_for,
        content=f"""
        <div class="card">
          <h2>توليد أكواد التفعيل</h2>
          {('<div class="msg">' + msg + '</div>') if msg else ''}
          <form method="post">
            <label>عدد الأكواد</label>
            <input type="number" name="count" value="49" min="1" max="500">
            <label>أيام الاشتراك (365 = سنة)</label>
            <input type="number" name="days" value="365" min="1">
            <button type="submit">توليد وإضافة في Supabase</button>
          </form>
        </div>
        """,
    )


@app.route("/jobs", methods=["GET", "POST"])
@login_required
def jobs():
    msg = ""
    if request.method == "POST" and request.form.get("title_ar"):
        try:
            add_admin_job(
                title_ar=request.form.get("title_ar", "").strip(),
                title_en=request.form.get("title_en", "").strip(),
                description_ar=request.form.get("description_ar", "").strip(),
                description_en=request.form.get("description_en", "").strip(),
                company=request.form.get("company", "").strip(),
                link_url=request.form.get("link_url", "").strip(),
            )
            msg = "تمت إضافة الوظيفة."
        except Exception as e:
            msg = f"خطأ: {e}"
    job_list = get_admin_jobs(active_only=False)
    items_html = "".join(
        f'<div class="item"><span>{j.get("title_ar") or j.get("title_en") or "بدون عنوان"} — {j.get("company") or ""}</span>'
        f'<a href="{url_for("delete_job", job_id=j["id"])}" class="del">حذف</a></div>'
        for j in job_list
    )
    return render_template_string(
        BASE_HTML,
        url_for=url_for,
        content=f"""
        <div class="card">
          <h2>إضافة وظيفة جديدة</h2>
          {('<div class="msg">' + msg + '</div>') if msg else ''}
          <form method="post">
            <label>عنوان الوظيفة (عربي) *</label>
            <input type="text" name="title_ar" required>
            <label>عنوان الوظيفة (إنجليزي)</label>
            <input type="text" name="title_en">
            <label>الوصف (عربي)</label>
            <textarea name="description_ar"></textarea>
            <label>الشركة</label>
            <input type="text" name="company">
            <label>رابط التقديم (اختياري)</label>
            <input type="url" name="link_url">
            <button type="submit">إضافة الوظيفة</button>
          </form>
        </div>
        <div class="card">
          <h2>الوظائف المضافة ({len(job_list)})</h2>
          {items_html if items_html else "<p>لا توجد وظائف بعد.</p>"}
        </div>
        """,
    )


@app.route("/jobs/delete/<job_id>")
@login_required
def delete_job(job_id):
    try:
        delete_admin_job(job_id)
    except Exception:
        pass
    return redirect(url_for("jobs"))


@app.route("/announcements", methods=["GET", "POST"])
@login_required
def announcements():
    msg = ""
    if request.method == "POST" and request.form.get("body_text"):
        try:
            add_admin_announcement(
                title=request.form.get("title", "").strip(),
                body_text=request.form.get("body_text", "").strip(),
            )
            msg = "تم نشر الإعلان."
        except Exception as e:
            msg = f"خطأ: {e}"
    ann_list = get_admin_announcements(active_only=False)
    ann_items = "".join(
        f'<div class="item"><span>{(a.get("title") or "بدون عنوان")[:50]} — {(a.get("body_text") or "")[:60]}...</span>'
        f'<a href="{url_for("delete_announcement", ann_id=a["id"])}" class="del">حذف</a></div>'
        for a in ann_list
    )
    return render_template_string(
        BASE_HTML,
        url_for=url_for,
        content=f"""
        <div class="card">
          <h2>نشر إعلان جديد</h2>
          <p>الإعلانات تظهر للمستخدمين في البوت (قسم الإعلانات).</p>
          {('<div class="msg">' + msg + '</div>') if msg else ''}
          <form method="post">
            <label>عنوان الإعلان</label>
            <input type="text" name="title" placeholder="اختياري">
            <label>نص الإعلان *</label>
            <textarea name="body_text" required placeholder="اكتب الإعلان هنا..."></textarea>
            <button type="submit">نشر الإعلان</button>
          </form>
        </div>
        <div class="card">
          <h2>الإعلانات ({len(ann_list)})</h2>
          {ann_items if ann_items else "<p>لا توجد إعلانات.</p>"}
        </div>
        """,
    )


@app.route("/announcements/delete/<ann_id>")
@login_required
def delete_announcement(ann_id):
    try:
        delete_admin_announcement(ann_id)
    except Exception:
        pass
    return redirect(url_for("announcements"))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
