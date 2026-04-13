"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken, authHeaders } from "@/lib/portal-auth";

interface CVInfo {
  has_cv: boolean;
  file_name?: string;
  updated_at?: string;
}

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
    setUploading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/portal/cv/upload", {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "فشل الرفع", type: "err" }); return; }
      setMsg({ text: "✓ تم رفع السيرة بنجاح", type: "ok" });
      await loadCV();
    } catch {
      setMsg({ text: "خطأ في الاتصال", type: "err" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!confirm("هل أنت متأكد من حذف السيرة الذاتية؟")) return;
    setDeleting(true);
    setMsg(null);
    try {
      const res = await portalFetch("/cv/delete", { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "فشل الحذف", type: "err" }); return; }
      setMsg({ text: "تم حذف السيرة", type: "ok" });
      await loadCV();
    } catch {
      setMsg({ text: "خطأ في الاتصال", type: "err" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PortalShell>
      <div style={s.container}>
        <h1 style={s.title}>📎 السيرة الذاتية</h1>

        {loading ? (
          <p style={s.loading}>جاري التحميل…</p>
        ) : (
          <>
            {msg && (
              <div style={{ ...s.msg, background: msg.type === "ok" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", color: msg.type === "ok" ? "#34d399" : "#f87171", border: `1px solid ${msg.type === "ok" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}` }}>
                {msg.text}
              </div>
            )}

            {cv?.has_cv ? (
              <div style={s.cvCard}>
                <div style={s.cvIcon}>📄</div>
                <div style={{ flex: 1 }}>
                  <p style={s.cvName}>{cv.file_name || "السيرة الذاتية"}</p>
                  {cv.updated_at && (
                    <p style={s.cvDate}>
                      آخر تحديث: {new Date(cv.updated_at).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  )}
                  <div style={s.cvStatusBadge}>✓ مرفوعة</div>
                </div>
              </div>
            ) : (
              <div style={s.emptyCard}>
                <p style={{ fontSize: 48 }}>📂</p>
                <p style={s.emptyTitle}>لا توجد سيرة ذاتية مرفوعة</p>
                <p style={s.emptySub}>ارفع سيرتك لبدء التقديم التلقائي بالذكاء الاصطناعي</p>
              </div>
            )}

            {/* Upload area */}
            <div
              style={s.uploadArea}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file && fileRef.current) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  fileRef.current.files = dt.files;
                  handleUpload({ target: fileRef.current } as any);
                }
              }}
            >
              <span style={{ fontSize: 32 }}>⬆️</span>
              <p style={s.uploadText}>
                {uploading ? "جاري الرفع…" : cv?.has_cv ? "اضغط لاستبدال السيرة الذاتية" : "اضغط لرفع السيرة الذاتية"}
              </p>
              <p style={s.uploadSub}>PDF أو صورة (JPG, PNG) — الحد الأقصى 10 ميغابايت</p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: "none" }}
                onChange={handleUpload}
                disabled={uploading}
              />
            </div>

            {cv?.has_cv && (
              <button
                style={s.deleteBtn}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "جاري الحذف…" : "🗑️ حذف السيرة الذاتية"}
              </button>
            )}

            <div style={s.infoBox}>
              <p style={s.infoTitle}>💡 كيف يعمل التقديم التلقائي؟</p>
              <p style={s.infoText}>بعد رفع سيرتك، يقرأ الذكاء الاصطناعي محتواها ويستخرج مجالاتك المهنية. ثم يقدّم تلقائياً على الوظائف المناسبة كل 30 دقيقة بإيميل مخصص باسمك.</p>
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 600, margin: "0 auto" },
  title: { color: "#e8f0ff", fontSize: 22, fontWeight: 700, marginBottom: 24 },
  loading: { color: "#7a9cc5", textAlign: "center", padding: 60 },
  msg: { padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 14 },
  cvCard: {
    display: "flex", alignItems: "center", gap: 16,
    background: "linear-gradient(135deg, #111e38, #0d1628)",
    border: "1px solid rgba(52,211,153,0.3)", borderRadius: 14,
    padding: "20px 24px", marginBottom: 20,
  },
  cvIcon: { fontSize: 40 },
  cvName: { color: "#e8f0ff", fontSize: 15, fontWeight: 600, margin: 0 },
  cvDate: { color: "#7a9cc5", fontSize: 12, margin: "4px 0 8px" },
  cvStatusBadge: { display: "inline-block", padding: "4px 12px", background: "rgba(52,211,153,0.12)", color: "#34d399", borderRadius: 8, fontSize: 12 },
  emptyCard: {
    background: "#0d1628", border: "1px solid #1a2d52", borderRadius: 14,
    padding: "32px 24px", textAlign: "center", marginBottom: 20,
  },
  emptyTitle: { color: "#c0d4f0", fontSize: 15, fontWeight: 600, margin: "8px 0 4px" },
  emptySub: { color: "#7a9cc5", fontSize: 13, margin: 0 },
  uploadArea: {
    background: "#0d1628",
    border: "2px dashed #1a2d52",
    borderRadius: 14,
    padding: "36px 24px",
    textAlign: "center",
    cursor: "pointer",
    marginBottom: 16,
    transition: "border-color 0.2s",
  },
  uploadText: { color: "#c0d4f0", fontSize: 15, fontWeight: 500, margin: "10px 0 4px" },
  uploadSub: { color: "#7a9cc5", fontSize: 12, margin: 0 },
  deleteBtn: {
    width: "100%", padding: "12px",
    background: "rgba(248,113,113,0.1)",
    border: "1px solid rgba(248,113,113,0.3)",
    borderRadius: 10, color: "#f87171", fontSize: 14, cursor: "pointer", marginBottom: 20,
  },
  infoBox: { background: "rgba(79,142,247,0.08)", border: "1px solid rgba(79,142,247,0.2)", borderRadius: 12, padding: "16px 20px" },
  infoTitle: { color: "#4f8ef7", fontSize: 14, fontWeight: 600, margin: "0 0 6px" },
  infoText: { color: "#7a9cc5", fontSize: 13, margin: 0, lineHeight: 1.6 },
};
