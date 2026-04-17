"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken, authHeaders } from "@/lib/portal-auth";
import {
  Upload, Trash2, FileText, CheckCircle, XCircle,
  Bot, Search, Send, Eye, RefreshCw, Calendar,
} from "lucide-react";

interface CVInfo {
  has_cv: boolean;
  file_name?: string;
  updated_at?: string;
  preview_url?: string;
}

export default function CVPage() {
  const router = useRouter();
  const [cv, setCV] = useState<CVInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [drag, setDrag] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadCV() {
    try {
      const res = await portalFetch("/cv");
      if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
      setCV(await res.json());
    } catch { clearToken(); router.replace("/portal/login"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadCV(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/portal/cv/upload", { method: "POST", headers: authHeaders(), body: form });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "فشل الرفع", type: "err" }); return; }
      setMsg({ text: "تم رفع السيرة بنجاح ✓", type: "ok" });
      setShowReplace(false);
      await loadCV();
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function handleDelete() {
    if (!confirm("هل أنت متأكد من حذف السيرة؟")) return;
    setDeleting(true); setMsg(null);
    try {
      const res = await portalFetch("/cv/delete", { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "فشل الحذف", type: "err" }); return; }
      setMsg({ text: "تم حذف السيرة الذاتية", type: "ok" });
      setShowReplace(false);
      await loadCV();
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setDeleting(false); }
  }

  const steps = [
    { icon: <Search size={16} strokeWidth={1.5} />, text: "يقرأ الذكاء الاصطناعي سيرتك ويستخرج مجالاتك ومهاراتك" },
    { icon: <Bot size={16} strokeWidth={1.5} />, text: "كل 30 دقيقة يبحث عن وظائف جديدة تناسب تخصصك" },
    { icon: <Send size={16} strokeWidth={1.5} />, text: "يكتب رسالة تغطية مخصصة ويرسلها باسمك للشركة" },
  ];

  const uploadedAt = cv?.updated_at
    ? new Date(cv.updated_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <PortalShell>
      <div style={s.page}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerIcon}><FileText size={22} strokeWidth={1.5} color="#fff" /></div>
          <div>
            <h1 style={s.title}>السيرة الذاتية</h1>
            <p style={s.sub}>ارفع سيرتك ليقرأها الذكاء الاصطناعي ويقدّم باسمك</p>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "#555", padding: 40, textAlign: "center" }}>جاري التحميل…</p>
        ) : (
          <>
            {msg && (
              <div style={{
                ...s.msg,
                background: msg.type === "ok" ? "#0a1f0a" : "#1a0a0a",
                color: msg.type === "ok" ? "#22c55e" : "#f87171",
                border: `1px solid ${msg.type === "ok" ? "#22c55e22" : "#f8717122"}`,
              }}>
                {msg.type === "ok" ? <CheckCircle size={16} strokeWidth={1.5} /> : <XCircle size={16} strokeWidth={1.5} />}
                {msg.text}
              </div>
            )}

            {/* ── CV EXISTS STATE ── */}
            {cv?.has_cv ? (
              <>
                {/* Big confirmation card */}
                <div style={s.cvBigCard}>
                  <div style={s.cvBigIcon}>
                    <FileText size={32} strokeWidth={1.2} color="#22c55e" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.cvBigBadge}>
                      <CheckCircle size={13} strokeWidth={2} color="#22c55e" />
                      <span>سيرتك الذاتية مرفوعة وجاهزة</span>
                    </div>
                    <p style={s.cvBigName}>{cv.file_name}</p>
                    {uploadedAt && (
                      <div style={s.cvBigDate}>
                        <Calendar size={11} strokeWidth={1.5} />
                        <span>آخر تحديث: {uploadedAt}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={s.cvActions}>
                  {cv.preview_url && (
                    <a href={cv.preview_url} target="_blank" rel="noopener noreferrer" style={s.btnView}>
                      <Eye size={15} strokeWidth={1.5} />
                      معاينة السيرة
                    </a>
                  )}
                  <button
                    style={s.btnReplace}
                    onClick={() => { setShowReplace(v => !v); setMsg(null); }}
                  >
                    <RefreshCw size={14} strokeWidth={1.5} />
                    استبدال السيرة
                  </button>
                  <button style={s.btnDelete} onClick={handleDelete} disabled={deleting}>
                    <Trash2 size={14} strokeWidth={1.5} />
                    {deleting ? "جاري الحذف…" : "حذف"}
                  </button>
                </div>

                {/* Replace drop zone (collapsible) */}
                {showReplace && (
                  <div
                    style={{ ...s.dropZone, ...(drag ? s.dropActive : {}), ...(uploading ? s.dropUploading : {}) }}
                    onClick={() => !uploading && fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={e => {
                      e.preventDefault(); setDrag(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && fileRef.current) {
                        const dt = new DataTransfer(); dt.items.add(file);
                        fileRef.current.files = dt.files;
                        handleUpload({ target: fileRef.current } as any);
                      }
                    }}
                  >
                    <div style={s.dropIcon}>
                      <Upload size={24} strokeWidth={1.5} color={drag ? "#fff" : "#555"} />
                    </div>
                    <p style={s.dropTitle}>{uploading ? "جاري الرفع…" : "اسحب ملفاً أو اضغط لاستبدال السيرة"}</p>
                    <p style={s.dropSub}>PDF · JPG · PNG — حتى 10 ميغابايت</p>
                    <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
                  </div>
                )}
              </>
            ) : (
              /* ── NO CV STATE ── */
              <>
                <div style={s.noCvBanner}>
                  <XCircle size={16} strokeWidth={1.5} color="#f87171" />
                  <span style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>لم تُرفع سيرة ذاتية بعد — ارفع سيرتك لبدء التقديم التلقائي</span>
                </div>

                <div
                  style={{ ...s.dropZone, ...(drag ? s.dropActive : {}), ...(uploading ? s.dropUploading : {}) }}
                  onClick={() => !uploading && fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={e => {
                    e.preventDefault(); setDrag(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file && fileRef.current) {
                      const dt = new DataTransfer(); dt.items.add(file);
                      fileRef.current.files = dt.files;
                      handleUpload({ target: fileRef.current } as any);
                    }
                  }}
                >
                  <div style={s.dropIcon}>
                    <Upload size={28} strokeWidth={1.5} color={drag ? "#fff" : "#555"} />
                  </div>
                  <p style={s.dropTitle}>{uploading ? "جاري الرفع…" : "اسحب ملفاً أو اضغط للرفع"}</p>
                  <p style={s.dropSub}>PDF · JPG · PNG — حتى 10 ميغابايت</p>
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
                </div>
              </>
            )}

            {/* How it works */}
            <div style={s.infoCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <Bot size={18} strokeWidth={1.5} color="#fff" />
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>كيف يعمل الذكاء الاصطناعي؟</span>
              </div>
              {steps.map((step, i) => (
                <div key={i} style={s.step}>
                  <div style={s.stepNum}>{step.icon}</div>
                  <p style={s.stepText}>{step.text}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 620, margin: "0 auto" },
  header: {
    display: "flex", alignItems: "center", gap: 16,
    background: "#111", border: "1px solid #1f1f1f",
    borderRadius: 18, padding: "24px 28px", marginBottom: 24,
  },
  headerIcon: {
    width: 52, height: 52, borderRadius: 14, background: "#1a1a1a",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 },
  sub: { color: "#666", fontSize: 13, margin: "4px 0 0" },
  msg: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "13px 16px", borderRadius: 12, marginBottom: 16, fontSize: 13, fontWeight: 500,
  },

  /* Big CV card */
  cvBigCard: {
    display: "flex", alignItems: "flex-start", gap: 20,
    background: "#0a1a0a", border: "1px solid #22c55e33",
    borderRadius: 18, padding: "24px 28px", marginBottom: 16,
  },
  cvBigIcon: {
    width: 64, height: 64, borderRadius: 16, background: "#0f2a0f",
    border: "1px solid #22c55e44",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  cvBigBadge: {
    display: "inline-flex", alignItems: "center", gap: 6,
    background: "#0f2a0f", border: "1px solid #22c55e33",
    borderRadius: 100, padding: "4px 12px", fontSize: 11,
    fontWeight: 700, color: "#22c55e", marginBottom: 8,
  },
  cvBigName: { color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 8px", wordBreak: "break-all" },
  cvBigDate: {
    display: "flex", alignItems: "center", gap: 5,
    color: "#555", fontSize: 12,
  },

  /* Action buttons */
  cvActions: { display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  btnView: {
    display: "inline-flex", alignItems: "center", gap: 7,
    padding: "10px 18px", borderRadius: 12,
    background: "#fff", color: "#0a0a0a", fontSize: 13, fontWeight: 700,
    textDecoration: "none", cursor: "pointer",
  },
  btnReplace: {
    display: "inline-flex", alignItems: "center", gap: 7,
    padding: "10px 18px", borderRadius: 12,
    background: "#1a1a1a", border: "1px solid #2a2a2a",
    color: "#ccc", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  btnDelete: {
    display: "inline-flex", alignItems: "center", gap: 7,
    padding: "10px 18px", borderRadius: 12,
    background: "#1a0a0a", border: "1px solid #3f1515",
    color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },

  /* No CV banner */
  noCvBanner: {
    display: "flex", alignItems: "center", gap: 10,
    background: "#1a0a0a", border: "1px solid #f8717122",
    borderRadius: 12, padding: "13px 16px", marginBottom: 16,
  },

  /* Drop zone */
  dropZone: {
    background: "#111", border: "1.5px dashed #2a2a2a",
    borderRadius: 16, padding: "44px 28px",
    textAlign: "center", cursor: "pointer", marginBottom: 16,
    transition: "all 0.2s",
  },
  dropActive: { borderColor: "#fff", background: "#1a1a1a" },
  dropUploading: { opacity: 0.6, cursor: "not-allowed" },
  dropIcon: {
    width: 56, height: 56, borderRadius: 16, background: "#1a1a1a",
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 14px",
  },
  dropTitle: { color: "#ccc", fontSize: 15, fontWeight: 600, margin: "0 0 6px" },
  dropSub: { color: "#555", fontSize: 13, margin: 0 },

  /* Info card */
  infoCard: { background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "22px" },
  step: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  stepNum: {
    width: 32, height: 32, borderRadius: 10, background: "#1a1a1a",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, color: "#fff",
  },
  stepText: { color: "#888", fontSize: 13, margin: 0, lineHeight: 1.6, paddingTop: 6 },
};
