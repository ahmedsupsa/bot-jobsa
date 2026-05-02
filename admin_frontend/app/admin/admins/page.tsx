"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/shell";
import { Loader2, Plus, Trash2, ShieldCheck, X, Save, Lock, User as UserIcon, KeyRound, Power, Mail } from "lucide-react";

type Perm =
  | "users" | "codes" | "jobs" | "crm" | "notifications"
  | "store" | "support" | "affiliate" | "finance" | "email-test" | "admins";

const PERMS: { key: Perm; label: string }[] = [
  { key: "users", label: "المستخدمون" },
  { key: "codes", label: "أكواد التفعيل" },
  { key: "jobs", label: "الوظائف" },
  { key: "crm", label: "علاقات العملاء" },
  { key: "notifications", label: "إشعارات Push" },
  { key: "store", label: "المتجر" },
  { key: "support", label: "الدعم الفني" },
  { key: "affiliate", label: "برنامج الربح" },
  { key: "finance", label: "المالية" },
  { key: "email-test", label: "اختبار الإيميل" },
  { key: "admins", label: "إدارة المسؤولين" },
];

type Admin = {
  id: string;
  username: string;
  permissions: Perm[];
  is_super: boolean;
  disabled: boolean;
  created_at: string;
  google_email: string | null;
};

export default function AdminsPage() {
  const [me, setMe] = useState<{ isSuper: boolean } | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [forbidden, setForbidden] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/admins", { credentials: "include" });
    if (r.status === 401) { window.location.href = "/login"; return; }
    if (r.status === 403) { setForbidden(true); setLoading(false); return; }
    const d = await r.json();
    setAdmins(d.admins || []);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(setMe);
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا الحساب؟")) return;
    const r = await fetch(`/api/admin/admins/${id}`, { method: "DELETE", credentials: "include" });
    if (!r.ok) { alert("فشل الحذف"); return; }
    load();
  }

  async function toggleDisabled(a: Admin) {
    const r = await fetch(`/api/admin/admins/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ disabled: !a.disabled }),
    });
    if (!r.ok) { alert("فشل التحديث"); return; }
    load();
  }

  if (forbidden) {
    return (
      <Shell>
        <div className="rounded-2xl border border-danger-border bg-danger-bg p-6 text-danger">
          ليس لديك صلاحية الوصول إلى هذه الصفحة.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel2 border border-line">
              <ShieldCheck size={20} className="text-ink" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink m-0">إدارة المسؤولين</h1>
              <p className="text-xs text-muted2 m-0">أضف حسابات إدارية جديدة وحدد الصفحات المسموح لها</p>
            </div>
          </div>
          {me?.isSuper && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-4 py-2.5 text-sm font-bold hover:opacity-90"
            >
              <Plus size={16} /> إضافة مسؤول
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-sidebar overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted2">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-16 text-muted2 text-sm">
              لا يوجد حسابات إدارية بعد. أضف أول حساب لتقسيم العمل بين الفريق.
            </div>
          ) : (
            <table className="w-full text-right">
              <thead className="bg-panel2 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">المستخدم</th>
                  <th className="px-4 py-3 font-medium">الصلاحيات</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-panel2 border border-line flex items-center justify-center text-muted">
                          <UserIcon size={14} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-ink" dir="ltr">{a.username}</div>
                          {a.google_email ? (
                            <div className="flex items-center gap-1 text-[11px] text-muted2 mt-0.5" dir="ltr">
                              <Mail size={10} className="text-blue-400 shrink-0" />
                              <span>{a.google_email}</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted2">{new Date(a.created_at).toLocaleDateString("ar-SA")}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a.is_super ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-panel2 border border-line2 px-2.5 py-1 text-[11px] font-semibold text-ink">
                          <ShieldCheck size={12} /> مدير عام
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {a.permissions.length === 0 ? (
                            <span className="text-xs text-muted2">لا توجد صلاحيات</span>
                          ) : a.permissions.map(p => (
                            <span key={p} className="rounded-md bg-panel2 border border-line px-2 py-0.5 text-[11px] text-ink2">
                              {PERMS.find(x => x.key === p)?.label || p}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.disabled ? (
                        <span className="rounded-full bg-danger-bg border border-danger-border px-2.5 py-1 text-[11px] text-danger">معطّل</span>
                      ) : (
                        <span className="rounded-full bg-panel2 border border-line px-2.5 py-1 text-[11px] text-ink2">نشط</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditing(a)}
                          className="rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs text-ink2 hover:text-ink"
                        >تعديل</button>
                        <button
                          onClick={() => toggleDisabled(a)}
                          className="rounded-lg border border-line bg-panel2 px-2.5 py-1.5 text-muted hover:text-ink"
                          title={a.disabled ? "تفعيل" : "تعطيل"}
                        ><Power size={14} /></button>
                        <button
                          onClick={() => remove(a.id)}
                          className="rounded-lg border border-danger-border bg-danger-bg px-2.5 py-1.5 text-danger hover:bg-danger-bg"
                        ><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!me?.isSuper && (
          <p className="mt-4 text-xs text-muted2">
            يمكن للمدير العام فقط إضافة أو تعديل أو حذف المسؤولين.
          </p>
        )}
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {editing && <EditModal admin={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </Shell>
  );
}

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSuper, setIsSuper] = useState(false);
  const [perms, setPerms] = useState<Set<Perm>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr(""); setSaving(true);
    const r = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password, is_super: isSuper, permissions: Array.from(perms) }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { setErr(d.error || "فشل الإنشاء"); return; }
    onSaved();
  }

  return (
    <Modal title="إضافة مسؤول جديد" onClose={onClose}>
      <Field label="اسم المستخدم" icon={<UserIcon size={14} />}>
        <input value={username} onChange={e => setUsername(e.target.value.toLowerCase())} dir="ltr" placeholder="username" className={inputCls} />
      </Field>
      <Field label="كلمة المرور (6 أحرف على الأقل)" icon={<KeyRound size={14} />}>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} dir="ltr" placeholder="••••••••" className={inputCls} />
      </Field>
      <SuperToggle isSuper={isSuper} setIsSuper={setIsSuper} />
      {!isSuper && <PermsGrid perms={perms} setPerms={setPerms} />}
      {err && <div className="rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-xs text-danger">{err}</div>}
      <button
        onClick={save} disabled={saving || !username || !password}
        className="w-full rounded-xl bg-accent text-accent-fg py-3 text-sm font-bold disabled:bg-slate-700 disabled:text-muted flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        إنشاء الحساب
      </button>
    </Modal>
  );
}

function EditModal({ admin, onClose, onSaved }: { admin: Admin; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState("");
  const [googleEmail, setGoogleEmail] = useState(admin.google_email || "");
  const [isSuper, setIsSuper] = useState(admin.is_super);
  const [perms, setPerms] = useState<Set<Perm>>(new Set(admin.permissions));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr(""); setSaving(true);
    const body: any = { is_super: isSuper, permissions: Array.from(perms), google_email: googleEmail.trim() || null };
    if (password) body.password = password;
    const r = await fetch(`/api/admin/admins/${admin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { setErr(d.error || "فشل التحديث"); return; }
    onSaved();
  }

  return (
    <Modal title={`تعديل ${admin.username}`} onClose={onClose}>
      <Field label="كلمة مرور جديدة (اتركه فارغاً لإبقائها)" icon={<Lock size={14} />}>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} dir="ltr" placeholder="••••••••" className={inputCls} />
      </Field>
      <Field label="حساب Google للدخول (اختياري)" icon={<Mail size={14} />}>
        <input
          type="email"
          value={googleEmail}
          onChange={e => setGoogleEmail(e.target.value.toLowerCase())}
          dir="ltr"
          placeholder="example@gmail.com"
          className={inputCls}
        />
        <div className="text-[11px] text-muted2 mt-1">إذا أضفت بريداً هنا، سيتمكن هذا الحساب من الدخول بزر Google بدون كلمة مرور.</div>
      </Field>
      <SuperToggle isSuper={isSuper} setIsSuper={setIsSuper} />
      {!isSuper && <PermsGrid perms={perms} setPerms={setPerms} />}
      {err && <div className="rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-xs text-danger">{err}</div>}
      <button
        onClick={save} disabled={saving}
        className="w-full rounded-xl bg-accent text-accent-fg py-3 text-sm font-bold disabled:bg-slate-700 disabled:text-muted flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        حفظ التغييرات
      </button>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-[var(--input-bg)]/80 flex items-center justify-center p-4">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-sidebar border border-line p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-ink m-0">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5">{icon}{label}</div>
      {children}
    </label>
  );
}

function SuperToggle({ isSuper, setIsSuper }: { isSuper: boolean; setIsSuper: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => setIsSuper(!isSuper)}
      className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-right transition-colors ${
        isSuper ? "bg-panel2 border-line2" : "bg-panel2 border-line"
      }`}
    >
      <div>
        <div className="text-sm font-semibold text-ink">مدير عام</div>
        <div className="text-[11px] text-muted">صلاحية كاملة على جميع الصفحات</div>
      </div>
      <div className={`h-6 w-11 rounded-full transition-colors flex items-center ${isSuper ? "bg-accent" : "bg-slate-700"}`}>
        <div className={`h-5 w-5 rounded-full bg-[var(--input-bg)] transition-transform ${isSuper ? "-translate-x-5" : "-translate-x-0.5"}`} />
      </div>
    </button>
  );
}

function PermsGrid({ perms, setPerms }: { perms: Set<Perm>; setPerms: (s: Set<Perm>) => void }) {
  function toggle(p: Perm) {
    const next = new Set(perms);
    if (next.has(p)) next.delete(p); else next.add(p);
    setPerms(next);
  }
  return (
    <div>
      <div className="text-xs text-muted mb-2">الصفحات المسموح بها</div>
      <div className="grid grid-cols-2 gap-2">
        {PERMS.map(p => {
          const on = perms.has(p.key);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => toggle(p.key)}
              className={`rounded-xl border px-3 py-2.5 text-sm text-right transition-colors ${
                on ? "bg-panel2 border-line2 text-ink" : "bg-panel2 border-line text-muted hover:text-ink"
              }`}
            >
              <span className={`inline-block h-4 w-4 ms-2 align-middle rounded ${on ? "bg-accent" : "bg-slate-700"}`} />
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl bg-panel2 border border-line px-3 py-2.5 text-sm text-ink outline-none focus:border-line2";
