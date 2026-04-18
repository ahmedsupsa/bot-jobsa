"use client";
import { useEffect, useState } from "react";
import { Send, Wifi, Eye, User, Briefcase, ChevronDown, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface UserRow { id: string; full_name: string; email: string; phone: string; lang: string; }
interface JobRow  { id: string; title_ar: string; title_en: string; company: string; }

type Status = { ok: boolean; msg: string } | null;

const C = {
  bg: "#0a0a0a", card: "#111", border: "#222", text: "#fff", muted: "#888",
  purple: "#a78bfa", purpleDim: "rgba(167,139,250,0.12)",
  success: "#4ade80", error: "#f87171",
};

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

  // auto-fill toEmail from selected user
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

  const sel: React.CSSProperties = {
    width: "100%", background: C.card, color: C.text, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none",
    appearance: "none", WebkitAppearance: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "28px 20px", direction: "rtl" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ color: C.text, fontSize: 22, fontWeight: 800, margin: 0 }}>اختبار القالب والإرسال</h1>
            <p style={{ color: C.muted, fontSize: 13, margin: "6px 0 0" }}>شاهد القالب قبل الإرسال وتحقق من الاتصال</p>
          </div>
          <button
            onClick={handleConnection}
            disabled={connLoading}
            style={{ display: "flex", alignItems: "center", gap: 8, background: C.purpleDim, color: C.purple, border: `1px solid rgba(167,139,250,0.3)`, borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            {connLoading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Wifi size={15} />}
            اختبار الاتصال
          </button>
        </div>

        {connStatus && (
          <div style={{ background: connStatus.ok ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${connStatus.ok ? C.success : C.error}40`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: connStatus.ok ? C.success : C.error, fontSize: 13 }}>
            {connStatus.msg}
          </div>
        )}

        <div className="email-test-grid" style={{ display: "grid", gridTemplateColumns: "minmax(280px,1fr) minmax(320px,2fr)", gap: 20, alignItems: "start" }}>

          {/* Controls Panel */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>

            {/* User selector */}
            <div>
              <label style={{ color: C.muted, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8 }}>
                <User size={12} style={{ display: "inline", marginLeft: 5, verticalAlign: "middle" }} />
                اختر المستخدم
              </label>
              <div style={{ position: "relative" }}>
                <select value={userId} onChange={e => setUserId(e.target.value)} style={sel}>
                  <option value="">-- كل المستخدمين (نموذج) --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || "بدون اسم"} {u.email ? `— ${u.email}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted, pointerEvents: "none" }} />
              </div>
              {userId && (() => { const u = users.find(x => x.id === userId); return u ? (
                <div style={{ marginTop: 8, background: "#0d0d0d", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                  <div style={{ color: C.text }}>{u.full_name}</div>
                  <div style={{ color: C.muted }}>{u.email || "بدون إيميل"} • {u.phone || "—"}</div>
                </div>
              ) : null; })()}
            </div>

            {/* Job selector */}
            <div>
              <label style={{ color: C.muted, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8 }}>
                <Briefcase size={12} style={{ display: "inline", marginLeft: 5, verticalAlign: "middle" }} />
                اختر الوظيفة
              </label>
              <div style={{ position: "relative" }}>
                <select value={jobId} onChange={e => setJobId(e.target.value)} style={sel}>
                  <option value="">-- وظيفة نموذجية --</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.title_ar || j.title_en} {j.company ? `— ${j.company}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted, pointerEvents: "none" }} />
              </div>
            </div>

            {/* Language */}
            <div>
              <label style={{ color: C.muted, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8 }}>لغة الإيميل</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["ar","en"] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)} style={{
                    flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: lang === l ? C.purple : C.bg,
                    color: lang === l ? "#0a0a0a" : C.muted,
                    border: `1px solid ${lang === l ? C.purple : C.border}`,
                  }}>{l === "ar" ? "🇸🇦 عربي" : "🇬🇧 English"}</button>
                ))}
              </div>
            </div>

            {/* Preview button */}
            <button
              onClick={handlePreview}
              disabled={loading}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff", color: "#0a0a0a", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }}
            >
              {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Eye size={16} />}
              معاينة القالب
            </button>

            {/* Send section */}
            {preview && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 600 }}>إرسال إلى (إيميل تجريبي)</label>
                <input
                  value={toEmail}
                  onChange={e => setToEmail(e.target.value)}
                  placeholder="example@email.com"
                  style={{ ...sel, direction: "ltr", textAlign: "left" }}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !toEmail}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#a78bfa22", color: C.purple, border: `1px solid rgba(167,139,250,0.4)`, borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%" }}
                >
                  {sending ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}
                  إرسال تجريبي
                </button>
                {sendStatus && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: sendStatus.ok ? C.success : C.error }}>
                    {sendStatus.ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
                    {sendStatus.msg}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
            {!preview && !loading && (
              <div style={{ padding: 48, textAlign: "center", color: C.muted }}>
                <Eye size={40} style={{ margin: "0 auto 14px", opacity: 0.3, display: "block" }} />
                <p style={{ margin: 0, fontSize: 14 }}>اضغط "معاينة القالب" لترى الإيميل اللي يُرسَل للشركة</p>
              </div>
            )}
            {loading && (
              <div style={{ padding: 48, textAlign: "center", color: C.muted }}>
                <Loader2 size={32} style={{ margin: "0 auto 14px", display: "block", animation: "spin 1s linear infinite" }} />
                <p style={{ margin: 0, fontSize: 13 }}>يولّد رسالة التغطية بالذكاء الاصطناعي…</p>
              </div>
            )}
            {preview && !loading && (
              <>
                <div style={{ padding: "14px 18px", background: "#0d0d0d", borderBottom: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: C.muted, fontSize: 12, flexShrink: 0 }}>الموضوع:</span>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{preview.subject}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: C.muted, fontSize: 12, flexShrink: 0 }}>من:</span>
                    <span style={{ color: C.muted, fontSize: 12 }}>{preview.from_name}</span>
                  </div>
                </div>
                <iframe
                  srcDoc={preview.html}
                  style={{ width: "100%", height: 440, border: "none", display: "block", background: "#fff" }}
                  title="email-preview"
                  sandbox="allow-same-origin"
                />
              </>
            )}
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @media (max-width: 768px) {
          .email-test-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
