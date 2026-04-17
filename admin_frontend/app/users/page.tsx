"use client";

import Shell from "@/components/shell";
import { apiGet, apiSend } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Save, User, FileText, Upload, Check, Loader2 } from "lucide-react";

type UserRow = {
  id: string;
  full_name: string;
  telegram_id: number;
  email: string;
  phone?: string;
  city?: string;
  subscription_ends_at?: string;
  created_at: string;
};

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
      `${r.full_name} ${r.telegram_id} ${r.email} ${r.phone} ${r.city}`.toLowerCase().includes(s)
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
    setMsg(`تم رفع السيرة لـ ${file.name} ✓`); setMsgType("ok");
  };

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">المستخدمون</h1>
        <p className="text-sm text-slate-400 mt-0.5">إدارة حسابات المشتركين — البريد والسيرة الذاتية</p>
      </div>

      {msg && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          msgType === "ok"
            ? "border-emerald-500/25 bg-emerald-950/30 text-emerald-300"
            : "border-red-500/25 bg-red-950/30 text-red-300"
        }`}>
          {msg}
        </div>
      )}

      <div className="rounded-2xl border border-line/70 bg-panel shadow-card">
        <div className="border-b border-line/60 px-5 py-4">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالاسم أو الجوال أو المدينة أو البريد..."
              className="w-full rounded-xl border border-line/70 bg-panel2 pr-9 pl-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
            />
          </div>
        </div>
        <div className="px-5 py-2.5 border-b border-line/40 text-xs text-slate-500">
          {filtered.length} مستخدم
        </div>
        <div className="divide-y divide-line/40">
          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">لا توجد نتائج</div>
          ) : (
            filtered.map((u) => (
              <UserCard key={u.id} user={u} onSaveEmail={updateEmail} onUploadCv={uploadCv} />
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
}: {
  user: UserRow;
  onSaveEmail: (id: string, email: string) => Promise<void>;
  onUploadCv: (id: string, file: File) => Promise<void>;
}) {
  const [email, setEmail] = useState(user.email || "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvName, setCvName] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSaveEmail = async () => {
    setSavingEmail(true); setErr("");
    try {
      await onSaveEmail(user.id, email);
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2500);
    } catch (e) { setErr(String(e)); }
    finally { setSavingEmail(false); }
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
          <div className="text-sm font-semibold text-white truncate">{user.full_name || "—"}</div>
          <div className="text-xs text-slate-500 flex gap-3 flex-wrap mt-0.5">
            {user.phone && <span>{user.phone}</span>}
            {user.city && <span>{user.city}</span>}
            {endsAt && <span className="text-slate-600">ينتهي: {endsAt}</span>}
          </div>
        </div>
      </div>

      {err && <div className="text-xs text-red-400 bg-red-950/30 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}

      {/* Email + CV row */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* Email */}
        <div className="flex gap-2 flex-1">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="البريد الإلكتروني"
            dir="ltr"
            className="flex-1 min-w-0 rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
          />
          <button
            onClick={handleSaveEmail}
            disabled={savingEmail}
            className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/15 px-3 py-2 text-xs text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {savingEmail
              ? <Loader2 size={12} className="animate-spin" />
              : emailSaved
                ? <Check size={12} className="text-emerald-400" />
                : <Save size={12} />}
            {savingEmail ? "..." : emailSaved ? "تم" : "حفظ"}
          </button>
        </div>

        {/* CV Upload */}
        <div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleCvChange} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingCv}
            className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-xs text-slate-300 hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-50 whitespace-nowrap w-full sm:w-auto justify-center"
          >
            {uploadingCv
              ? <Loader2 size={12} className="animate-spin" />
              : cvName
                ? <FileText size={12} className="text-emerald-400" />
                : <Upload size={12} />}
            {uploadingCv ? "جاري الرفع..." : cvName ? `تم: ${cvName.slice(0, 15)}...` : "رفع سيرة ذاتية"}
          </button>
        </div>
      </div>
    </div>
  );
}
