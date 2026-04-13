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

from flask import Flask, request, redirect, url_for, session, render_template_string, jsonify
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
    admin_stats_applications_recent,
    admin_list_users,
    admin_list_activation_codes_used,
    admin_list_activation_codes_unused,
    get_user_by_id,
    admin_get_user_settings,
    admin_update_user_email,
)

app = Flask(__name__)
app.secret_key = os.getenv("ADMIN_SECRET", "change-me-in-production")

from admin.portal_api import portal_bp
app.register_blueprint(portal_bp)
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


def api_login_required(f):
    from functools import wraps

    @wraps(f)
    def inner(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return jsonify({"ok": False, "error": "unauthorized"}), 401
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
    :root {
      --bg: #0b1020;
      --panel: #121a31;
      --panel-2: #172241;
      --text: #ecf2ff;
      --muted: #9eb1da;
      --primary: #5da7ff;
      --primary-2: #3f87e0;
      --danger: #ff7d7d;
      --success-bg: #143826;
      --success-border: #2d6b4d;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, sans-serif;
      margin: 0;
      background: radial-gradient(1200px 700px at 80% -20%, #22336a 0%, var(--bg) 55%);
      color: var(--text);
    }
    .container {
      max-width: 1120px;
      margin: 24px auto;
      padding: 0 16px 24px;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0;
      font-size: 1.35rem;
      color: var(--text);
    }
    .sub {
      color: var(--muted);
      font-size: 0.95rem;
    }
    nav {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    nav a {
      color: var(--text);
      background: var(--panel-2);
      border: 1px solid rgba(157, 182, 230, 0.2);
      text-decoration: none;
      padding: 8px 12px;
      border-radius: 10px;
      font-size: 0.92rem;
    }
    nav a:hover { background: #20305f; }
    .card {
      background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
      border: 1px solid rgba(157, 182, 230, 0.2);
      padding: 18px;
      border-radius: 14px;
      margin-bottom: 16px;
      width: 100%;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 8px;
    }
    .stat {
      background: var(--panel-2);
      border: 1px solid rgba(157, 182, 230, 0.2);
      border-radius: 10px;
      padding: 12px;
    }
    .stat .k {
      color: var(--muted);
      font-size: 0.86rem;
      margin-bottom: 4px;
    }
    .stat .v {
      font-size: 1.15rem;
      font-weight: 700;
    }
    input, textarea, button {
      width: 100%;
      padding: 10px 12px;
      margin: 6px 0;
      font-size: 0.97rem;
      border-radius: 10px;
    }
    input, textarea {
      background: #0d1630;
      color: var(--text);
      border: 1px solid rgba(157, 182, 230, 0.35);
      outline: none;
    }
    textarea { min-height: 120px; resize: vertical; }
    button {
      background: linear-gradient(180deg, var(--primary), var(--primary-2));
      color: white;
      border: none;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover { filter: brightness(1.05); }
    .logout {
      color: #ffd4d4;
      border-color: rgba(255, 125, 125, 0.5);
      background: rgba(95, 29, 29, 0.3);
    }
    .item {
      padding: 12px;
      border-bottom: 1px solid rgba(157, 182, 230, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .item:last-child { border-bottom: none; }
    .item span { color: #e7efff; }
    .del {
      color: var(--danger);
      text-decoration: none;
      font-size: 0.9em;
      white-space: nowrap;
    }
    .msg {
      padding: 10px;
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      border-radius: 8px;
      margin-bottom: 14px;
    }
    .warn {
      padding: 10px;
      background: #3d2b15;
      border: 1px solid #7a5423;
      border-radius: 8px;
      margin-bottom: 14px;
    }
    .codebox {
      background: #0d1630;
      border: 1px dashed rgba(157, 182, 230, 0.35);
      color: #f3f7ff;
      border-radius: 10px;
      padding: 10px;
      min-height: 120px;
      width: 100%;
      font-family: Consolas, monospace;
      line-height: 1.7;
      white-space: pre-wrap;
      overflow: auto;
      margin-top: 6px;
    }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .inline-btn {
      width: auto;
      padding: 8px 12px;
      font-size: 0.9rem;
      margin-top: 8px;
    }
    .table-wrap { overflow-x: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 0.92rem;
    }
    th, td {
      text-align: right;
      border-bottom: 1px solid rgba(157, 182, 230, 0.2);
      padding: 10px 8px;
      white-space: nowrap;
    }
    th { color: #b7c9f0; font-weight: 600; }
    .small { font-size: 0.86rem; color: #9eb1da; }
    label {
      display: block;
      margin-top: 10px;
      font-weight: 600;
      color: #d6e3ff;
    }
    @media (max-width: 900px) {
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 560px) {
      .stats { grid-template-columns: 1fr; }
      .item { align-items: flex-start; flex-direction: column; }
      .row { grid-template-columns: 1fr; }
    }
  </style>
  <script>
    function copyById(id) {
      const el = document.getElementById(id);
      if (!el) return;
      const text = el.innerText || el.value || "";
      navigator.clipboard.writeText(text).then(() => {
        alert("تم النسخ");
      });
    }
  </script>
</head>
<body>
  <div class="container">
    <div class="topbar">
      <div>
        <h1>لوحة تحكم البوت</h1>
        <div class="sub">إدارة الأكواد والوظائف والإعلانات من مكان واحد</div>
      </div>
    </div>
    <nav>
      <a href="{{ url_for('dashboard') }}">الرئيسية</a>
      <a href="{{ url_for('codes') }}">أكواد التفعيل</a>
      <a href="{{ url_for('users') }}">المستخدمون</a>
      <a href="{{ url_for('jobs') }}">الوظائف</a>
      <a href="{{ url_for('announcements') }}">الإعلانات</a>
      <a href="{{ url_for('logout') }}" class="logout">تسجيل الخروج</a>
    </nav>
    {{ content | safe }}
  </div>
</body>
</html>
"""


@app.route("/login", methods=["GET", "POST"])
def login():
    # إذا كان المستخدم مسجّلاً بالفعل، انتقل للوحة
    if session.get("admin_logged_in"):
        return redirect(url_for("dashboard"))

    # دعم gate token من البوت (اختياري — للتوافق مع الإصدار القديم)
    if request.method == "GET":
        gate = (request.args.get("gate") or "").strip()
        if gate:
            payload = verify_gate_token(gate)
            if payload:
                aid = int(payload.get("aid") or 0)
                session["admin_gate_ok"] = True
                session["admin_gate_aid"] = aid

    if request.method == "POST":
        password = request.form.get("password", "")
        if password == ADMIN_PASSWORD:
            session["admin_logged_in"] = True
            session["admin_gate_ok"] = True
            return redirect(url_for("dashboard"))
        return render_template_string(BASE_HTML, url_for=url_for, content="""
            <div class="card">
              <p style="color: #c0392b;">كلمة المرور غير صحيحة.</p>
              <form method="post">
                <label>كلمة المرور</label>
                <input type="password" name="password" required autofocus>
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
    recent_apps = admin_stats_applications_recent(12)
    recent_users = admin_list_users(8)
    app_rows = []
    for r in recent_apps:
        uid = r.get("user_id")
        user = get_user_by_id(uid) if uid else None
        name = (user.get("full_name") or "—") if user else "—"
        app_rows.append(
            f"<tr><td>{name}</td><td>{(r.get('job_title') or '—')[:60]}</td><td>{(r.get('applied_at') or '—')[:19]}</td></tr>"
        )
    user_rows = []
    for u in recent_users:
        user_rows.append(
            f"<tr><td>{(u.get('full_name') or '—')[:40]}</td><td>{u.get('telegram_id') or '—'}</td><td>{(u.get('created_at') or '—')[:19]}</td></tr>"
        )
    return render_template_string(
        BASE_HTML,
        url_for=url_for,
        content="""
        <div class="card">
          <h2 style="margin-top:0">ملخص سريع</h2>
          <div class="stats">
            <div class="stat"><div class="k">الوظائف</div><div class="v">""" + str(len(jobs)) + """</div></div>
            <div class="stat"><div class="k">الإعلانات</div><div class="v">""" + str(len(anns)) + """</div></div>
            <div class="stat"><div class="k">وظائف نشطة</div><div class="v">""" + str(sum(1 for j in jobs if j.get("is_active"))) + """</div></div>
            <div class="stat"><div class="k">إعلانات نشطة</div><div class="v">""" + str(sum(1 for a in anns if a.get("is_active"))) + """</div></div>
          </div>
        </div>
        <div class="card">
          <h3 style="margin-top:0">اختصارات الإدارة</h3>
          <p style="margin-bottom:8px;color:#bcd0f7">• إدارة الاشتراكات: من <strong>أكواد التفعيل</strong></p>
          <p style="margin-bottom:8px;color:#bcd0f7">• إضافة/إزالة وظائف: من <strong>الوظائف</strong></p>
          <p style="margin-bottom:0;color:#bcd0f7">• نشر رسائل للمستخدمين: من <strong>الإعلانات</strong></p>
        </div>
        <div class="row">
          <div class="card">
            <h3 style="margin-top:0">آخر التقديمات</h3>
            <div class="table-wrap">
              <table>
                <thead><tr><th>المستخدم</th><th>الوظيفة</th><th>الوقت</th></tr></thead>
                <tbody>""" + ("".join(app_rows) or "<tr><td colspan='3'>لا توجد بيانات.</td></tr>") + """</tbody>
              </table>
            </div>
          </div>
          <div class="card">
            <h3 style="margin-top:0">أحدث المستخدمين</h3>
            <div class="table-wrap">
              <table>
                <thead><tr><th>الاسم</th><th>Telegram ID</th><th>وقت التسجيل</th></tr></thead>
                <tbody>""" + ("".join(user_rows) or "<tr><td colspan='3'>لا توجد بيانات.</td></tr>") + """</tbody>
              </table>
            </div>
          </div>
        </div>
        """,
    )


@app.route("/codes", methods=["GET", "POST"])
@login_required
def codes():
    msg = ""
    generated_codes: list[str] = []
    if request.method == "POST":
        try:
            count = int(request.form.get("count", 49))
            days = int(request.form.get("days", 365))
            generated_codes = generate_codes(count, days)
            rows = [{"code": c, "subscription_days": days} for c in generated_codes]
            insert_activation_codes(rows)
            msg = f"تم إضافة {len(rows)} كود بنجاح (اشتراك {days} يوم)."
        except Exception as e:
            msg = f"خطأ: {e}"
    used_codes = admin_list_activation_codes_used(60)
    unused_codes = admin_list_activation_codes_unused(120)
    generated_text = "\n".join(generated_codes)
    used_text = "\n".join((c.get("code") or "") for c in used_codes if c.get("code"))
    unused_text = "\n".join((c.get("code") or "") for c in unused_codes if c.get("code"))
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
        <div class="row">
          <div class="card">
            <h3 style="margin-top:0">الأكواد المولدة الآن</h3>
            <div class="small">آخر عملية توليد في نفس الطلب</div>
            <div id="codes-generated" class="codebox">{generated_text or "لا يوجد توليد في هذه الصفحة بعد."}</div>
            <button class="inline-btn" onclick="copyById('codes-generated')">نسخ الأكواد المولدة</button>
          </div>
          <div class="card">
            <h3 style="margin-top:0">الأكواد المستخدمة (آخر 60)</h3>
            <div class="small">تاريخ الاستخدام موجود في قاعدة البيانات</div>
            <div id="codes-used" class="codebox">{used_text or "لا توجد أكواد مستخدمة."}</div>
            <button class="inline-btn" onclick="copyById('codes-used')">نسخ الأكواد المستخدمة</button>
          </div>
        </div>
        <div class="card">
          <h3 style="margin-top:0">الأكواد غير المستخدمة (آخر 120)</h3>
          <div id="codes-unused" class="codebox">{unused_text or "لا توجد أكواد متاحة."}</div>
          <button class="inline-btn" onclick="copyById('codes-unused')">نسخ الأكواد غير المستخدمة</button>
        </div>
        """,
    )


@app.route("/users", methods=["GET", "POST"])
@login_required
def users():
    msg = ""
    if request.method == "POST":
        user_id = (request.form.get("user_id") or "").strip()
        new_email = (request.form.get("new_email") or "").strip()
        try:
            admin_update_user_email(user_id, new_email)
            msg = "تم تحديث البريد بنجاح."
        except Exception as e:
            msg = f"خطأ: {e}"
    users_list = admin_list_users(80)
    rows = []
    for u in users_list:
        uid = str(u.get("id") or "")
        st = admin_get_user_settings(uid) or {}
        email = st.get("email") or ""
        rows.append(
            f"""
            <tr>
              <td>{(u.get("full_name") or "—")[:32]}</td>
              <td>{u.get("telegram_id") or "—"}</td>
              <td>{email or "—"}</td>
              <td>
                <form method="post" style="display:flex;gap:6px;align-items:center;">
                  <input type="hidden" name="user_id" value="{uid}">
                  <input type="email" name="new_email" placeholder="new@email.com" value="{email}" required style="min-width:230px;">
                  <button type="submit" style="width:auto;">حفظ</button>
                </form>
              </td>
            </tr>
            """
        )
    return render_template_string(
        BASE_HTML,
        url_for=url_for,
        content=f"""
        <div class="card">
          <h2 style="margin-top:0">إدارة المستخدمين والبريد</h2>
          <p class="small">يمكنك تعديل البريد الشخصي للمستخدم مباشرة من هنا.</p>
          {('<div class="msg">' + msg + '</div>') if msg and not msg.startswith('خطأ') else ''}
          {('<div class="warn">' + msg + '</div>') if msg.startswith('خطأ') else ''}
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>الاسم</th><th>Telegram ID</th><th>البريد الحالي</th><th>تعديل البريد</th></tr>
              </thead>
              <tbody>
                {"".join(rows) if rows else "<tr><td colspan='4'>لا يوجد مستخدمون.</td></tr>"}
              </tbody>
            </table>
          </div>
        </div>
        """,
    )


@app.route("/api/admin/summary")
@api_login_required
def api_admin_summary():
    jobs = get_admin_jobs(active_only=False)
    anns = get_admin_announcements(active_only=False)
    recent_apps = admin_stats_applications_recent(12)
    recent_users = admin_list_users(8)
    app_items = []
    for r in recent_apps:
        uid = r.get("user_id")
        u = get_user_by_id(uid) if uid else None
        app_items.append(
            {
                "user_name": (u.get("full_name") if u else "") or "—",
                "job_title": (r.get("job_title") or "—"),
                "applied_at": (r.get("applied_at") or "—"),
            }
        )
    users_items = [
        {
            "name": (u.get("full_name") or "—"),
            "telegram_id": u.get("telegram_id"),
            "created_at": (u.get("created_at") or "—"),
        }
        for u in recent_users
    ]
    return jsonify(
        {
            "ok": True,
            "stats": {
                "jobs_total": len(jobs),
                "announcements_total": len(anns),
                "jobs_active": sum(1 for j in jobs if j.get("is_active")),
                "announcements_active": sum(1 for a in anns if a.get("is_active")),
            },
            "recent_applications": app_items,
            "recent_users": users_items,
        }
    )


@app.route("/api/admin/codes")
@api_login_required
def api_admin_codes():
    used_codes = admin_list_activation_codes_used(120)
    unused_codes = admin_list_activation_codes_unused(240)
    return jsonify(
        {
            "ok": True,
            "used_codes": [c.get("code") for c in used_codes if c.get("code")],
            "unused_codes": [c.get("code") for c in unused_codes if c.get("code")],
        }
    )


@app.route("/api/admin/users")
@api_login_required
def api_admin_users():
    users_list = admin_list_users(200)
    rows = []
    for u in users_list:
        uid = str(u.get("id") or "")
        st = admin_get_user_settings(uid) or {}
        rows.append(
            {
                "id": uid,
                "name": (u.get("full_name") or "—"),
                "telegram_id": u.get("telegram_id"),
                "email": (st.get("email") or ""),
                "created_at": (u.get("created_at") or ""),
            }
        )
    return jsonify({"ok": True, "users": rows})


@app.route("/api/admin/users/<user_id>/email", methods=["POST"])
@api_login_required
def api_admin_update_user_email(user_id: str):
    body = request.get_json(silent=True) or {}
    new_email = (body.get("email") or "").strip()
    try:
        admin_update_user_email(user_id, new_email)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/admin/jobs", methods=["GET", "POST"])
@api_login_required
def api_admin_jobs():
    if request.method == "GET":
        jobs = get_admin_jobs(active_only=False)
        return jsonify({"ok": True, "jobs": jobs})
    body = request.get_json(silent=True) or {}
    try:
        row = add_admin_job(
            title_ar=(body.get("title_ar") or "").strip(),
            title_en=(body.get("title_en") or "").strip(),
            description_ar=(body.get("description_ar") or "").strip(),
            description_en=(body.get("description_en") or "").strip(),
            company=(body.get("company") or "").strip(),
            link_url=(body.get("link_url") or "").strip(),
            application_email=(body.get("application_email") or "").strip(),
            specializations=(body.get("specializations") or "").strip(),
        )
        return jsonify({"ok": True, "job": row})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/admin/jobs/<job_id>", methods=["DELETE"])
@api_login_required
def api_admin_job_delete(job_id: str):
    try:
        outcome = delete_admin_job(job_id)
        return jsonify({"ok": True, "outcome": outcome})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/admin/announcements", methods=["GET", "POST"])
@api_login_required
def api_admin_announcements():
    if request.method == "GET":
        rows = get_admin_announcements(active_only=False, only_visible=False)
        return jsonify({"ok": True, "announcements": rows})
    body = request.get_json(silent=True) or {}
    try:
        row = add_admin_announcement(
            title=(body.get("title") or "").strip(),
            body_text=(body.get("body_text") or "").strip(),
        )
        return jsonify({"ok": True, "announcement": row})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/admin/announcements/<ann_id>", methods=["DELETE"])
@api_login_required
def api_admin_announcement_delete(ann_id: str):
    try:
        delete_admin_announcement(ann_id)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/admin/codes/generate", methods=["POST"])
@api_login_required
def api_admin_codes_generate():
    body = request.get_json(silent=True) or {}
    try:
        count = int(body.get("count") or 49)
        days = int(body.get("days") or 365)
        count = min(max(1, count), 500)
        days = max(1, days)
        codes_list = generate_codes(count, days)
        rows = [{"code": c, "subscription_days": days} for c in codes_list]
        insert_activation_codes(rows)
        return jsonify({"ok": True, "codes": codes_list, "count": len(codes_list), "days": days})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


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
          <p>الإعلانات تُرسل للمستخدمين <strong>تلقائياً</strong> في تليجرام (دون زر في القائمة).</p>
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
    port = int(os.getenv("ADMIN_PORT", os.getenv("PORT", "8080")))
    app.run(host="0.0.0.0", port=port, debug=False)
