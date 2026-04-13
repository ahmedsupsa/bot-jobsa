"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";

interface Application { id: string; job_title: string; applied_at: string; }

export default function ApplicationsPage() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalFetch("/applications")
      .then(async (res) => {
        if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
        const d = await res.json();
        setApps(d.applications || []);
        setCount(d.count || 0);
      })
      .catch(() => { clearToken(); router.replace("/portal/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <PortalShell>
      <div style={s.page}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.title}>التقديمات المرسلة</h1>
            <p style={s.sub}>تتبع جميع الوظائف التي قدّم عليها البوت باسمك</p>
          </div>
          <div style={s.countBadge}>
            <span style={{ fontSize: 20 }}>📤</span>
            <span style={s.countNum}>{count}</span>
            <span style={s.countLabel}>تقديم</span>
          </div>
        </div>

        {loading ? (
          <div style={s.loader}><p style={{ color: "#8b5cf6" }}>⏳ جاري التحميل…</p></div>
        ) : apps.length === 0 ? (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>📭</div>
            <h3 style={s.emptyTitle}>لا توجد تقديمات حتى الآن</h3>
            <p style={s.emptySub}>بمجرد ربط إيميلك ورفع سيرتك، سيبدأ البوت تلقائياً في التقديم كل 30 دقيقة</p>
            <button style={s.emptyBtn} onClick={() => router.push("/portal/settings")}>
              ابدأ الآن ←
            </button>
          </div>
        ) : (
          <div style={s.list}>
            {apps.map((a, i) => (
              <div key={a.id} style={s.card}>
                <div style={s.cardNum}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <p style={s.jobTitle}>{a.job_title || "وظيفة"}</p>
                  <p style={s.date}>📅 {fmtDate(a.applied_at)}</p>
                </div>
                <div style={s.sentBadge}>
                  <span>✓</span>
                  <span>مُرسَل</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalShell>
  );
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso.slice(0, 16); }
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 720, margin: "0 auto" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    borderRadius: 20, padding: "24px 28px", marginBottom: 28, flexWrap: "wrap", gap: 16,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 },
  sub: { color: "rgba(255,255,255,0.75)", fontSize: 13, margin: "4px 0 0" },
  countBadge: {
    background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
    borderRadius: 16, padding: "12px 20px",
    display: "flex", alignItems: "center", gap: 8,
  },
  countNum: { color: "#fff", fontSize: 28, fontWeight: 900 },
  countLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  loader: { textAlign: "center", padding: 60 },
  emptyState: {
    background: "#fff", borderRadius: 20, padding: "60px 40px",
    textAlign: "center", boxShadow: "0 2px 16px rgba(99,102,241,0.07)",
    border: "1px solid #ede9fe",
  },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { color: "#1e1b4b", fontSize: 18, fontWeight: 700, margin: "0 0 8px" },
  emptySub: { color: "#9ca3af", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 },
  emptyBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff", border: "none", borderRadius: 12,
    padding: "12px 28px", fontSize: 14, fontWeight: 700,
    cursor: "pointer", boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
  },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    display: "flex", alignItems: "center", gap: 16,
    background: "#fff", borderRadius: 16, padding: "18px 20px",
    boxShadow: "0 2px 12px rgba(99,102,241,0.07)",
    border: "1px solid #ede9fe", transition: "box-shadow 0.2s",
  },
  cardNum: {
    width: 36, height: 36, borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff", fontSize: 13, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  jobTitle: { color: "#1e1b4b", fontSize: 14, fontWeight: 600, margin: 0 },
  date: { color: "#9ca3af", fontSize: 12, margin: "4px 0 0" },
  sentBadge: {
    display: "flex", alignItems: "center", gap: 5,
    background: "#ecfdf5", color: "#059669",
    border: "1.5px solid #6ee7b7", borderRadius: 10,
    padding: "5px 12px", fontSize: 12, fontWeight: 600, flexShrink: 0,
  },
};
