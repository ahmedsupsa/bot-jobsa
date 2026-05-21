"use client";

import Shell from "@/components/shell";
import { apiGet, apiSend } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Save, User, FileText, Upload, Check, Loader2,
  ChevronDown, ChevronUp, Tags, Calendar, Trash2, KeyRound,
  Copy, Mail, WifiOff, Eye, X, Phone, MapPin, Clock,
} from "lucide-react";

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
  last_email_test_at?: string | null;
  has_cv?: boolean;
  cv_file_name?: string | null;
};

type Field = { id: string; name_ar: string };

function daysLeft(iso?: string): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [selected, setSelected] = useState<UserRow | null>(null);

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
    await load();
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
      `هل أنت متأكد من حذف المستخدم "${name || id}"؟\n\nسيتم حذف كل بياناته ولا يمكن التراجع.`
    );
    if (!confirmed) return;
    try {
      await apiSend(`/api/admin/users/${id}`, "DELETE", {});
      setMsg("تم حذف المستخدم ✓"); setMsgType("ok");
      setSelected(null);
      await load();
    } catch (e) {
      setMsg(String(e)); setMsgType("err");
    }
  };

  return (
    <Shell>
      <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-ink">المستخدمون</h1>
          <p className="text-sm text-muted mt-0.5">{rows.length} مشترك مسجّل</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالاسم أو الجوال أو المدينة..."
            className="w-full rounded-xl border border-line/70 bg-panel pr-9 pl-3 py-2.5 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none"
          />
        </div>
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

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card px-5 py-16 text-center text-sm text-muted">
          لا توجد نتائج
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((u) => (
            <UserGridCard
              key={u.id}
              user={u}
              isSelected={selected?.id === u.id}
              onClick={() => setSelected(selected?.id === u.id ? null : u)}
            />
          ))}
        </div>
      )}

      {selected && (
        <UserSidePanel
          user={selected}
          onClose={() => setSelected(null)}
          onSaveEmail={updateEmail}
          onUploadCv={uploadCv}
          onSavePrefs={savePrefs}
          onSaveSubscription={saveSubscription}
          onDelete={deleteUser}
        />
      )}
    </Shell>
  );
}

function UserGridCard({
  user,
  isSelected,
  onClick,
}: {
  user: UserRow;
  isSelected: boolean;
  onClick: () => void;
}) {
  const left = daysLeft(user.subscription_ends_at);
  const expired = left !== null && left < 0;
  const expiringSoon = left !== null && left >= 0 && left <= 3;

  const initials = (user.full_name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <button
      onClick={onClick}
      className={`w-full text-right rounded-2xl border bg-panel shadow-card p-4 transition-all hover:shadow-md hover:border-accent/40 ${
        isSelected ? "border-accent/60 ring-2 ring-accent/20 shadow-md" : "border-line/70"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          isSelected ? "bg-accent text-white" : "bg-accent/15 text-accent border border-accent/25"
        }`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ink text-sm truncate">{user.full_name || "—"}</div>
          <div className="text-xs text-muted2 flex gap-2 flex-wrap mt-1 items-center">
            {user.phone && (
              <span className="flex items-center gap-1"><Phone size={10} />{user.phone}</span>
            )}
            {user.city && (
              <span className="flex items-center gap-1"><MapPin size={10} />{user.city}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {user.email_connected ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] text-green-400">
            <Mail size={10} /> إيميل مربوط
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border border-line/50 bg-panel2 px-2 py-0.5 text-[11px] text-muted2">
            <WifiOff size={10} /> بدون إيميل
          </span>
        )}

        {user.has_cv ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-400">
            <FileText size={10} /> سيرة ذاتية
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border border-line/50 bg-panel2 px-2 py-0.5 text-[11px] text-muted2">
            <FileText size={10} /> بدون سيرة
          </span>
        )}

        {left !== null && (
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${
            expired
              ? "border-danger-border bg-danger-bg text-danger"
              : expiringSoon
              ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
              : "border-line/50 bg-panel2 text-muted2"
          }`}>
            <Clock size={10} />
            {expired ? `منتهي منذ ${Math.abs(left)} يوم` : left === 0 ? "ينتهي اليوم" : `${left} يوم`}
          </span>
        )}
      </div>

      {user.preferences && user.preferences.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {user.preferences.slice(0, 3).map((p, i) => (
            <span key={i} className="rounded-md border border-line/60 bg-panel2 px-1.5 py-0.5 text-[10px] text-ink2">
              {p}
            </span>
          ))}
          {user.preferences.length > 3 && (
            <span className="text-[10px] text-muted2 self-center">+{user.preferences.length - 3}</span>
          )}
        </div>
      )}
    </button>
  );
}

function UserSidePanel({
  user,
  onClose,
  onSaveEmail,
  onUploadCv,
  onSavePrefs,
  onSaveSubscription,
  onDelete,
}: {
  user: UserRow;
  onClose: () => void;
  onSaveEmail: (id: string, email: string) => Promise<void>;
  onUploadCv: (id: string, file: File) => Promise<void>;
  onSavePrefs: (id: string, field_ids: string[]) => Promise<void>;
  onSaveSubscription: (id: string, days: number) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
}) {
  const [email, setEmail] = useState(user.email || "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  const [subDays, setSubDays] = useState("");
  const [savingSub, setSavingSub] = useState(false);
  const [subSaved, setSubSaved] = useState(false);

  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvName, setCvName] = useState("");
  const [hasCv, setHasCv] = useState(!!user.has_cv);
  const [cvFileName, setCvFileName] = useState(user.cv_file_name || "");
  const [viewingCv, setViewingCv] = useState(false);

  const [codeCopied, setCodeCopied] = useState(false);
  const [err, setErr] = useState("");

  const [showPrefs, setShowPrefs] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const left = daysLeft(user.subscription_ends_at);
  const expired = left !== null && left < 0;
  const expiringSoon = left !== null && left >= 0 && left <= 3;

  const copyCode = async () => {
    if (!user.activation_code) return;
    try { await navigator.clipboard.writeText(user.activation_code); } catch {}
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1800);
  };

  const handleViewCv = async () => {
    setViewingCv(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/cv`, { credentials: "include" });
      const data = await res.json();
      if (!data.ok) { setErr(data.error || "فشل جلب السيرة"); return; }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch { setErr("فشل الاتصال بالخادم"); }
    finally { setViewingCv(false); }
  };

  const handleCvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCv(true); setErr("");
    try {
      await onUploadCv(user.id, file);
      setCvName(file.name);
      setHasCv(true);
      setCvFileName(file.name);
    } catch (e) { setErr(String(e)); }
    finally { setUploadingCv(false); if (fileRef.current) fileRef.current.value = ""; }
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

  const loadPrefs = async () => {
    setLoadingPrefs(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/preferences`, { credentials: "include" });
      const data = await res.json();
      setFields(data.all_fields || []);
      setSelectedIds(data.selected_ids || []);
    } finally { setLoadingPrefs(false); }
  };

  const togglePrefs = () => {
    if (!showPrefs && fields.length === 0) loadPrefs();
    setShowPrefs(v => !v);
  };

  const toggleField = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSavePrefs = async () => {
    setSavingPrefs(true); setErr("");
    try {
      await onSavePrefs(user.id, selectedIds);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2500);
    } catch (e) { setErr(String(e)); }
    finally { setSavingPrefs(false); }
  };

  const initials = (user.full_name || "?")
    .split(" ").slice(0, 2).map((w) => w[0]).join("");

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed top-0 left-0 h-full w-full sm:w-[420px] bg-panel border-r border-line/70 shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-in-left">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line/60 shrink-0">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-xl border border-line/70 bg-panel2 text-muted2 hover:text-ink hover:border-accent/40 transition-colors"
          >
            <X size={15} />
          </button>
          <div className="flex items-center gap-3">
            <div>
              <div className="font-semibold text-ink text-sm text-right">{user.full_name || "—"}</div>
              <div className="text-xs text-muted2 text-right">{fmtDate(user.created_at)} · تاريخ التسجيل</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white text-sm font-bold shrink-0">
              {initials}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {err && (
            <div className="text-xs text-danger bg-danger-bg border border-danger-border rounded-lg px-3 py-2">
              {err}
            </div>
          )}

          <Section title="معلومات الحساب">
            <InfoRow icon={<Phone size={13} />} label="الجوال" value={user.phone || "—"} dir="ltr" />
            <InfoRow icon={<MapPin size={13} />} label="المدينة" value={user.city || "—"} />
            <InfoRow icon={<Mail size={13} />} label="البريد" value={user.email || "—"} dir="ltr" />
            <InfoRow icon={<Clock size={13} />} label="الاشتراك" value={
              user.subscription_ends_at
                ? left !== null && expired
                  ? `منتهي · ${fmtDate(user.subscription_ends_at)}`
                  : `ينتهي ${fmtDate(user.subscription_ends_at)} · ${left} يوم`
                : "لا اشتراك"
            } valueClass={expired ? "text-danger" : expiringSoon ? "text-yellow-400" : ""} />
            {user.activation_code && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted2">كود التفعيل</span>
                <button
                  onClick={copyCode}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line/70 bg-panel2 px-2.5 py-1 font-mono text-ink hover:border-accent/50 hover:text-accent transition-colors"
                  dir="ltr"
                >
                  <KeyRound size={11} />
                  {user.activation_code}
                  {codeCopied ? <Check size={10} /> : <Copy size={10} className="opacity-50" />}
                </button>
              </div>
            )}
          </Section>

          <Section title="حالة الإيميل">
            {user.email_connected ? (
              <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-xs text-green-400">
                <Mail size={13} />
                <span>مربوط: <span dir="ltr">{user.smtp_email}</span></span>
                {user.last_email_test_at && (
                  <span className="text-green-500/50 mr-auto">{fmtDate(user.last_email_test_at)}</span>
                )}
              </div>
            ) : user.smtp_email ? (
              <div className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5 text-xs text-yellow-400">
                <WifiOff size={13} />
                محفوظ (غير مختبر): <span dir="ltr">{user.smtp_email}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-line/50 bg-panel2 px-3 py-2.5 text-xs text-muted2">
                <WifiOff size={13} />
                لم يربط إيميله بعد
              </div>
            )}

            <div className="flex gap-2 mt-3">
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
                {savingEmail ? <Loader2 size={12} className="animate-spin" /> : emailSaved ? <Check size={12} /> : <Save size={12} />}
                {emailSaved ? "تم" : "حفظ"}
              </button>
            </div>
          </Section>

          <Section title="الاشتراك">
            <div className={`rounded-xl border px-3 py-2.5 text-xs mb-3 flex items-center gap-2 ${
              expired
                ? "border-danger-border bg-danger-bg text-danger"
                : expiringSoon
                ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                : left !== null
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-line/50 bg-panel2 text-muted2"
            }`}>
              <Calendar size={13} className="shrink-0" />
              <span>
                {user.subscription_ends_at
                  ? expired
                    ? `منتهي منذ ${Math.abs(left!)} يوم — ${fmtDate(user.subscription_ends_at)}`
                    : left === 0
                    ? `ينتهي اليوم — ${fmtDate(user.subscription_ends_at)}`
                    : `ينتهي بعد ${left} يوم — ${fmtDate(user.subscription_ends_at)}`
                  : "لا يوجد اشتراك نشط"}
              </span>
            </div>

            <div className="text-[11px] text-muted2 mb-2">إضافة أيام للاشتراك:</div>
            <div className="flex gap-2 flex-wrap mb-3">
              {[30, 60, 90, 180].map((d) => (
                <button
                  key={d}
                  onClick={() => setSubDays(String(d))}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    subDays === String(d)
                      ? "border-blue-500/60 bg-blue-500/20 text-blue-300"
                      : "border-line/70 bg-panel2 text-muted2 hover:border-blue-500/40 hover:text-blue-300"
                  }`}
                >
                  {d} يوم
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <input
                type="number" min="1"
                value={subDays}
                onChange={(e) => setSubDays(e.target.value)}
                placeholder="أو أدخل عدداً مخصصاً..."
                className="flex-1 rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-sm placeholder:text-muted focus:border-blue-500/50 focus:outline-none"
              />
              <button
                onClick={handleSaveSub}
                disabled={savingSub || !subDays}
                className="flex items-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-xs text-blue-300 font-medium hover:bg-blue-500/25 transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                {savingSub ? <Loader2 size={12} className="animate-spin" /> : subSaved ? <Check size={12} /> : <Calendar size={12} />}
                {subSaved ? "تم ✓" : subDays ? `إضافة ${subDays} يوم` : "تعيين"}
              </button>
            </div>
          </Section>

          <Section title="السيرة الذاتية">
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleCvChange} />
            <div className="flex gap-2 flex-wrap">
              {hasCv && (
                <button
                  onClick={handleViewCv}
                  disabled={viewingCv}
                  className="flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                >
                  {viewingCv ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                  {viewingCv ? "جاري الفتح..." : cvFileName || "عرض السيرة"}
                </button>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingCv}
                className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-xs text-ink2 hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-50"
              >
                {uploadingCv ? <Loader2 size={12} className="animate-spin" /> : cvName ? <FileText size={12} /> : <Upload size={12} />}
                {uploadingCv ? "جاري الرفع..." : cvName ? "تم الرفع ✓" : hasCv ? "استبدال السيرة" : "رفع سيرة ذاتية"}
              </button>
            </div>
          </Section>

          <Section title="تفضيلات الوظائف">
            {user.preferences && user.preferences.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {user.preferences.map((p, i) => (
                  <span key={i} className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                    {p}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={togglePrefs}
              className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-xs text-ink2 hover:border-accent/40 hover:text-accent transition-colors w-full justify-between"
            >
              <span className="flex items-center gap-1.5"><Tags size={12} /> تعديل التفضيلات</span>
              {showPrefs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showPrefs && (
              <div className="mt-3 rounded-xl border border-line/60 bg-panel2 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted2">{selectedIds.length} مجال محدد</span>
                  <button
                    onClick={handleSavePrefs}
                    disabled={savingPrefs}
                    className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/15 px-3 py-1.5 text-xs text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
                  >
                    {savingPrefs ? <Loader2 size={11} className="animate-spin" /> : prefsSaved ? <Check size={11} /> : <Save size={11} />}
                    {prefsSaved ? "تم الحفظ" : "حفظ"}
                  </button>
                </div>
                {loadingPrefs ? (
                  <div className="flex items-center gap-2 text-xs text-muted2 py-3">
                    <Loader2 size={13} className="animate-spin" /> جاري التحميل...
                  </div>
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
              </div>
            )}
          </Section>
        </div>

        <div className="px-5 py-4 border-t border-line/60 shrink-0">
          <button
            onClick={() => onDelete(user.id, user.full_name || user.phone || user.id)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-danger-border bg-danger-bg px-4 py-2.5 text-sm text-danger hover:bg-danger/15 transition-colors"
          >
            <Trash2 size={14} />
            حذف هذا المستخدم نهائياً
          </button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted2 uppercase tracking-wider mb-3">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({
  icon, label, value, dir, valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-line/30 last:border-0">
      <span className="flex items-center gap-1.5 text-muted2">{icon}{label}</span>
      <span className={`font-medium text-ink2 max-w-[60%] truncate text-right ${valueClass || ""}`} dir={dir}>{value}</span>
    </div>
  );
}
