"use client";
import { useEffect, useState } from "react";
import { Send, Wifi, Eye, User, Briefcase, ChevronDown, CheckCircle, XCircle, Loader2 } from "lucide-react";
import Shell from "@/components/shell";

interface UserRow { id: string; full_name: string; email: string; phone: string; lang: string; }
interface JobRow  { id: string; title_ar: string; title_en: string; company: string; }

type Status = { ok: boolean; msg: string } | null;

export default function EmailTestPage() {
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [jobs, setJobs]       = useState<JobRow[]>([]);
  const [userId, setUserId]   = useState("");
  const [jobId, setJobId]     = useState("");
  const [lang, setLang]       = useState("ar");
  const [toEmail, setToEmail] = useState("");
  const [preview, setPreview] = useState<{ html: string; subject: string; from_name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [connStatus, setConnStatus] = useState<Status>(null);
  const [connLoading, setConnLoading] = useState(false);
  const [sendStatus, setSendStatus] = useState<Status>(null);

  useEffect(() => {
    fetch("/api/admin/email-test")
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setJobs(d.jobs || []); });
  }, []);

  useEffect(() => {
    const u = users.find(x => x.id === userId);
    if (u?.email) setToEmail(u.email);
    if (u?.lang)  setLang(u.lang);
  }, [userId, users]);

  const handlePreview = async () => {
    setLoading(true); setPreview(null); setSendStatus(null);
    const r = await fetch("/api/admin/email-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", user_id: userId, job_id: jobId, lang }),
    });
    const d = await r.json();
    if (d.ok) setPreview(d);
    setLoading(false);
  };

  const handleSend = async () => {
    if (!preview || !toEmail) return;
    setSending(true); setSendStatus(null);
    const r = await fetch("/api/admin/email-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        to_email: toEmail,
        subject: preview.subject,
        html: preview.html,
        from_name: preview.from_name,
      }),
    });
    const d = await r.json();
    setSendStatus({ ok: d.ok, msg: d.ok ? `✅ أُرسل إلى ${toEmail}` : d.error || "خطأ" });
    setSending(false);
  };

  const handleConnection = async () => {
    setConnLoading(true); setConnStatus(null);
    const r = await fetch("/api/admin/email-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connection" }),
    });
    const d = await r.json();
    setConnStatus({
      ok: d.ok,
      msg: d.ok
        ? `✅ الاتصال يعمل — النطاقات: ${(d.domains || []).join(", ") || "لا يوجد"}`
        : `❌ ${d.error}`,
    });
    setConnLoading(false);
  };

  const selectedUser = users.find(x => x.id === userId);

  return (
    <Shell>
      <div className="max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink m-0">اختبار القالب والإرسال</h1>
            <p className="text-sm text-muted mt-1 m-0">شاهد القالب قبل الإرسال وتحقق من الاتصال</p>
          </div>
          <button
            onClick={handleConnection}
            disabled={connLoading}
            className="flex items-center gap-2 rounded-xl border border-line bg-panel2 px-4 py-2.5 text-sm font-semibold text-ink2 hover:text-ink transition-all disabled:opacity-50"
          >
            {connLoading ? <Loader2 size={15} className="animate-spin" /> : <Wifi size={15} />}
            اختبار الاتصال
          </button>
        </div>

        {connStatus && (
          <div className={`rounded-xl border px-4 py-3 mb-5 text-sm ${connStatus.ok ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
            {connStatus.msg}
          </div>
        )}

        <div className="email-test-grid grid gap-5" style={{ gridTemplateColumns: "minmax(260px,1fr) minmax(300px,2fr)" }}>

          {/* Controls Panel */}
          <div className="rounded-2xl border border-line bg-panel p-5 flex flex-col gap-5">

            {/* User selector */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-muted mb-2 font-semibold">
                <User size={12} />
                اختر المستخدم
              </label>
              <div className="relative">
                <select
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-[var(--input-bg)] text-ink px-3 py-2.5 text-sm outline-none appearance-none"
                >
                  <option value="">-- كل المستخدمين (نموذج) --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || "بدون اسم"} {u.email ? `— ${u.email}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
              {selectedUser && (
                <div className="mt-2 rounded-lg bg-panel2 border border-line px-3 py-2 text-xs">
                  <div className="text-ink font-medium">{selectedUser.full_name}</div>
                  <div className="text-muted">{selectedUser.email || "بدون إيميل"} • {selectedUser.phone || "—"}</div>
                </div>
              )}
            </div>

            {/* Job selector */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-muted mb-2 font-semibold">
                <Briefcase size={12} />
                اختر الوظيفة
              </label>
              <div className="relative">
                <select
                  value={jobId}
                  onChange={e => setJobId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-[var(--input-bg)] text-ink px-3 py-2.5 text-sm outline-none appearance-none"
                >
                  <option value="">-- وظيفة نموذجية --</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.title_ar || j.title_en} {j.company ? `— ${j.company}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="text-xs text-muted mb-2 font-semibold block">لغة الإيميل</label>
              <div className="flex gap-2">
                {(["ar","en"] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      lang === l
                        ? "bg-accent text-accent-fg border-accent"
                        : "bg-panel2 text-muted border-line hover:text-ink"
                    }`}
                  >
                    {l === "ar" ? "🇸🇦 عربي" : "🇬🇧 English"}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview button */}
            <button
              onClick={handlePreview}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-accent text-accent-fg py-3 text-sm font-bold disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
              معاينة القالب
            </button>

            {/* Send section */}
            {preview && (
              <div className="border-t border-line pt-4 flex flex-col gap-3">
                <label className="text-xs text-muted font-semibold">إرسال إلى (إيميل تجريبي)</label>
                <input
                  value={toEmail}
                  onChange={e => setToEmail(e.target.value)}
                  placeholder="example@email.com"
                  dir="ltr"
                  className="w-full rounded-xl border border-line bg-[var(--input-bg)] text-ink px-3 py-2.5 text-sm outline-none text-right"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !toEmail}
                  className="flex items-center justify-center gap-2 w-full rounded-xl border border-line bg-panel2 text-ink2 hover:text-ink py-3 text-sm font-semibold disabled:opacity-40 transition-all"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  إرسال تجريبي
                </button>
                {sendStatus && (
                  <div className={`flex items-center gap-2 text-xs rounded-xl border px-3 py-2 ${sendStatus.ok ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
                    {sendStatus.ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
                    {sendStatus.msg}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="rounded-2xl border border-line bg-panel overflow-hidden">
            {!preview && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-muted text-center px-6">
                <Eye size={40} className="mb-4 opacity-30" />
                <p className="text-sm m-0">اضغط "معاينة القالب" لترى الإيميل اللي يُرسَل للشركة</p>
              </div>
            )}
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 text-muted text-center">
                <Loader2 size={32} className="mb-4 animate-spin" />
                <p className="text-sm m-0">يولّد رسالة التغطية بالذكاء الاصطناعي…</p>
              </div>
            )}
            {preview && !loading && (
              <>
                <div className="px-4 py-3 bg-panel2 border-b border-line flex flex-col gap-1">
                  <div className="flex gap-2 items-center">
                    <span className="text-muted text-xs flex-shrink-0">الموضوع:</span>
                    <span className="text-ink text-sm font-semibold">{preview.subject}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-muted text-xs flex-shrink-0">من:</span>
                    <span className="text-muted text-xs">{preview.from_name}</span>
                  </div>
                </div>
                <iframe
                  srcDoc={preview.html}
                  className="w-full border-none block bg-white"
                  style={{ height: 440 }}
                  title="email-preview"
                  sandbox="allow-same-origin"
                />
              </>
            )}
          </div>

        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .email-test-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </Shell>
  );
}
