"use client";

import Shell from "@/components/shell";
import { apiGet, apiSend } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Save, User, FileText, Upload, Check, Loader2, ChevronDown, ChevronUp, Tags, Calendar, Trash2, KeyRound, Copy, Mail, WifiOff } from "lucide-react";

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  city?: string;
  subscription_ends_at?: string;
  created_at: string;
  activation_code?: string | null;
  preferences?: string[];
  smtp_email?: string;
  email_connected?: boolean;
  smtp_host?: string;
  last_email_test_at?: string | null;
};

type Field = { id: string; name_ar: string };

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  const load = async () => {
    const res = await apiGet<{ ok: boolean; users: UserRow[] }>("/api/admin/users");
    setRows(res.users || []);
  };

  useEffect(() => {
    load().catch((e) => { setMsg(String(e)); setMsgType("err"); });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      `${r.full_name} ${r.email} ${r.phone} ${r.city}`.toLowerCase().includes(s)
    );
  }, [q, rows]);

  const updateEmail = async (id: string, email: string) => {
    await apiSend(`/api/admin/users/${id}/email`, "POST", { email });
    setMsg("تم تحديث البريد ✓"); setMsgType("ok");
    await load();
  };

  const uploadCv = async (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/admin/users/${id}/cv`, { method: "POST", body: fd, credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setMsg(`تم رفع السيرة: ${file.name} ✓`); setMsgType("ok");
  };

  const savePrefs = async (id: string, field_ids: string[]) => {
    await apiSend(`/api/admin/users/${id}/preferences`, "POST", { field_ids });
    setMsg("تم حفظ التفضيلات ✓"); setMsgType("ok");
  };

  const saveSubscription = async (id: string, days: number) => {
    await apiSend(`/api/admin/users/${id}/subscription`, "POST", { days });
    setMsg(`تم تحديث الاشتراك (${days} يوم) ✓`); setMsgType("ok");
    await load();
  };

  const deleteUser = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف المستخدم "${name || id}"؟\n\nسيتم حذف كل بياناته (السيرة، التفضيلات، طلبات التقديم...) ويُحرَّر كود التفعيل ليستخدم مجدداً.\n\nلا يمكن التراجع عن هذه العملية.`
    );
    if (!confirmed) return;
    try {
      await apiSend(`/api/admin/users/${id}`, "DELETE", {});
      setMsg(`تم حذف المستخدم ✓`); setMsgType("ok");
      await load();
    } catch (e) {
      setMsg(String(e)); setMsgType("err");
    }
  };

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink">المستخدمون</h1>
        <p className="text-sm text-muted mt-0.5">إدارة حسابات المشتركين — البريد والسيرة وتفضيلات الوظائف</p>
      </div>

      {msg && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          msgType === "ok"
            ? "border-line2 bg-panel2 text-ink"
            : "border-danger-border bg-danger-bg text-danger"
        }`}>
          {msg}
        </div>
      )}

      <div className="rounded-2xl border border-line/70 bg-panel shadow-card">
        <div className="border-b border-line/60 px-5 py-4">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالاسم أو الجوال أو المدينة أو البريد..."
              className="w-full rounded-xl border border-line/70 bg-panel2 pr-9 pl-3 py-2.5 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none"
            />
          </div>
        </div>
        <div className="px-5 py-2.5 border-b border-line/40 text-xs text-muted2">
          {filtered.length} مستخدم
        </div>
        <div className="divide-y divide-line/40">
          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted">لا توجد نتائج</div>
          ) : (
            filtered.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                onSaveEmail={updateEmail}
                onUploadCv={uploadCv}
                onSavePrefs={savePrefs}
                onSaveSubscription={saveSubscription}
                onDelete={deleteUser}
              />
            ))
          )}
        </div>
      </div>
    </Shell>
  );
}

function UserCard({
  user,
  onSaveEmail,
  onUploadCv,
  onSavePrefs,
  onSaveSubscription,
  onDelete,
}: {
  user: UserRow;
  onSaveEmail: (id: string, email: string) => Promise<void>;
  onUploadCv: (id: string, file: File) => Promise<void>;
  onSavePrefs: (id: string, field_ids: string[]) => Promise<void>;
  onSaveSubscription: (id: string, days: number) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
}) {
  const [codeCopied, setCodeCopied] = useState(false);
  const copyCode = async () => {
    if (!user.activation_code) return;
    try { await navigator.clipboard.writeText(user.activation_code); } catch {}
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1800);
  };
  const [email, setEmail] = useState(user.email || "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvName, setCvName] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [subDays, setSubDays] = useState("");
  const [savingSub, setSavingSub] = useState(false);
  const [subSaved, setSubSaved] = useState(false);

  const [showPrefs, setShowPrefs] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const loadPrefs = async () => {
    setLoadingPrefs(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/preferences`, { credentials: "include" });
      const data = await res.json();
      setFields(data.all_fields || []);
      setSelectedIds(data.selected_ids || []);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const togglePrefs = () => {
    if (!showPrefs && fields.length === 0) loadPrefs();
    setShowPrefs(v => !v);
  };

  const toggleField = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true); setErr("");
    try {
      await onSavePrefs(user.id, selectedIds);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2500);
    } catch (e) { setErr(String(e)); }
    finally { setSavingPrefs(false); }
  };

  const handleSaveEmail = async () => {
    setSavingEmail(true); setErr("");
    try {
      await onSaveEmail(user.id, email);
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2500);
    } catch (e) { setErr(String(e)); }
    finally { setSavingEmail(false); }
  };

  const handleSaveSub = async () => {
    const d = parseInt(subDays);
    if (!d || d < 1) return;
    setSavingSub(true); setErr("");
    try {
      await onSaveSubscription(user.id, d);
      setSubSaved(true); setSubDays("");
      setTimeout(() => setSubSaved(false), 2500);
    } catch (e) { setErr(String(e)); }
    finally { setSavingSub(false); }
  };

  const handleCvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCv(true); setErr("");
    try {
      await onUploadCv(user.id, file);
      setCvName(file.name);
    } catch (e) { setErr(String(e)); }
    finally { setUploadingCv(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const endsAt = user.subscription_ends_at
    ? new Date(user.subscription_ends_at).toLocaleDateString("ar")
    : null;

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 border border-accent/25 shrink-0">
          <User size={16} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink truncate">{user.full_name || "—"}</div>
          <div className="text-xs text-muted2 flex gap-3 flex-wrap mt-0.5 items-center">
            {user.phone && <span>{user.phone}</span>}
            {user.city && <span>{user.city}</span>}
            {endsAt && <span className="text-muted">ينتهي: {endsAt}</span>}
            {user.activation_code ? (
              <button
                onClick={copyCode}
                title="نسخ الكود"
                className="inline-flex items-center gap-1 rounded-md border border-line/70 bg-panel2 px-2 py-0.5 text-[11px] font-mono text-ink hover:border-accent/50 hover:text-accent transition-colors"
                dir="ltr"
              >
                <KeyRound size={10} />
                {user.activation_code}
                {codeCopied ? <Check size={10} className="text-ink/70" /> : <Copy size={10} className="opacity-60" />}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted2">
                <KeyRound size={10} /> بدون كود
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(user.id, user.full_name || user.phone || user.id)}
          title="حذف المستخدم"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-danger-border bg-danger-bg px-3 py-1.5 text-xs text-danger hover:bg-danger/15 transition-colors"
        >
          <Trash2 size={12} />
          حذف
        </button>
      </div>

      {err && <div className="text-xs text-danger bg-danger-bg border border-danger-border rounded-lg px-3 py-2">{err}</div>}

      {/* SMTP Status */}
      <div className="flex items-center gap-2 flex-wrap">
        {user.email_connected ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
            <Mail size={11} />
            الإيميل مربوط: {user.smtp_email}
            {user.last_email_test_at && (
              <span className="text-green-500/60 font-normal">
                · آخر اختبار {new Date(user.last_email_test_at).toLocaleDateString("ar")}
              </span>
            )}
          </span>
        ) : user.smtp_email ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">
            <WifiOff size={11} />
            إيميل محفوظ (غير مختبر): {user.smtp_email}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/50 bg-panel2 px-3 py-1 text-xs text-muted2">
            <WifiOff size={11} />
            لم يربط إيميله بعد
          </span>
        )}
        {user.smtp_host && (
          <span className="text-[11px] text-muted2 font-mono">{user.smtp_host}</span>
        )}
      </div>

      {/* Preferences preview chips */}
      <div className="flex items-start gap-2 flex-wrap">
        <Tags size={12} className="text-muted2 mt-1.5 shrink-0" />
        {user.preferences && user.preferences.length > 0 ? (
          user.preferences.map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-md border border-line/70 bg-panel2 px-2 py-0.5 text-[11px] text-ink2"
            >
              {p}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-muted2 mt-1">لم يحدد المستخدم أي تفضيلات</span>
        )}
      </div>


      {/* Email + CV row */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex gap-2 flex-1">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="البريد الإلكتروني"
            dir="ltr"
            className="flex-1 min-w-0 rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none"
          />
          <button
            onClick={handleSaveEmail}
            disabled={savingEmail}
            className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/15 px-3 py-2 text-xs text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {savingEmail ? <Loader2 size={12} className="animate-spin" /> : emailSaved ? <Check size={12} className="text-ink/70" /> : <Save size={12} />}
            {savingEmail ? "..." : emailSaved ? "تم" : "حفظ"}
          </button>
        </div>

        {/* Subscription edit */}
        <div className="flex gap-2 items-center">
          <Calendar size={13} className="text-muted2 shrink-0" />
          <span className="text-xs text-muted2 shrink-0">
            {user.subscription_ends_at ? `ينتهي: ${new Date(user.subscription_ends_at).toLocaleDateString("ar")}` : "لا اشتراك"}
          </span>
          <input
            type="number"
            min="1"
            value={subDays}
            onChange={(e) => setSubDays(e.target.value)}
            placeholder="أيام جديدة"
            className="w-24 rounded-xl border border-line/70 bg-panel2 px-2 py-1.5 text-xs text-center placeholder:text-muted focus:border-accent/50 focus:outline-none"
          />
          <button
            onClick={handleSaveSub}
            disabled={savingSub || !subDays}
            className="flex items-center gap-1 rounded-xl border border-blue-500/30 bg-blue-950/30 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-900/40 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {savingSub ? <Loader2 size={11} className="animate-spin" /> : subSaved ? <Check size={11} className="text-ink/70" /> : <Save size={11} />}
            {subSaved ? "تم" : "تعيين"}
          </button>
        </div>

        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleCvChange} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingCv}
            className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-xs text-ink2 hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {uploadingCv ? <Loader2 size={12} className="animate-spin" /> : cvName ? <FileText size={12} className="text-ink/70" /> : <Upload size={12} />}
            {uploadingCv ? "جاري الرفع..." : cvName ? "تم الرفع ✓" : "رفع سيرة"}
          </button>

          <button
            onClick={togglePrefs}
            className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-xs text-ink2 hover:border-accent/40 hover:text-accent transition-colors whitespace-nowrap"
          >
            <Tags size={12} />
            التفضيلات
            {showPrefs ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {/* Job Preferences Panel */}
      {showPrefs && (
        <div className="rounded-xl border border-line/60 bg-panel2 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-ink2">تفضيلات مجالات الوظائف</span>
            <button
              onClick={handleSavePrefs}
              disabled={savingPrefs}
              className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/15 px-3 py-1.5 text-xs text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
            >
              {savingPrefs ? <Loader2 size={11} className="animate-spin" /> : prefsSaved ? <Check size={11} className="text-ink/70" /> : <Save size={11} />}
              {savingPrefs ? "..." : prefsSaved ? "تم الحفظ" : "حفظ"}
            </button>
          </div>
          {loadingPrefs ? (
            <div className="flex items-center gap-2 text-xs text-muted2 py-3">
              <Loader2 size={13} className="animate-spin" /> جاري التحميل...
            </div>
          ) : fields.length === 0 ? (
            <p className="text-xs text-muted2">لا توجد مجالات محددة في النظام</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {fields.map((f) => {
                const active = selectedIds.includes(String(f.id));
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleField(String(f.id))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                      active
                        ? "bg-panel2 border-line2 text-ink"
                        : "bg-transparent border-line/60 text-muted2 hover:border-slate-400 hover:text-ink2"
                    }`}
                  >
                    {active ? "✓ " : ""}{f.name_ar}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-2 text-xs text-muted">{selectedIds.length} مجال محدد</div>
        </div>
      )}
    </div>
  );
}
