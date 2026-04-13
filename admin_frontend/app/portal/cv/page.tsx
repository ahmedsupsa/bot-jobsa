"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken, authHeaders } from "@/lib/portal-auth";

interface CVInfo { has_cv: boolean; file_name?: string; updated_at?: string; }

export default function CVPage() {
  const router = useRouter();
  const [cv, setCV] = useState<CVInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadCV() {
    try {
      const res = await portalFetch("/cv");
      if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
      setCV(await res.json());
    } catch {
      clearToken(); router.replace("/portal/login");
    } finally {
      setLoading(false);
    }
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
      setMsg({ text: "✓ تم رفع السيرة بنجاح!", type: "ok" });
      await loadCV();
    } catch {
      setMsg({ text: "خطأ في الاتصال", type: "err" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!confirm("هل أنت متأكد من حذف السيرة؟")) return;
    setDeleting(true); setMsg(null);
    try {
      const res = await portalFetch("/cv/delete", { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "فشل", type: "err" }); return; }
      setMsg({ text: "تم حذف السيرة الذاتية", type: "ok" });
      await loadCV();
    } catch {
      setMsg({ text: "خطأ في الاتصال", type: "err" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PortalShell>
      <div style={s.page}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>السيرة الذاتية</h1>
            <p style={s.sub}>ارفع سيرتك ليقرأها الذكاء الاصطناعي ويقدّم باسمك</p>
          </div>
          <div style={s.headerIcon}>📎</div>
        </div>

        {loading ? (
          <p style={{ color: "#8b5cf6", padding: 40, textAlign: "center" }}>⏳ جاري التحميل…</p>
        ) : (
          <>
            {msg && (
              <div style={{
                ...s.msg,
                background: msg.type === "ok" ? "#ecfdf5" : "#fef2f2",
                color: msg.type === "ok" ? "#059669" : "#dc2626",
                border: `1.5px solid ${msg.type === "ok" ? "#6ee7b7" : "#fca5a5"}`,
              }}>
                {msg.type === "ok" ? "✅" : "❌"} {msg.text}
              </div>
            )}

            {cv?.has_cv && (
              <div style={s.cvCard}>
                <div style={s.cvIconWrap}>📄</div>
                <div style={{ flex: 1 }}>
                  <p style={s.cvName}>{cv.file_name}</p>
                  {cv.updated_at && (
                    <p style={s.cvDate}>
                      آخر تحديث: {new Date(cv.updated_at).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  )}
                  <span style={s.cvBadge}>✓ مرفوعة ونشطة</span>
                </div>
              </div>
            )}

            {/* Upload zone */}
            <div
              style={{ ...s.uploadZone, ...(uploading ? s.uploadZoneActive : {}) }}
              onClick={() => !uploading && fileRef.current?.click()}
            >
              <div style={s.uploadIconWrap}>{uploading ? "⏳" : "⬆️"}</div>
              <p style={s.uploadTitle}>
                {uploading ? "جاري الرفع…" : cv?.has_cv ? "اضغط لاستبدال السيرة" : "اضغط لرفع سيرتك الذاتية"}
              </p>
              <p style={s.uploadSub}>PDF أو صورة (JPG, PNG) — حتى 10 ميغابايت</p>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
            </div>

            {cv?.has_cv && (
              <button style={s.deleteBtn} onClick={handleDelete} disabled={deleting}>
                {deleting ? "جاري الحذف…" : "🗑️ حذف السيرة الذاتية"}
              </button>
            )}

            {/* Info box */}
            <div style={s.infoBox}>
              <h3 style={s.infoTitle}>🤖 كيف يعمل الذكاء الاصطناعي؟</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { step: "1", text: "يقرأ الذكاء الاصطناعي محتوى سيرتك ويستخرج مجالاتك ومهاراتك" },
                  { step: "2", text: "كل 30 دقيقة يبحث عن وظائف جديدة تناسب تخصصك" },
                  { step: "3", text: "يكتب رسالة تغطية مخصصة ويرسلها باسمك إلى الشركة" },
                ].map(({ step, text }) => (
                  <div key={step} style={s.step}>
                    <div style={s.stepNum}>{step}</div>
                    <p style={s.stepText}>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 640, margin: "0 auto" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    borderRadius: 20, padding: "24px 28px", marginBottom: 24,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 },
  sub: { color: "rgba(255,255,255,0.8)", fontSize: 13, margin: "4px 0 0" },
  headerIcon: { fontSize: 44 },
  msg: { padding: "14px 18px", borderRadius: 12, marginBottom: 18, fontSize: 14, fontWeight: 500 },
  cvCard: {
    display: "flex", alignItems: "center", gap: 16,
    background: "#fff", border: "1.5px solid #6ee7b7",
    borderRadius: 16, padding: "20px 24px", marginBottom: 20,
    boxShadow: "0 4px 16px rgba(16,185,129,0.1)",
  },
  cvIconWrap: { fontSize: 40 },
  cvName: { color: "#1e1b4b", fontSize: 14, fontWeight: 700, margin: 0 },
  cvDate: { color: "#9ca3af", fontSize: 12, margin: "4px 0 8px" },
  cvBadge: {
    display: "inline-block", background: "#ecfdf5", color: "#059669",
    border: "1px solid #6ee7b7", borderRadius: 8, padding: "3px 12px", fontSize: 11, fontWeight: 600,
  },
  uploadZone: {
    background: "#fff", border: "2.5px dashed #c4b5fd", borderRadius: 18,
    padding: "44px 28px", textAlign: "center", cursor: "pointer",
    marginBottom: 16, transition: "all 0.2s",
  },
  uploadZoneActive: { background: "#f5f3ff", borderColor: "#6366f1" },
  uploadIconWrap: { fontSize: 40, marginBottom: 12 },
  uploadTitle: { color: "#1e1b4b", fontSize: 16, fontWeight: 700, margin: "0 0 6px" },
  uploadSub: { color: "#9ca3af", fontSize: 13, margin: 0 },
  deleteBtn: {
    width: "100%", padding: "12px",
    background: "#fef2f2", border: "1.5px solid #fca5a5",
    borderRadius: 12, color: "#dc2626", fontSize: 13,
    fontWeight: 600, cursor: "pointer", marginBottom: 24,
  },
  infoBox: { background: "#f5f3ff", border: "1px solid #ede9fe", borderRadius: 18, padding: "24px" },
  infoTitle: { color: "#4c1d95", fontSize: 15, fontWeight: 700, margin: "0 0 18px" },
  step: { display: "flex", alignItems: "flex-start", gap: 12 },
  stepNum: {
    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff", fontSize: 13, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  stepText: { color: "#4c1d95", fontSize: 13, margin: 0, lineHeight: 1.6 },
};
