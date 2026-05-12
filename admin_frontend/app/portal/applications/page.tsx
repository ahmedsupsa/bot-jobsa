"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";
import { Send, Inbox, ArrowRight, AlertCircle } from "lucide-react";

interface Application {
  id: string;
  job_title: string;
  applied_at: string;
  status: string;
  error_reason?: string;
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalFetch("/applications")
      .then(async res => {
        if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
        const d = await res.json();
        setApps(d.applications || []);
        setCount(d.count || 0);
      })
      .catch(() => { clearToken(); router.replace("/portal/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  const sentCount = apps.filter(a => a.status === "sent").length;
  const errorCount = apps.filter(a => a.status === "error").length;

  return (
    <PortalShell>
      <div style={s.page}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>التقديمات المرسلة</h1>
            <p style={s.sub}>جميع الوظائف التي قدّم عليها البوت باسمك</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={s.countBox}>
              <Send size={18} strokeWidth={1.5} color="var(--text)" />
              <span style={s.countNum}>{sentCount}</span>
              <span style={s.countLabel}>مُرسَل</span>
            </div>
            {errorCount > 0 && (
              <div style={{ ...s.countBox, background: "#fff1f1", border: "1px solid #fca5a5" }}>
                <AlertCircle size={18} strokeWidth={1.5} color="#dc2626" />
                <span style={{ ...s.countNum, color: "#dc2626" }}>{errorCount}</span>
                <span style={{ ...s.countLabel, color: "#dc2626" }}>خطأ</span>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <p style={{ color: "#555", padding: 40, textAlign: "center" }}>جاري التحميل…</p>
        ) : apps.length === 0 ? (
          <div style={s.emptyState}>
            <Inbox size={48} strokeWidth={0.8} color="#333" />
            <h3 style={s.emptyTitle}>لا توجد تقديمات حتى الآن</h3>
            <p style={s.emptySub}>ارفع سيرتك واربط إيميلك ليبدأ البوت في التقديم كل 30 دقيقة</p>
            <button style={s.emptyBtn} onClick={() => router.push("/portal/settings")}>
              إعداد الحساب <ArrowRight size={15} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div style={s.list}>
            {apps.map((a, i) => (
              <div key={a.id} style={s.card}>
                <div style={s.num}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={s.jobTitle}>{a.job_title || "وظيفة"}</p>
                  <p style={s.date}>{fmtDate(a.applied_at)}</p>
                  {a.status === "error" && a.error_reason && (
                    <p style={s.errorMsg}>
                      <AlertCircle size={12} style={{ display: "inline", marginLeft: 4 }} />
                      {truncateError(a.error_reason)}
                    </p>
                  )}
                </div>
                <div style={a.status === "error" ? s.badgeError : s.badge}>
                  <div style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: a.status === "error" ? "#dc2626" : "var(--accent-fg)"
                  }} />
                  {a.status === "error" ? "خطأ" : "مُرسَل"}
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

function truncateError(msg: string): string {
  const clean = msg.replace(/ReferenceError:|TypeError:|Error:/g, "").trim();
  return clean.length > 80 ? clean.slice(0, 77) + "…" : clean;
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 700, margin: "0 auto" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 18, padding: "24px 28px", marginBottom: 24,
    flexWrap: "wrap", gap: 16,
  },
  title: { color: "var(--text)", fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "var(--text3)", fontSize: 13, margin: "4px 0 0" },
  countBox: {
    display: "flex", alignItems: "center", gap: 10,
    background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 14, padding: "12px 20px",
  },
  countNum: { color: "var(--text)", fontSize: 26, fontWeight: 800 },
  countLabel: { color: "var(--text3)", fontSize: 13 },
  emptyState: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
    padding: "60px 40px", textAlign: "center",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
  },
  emptyTitle: { color: "var(--text)", fontSize: 18, fontWeight: 700, margin: 0 },
  emptySub: { color: "var(--text3)", fontSize: 14, maxWidth: 380, lineHeight: 1.6, margin: 0 },
  emptyBtn: {
    display: "flex", alignItems: "center", gap: 8,
    background: "var(--accent)", color: "var(--accent-fg)",
    border: "none", borderRadius: 12,
    padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer",
    marginTop: 8,
  },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  card: {
    display: "flex", alignItems: "flex-start", gap: 16,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 14, padding: "18px 20px",
  },
  num: {
    width: 34, height: 34, borderRadius: "50%",
    background: "var(--surface2)", color: "var(--text)",
    fontSize: 13, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  jobTitle: { color: "var(--text)", fontSize: 14, fontWeight: 600, margin: 0 },
  date: { color: "var(--text3)", fontSize: 12, margin: "4px 0 0" },
  errorMsg: { color: "#dc2626", fontSize: 11, margin: "4px 0 0", lineHeight: 1.5 },
  badge: {
    display: "flex", alignItems: "center", gap: 6,
    background: "var(--accent)", color: "var(--accent-fg)",
    border: "1px solid var(--border2)", borderRadius: 10,
    padding: "5px 12px", fontSize: 12, fontWeight: 600, flexShrink: 0,
  },
  badgeError: {
    display: "flex", alignItems: "center", gap: 6,
    background: "#fff1f1", color: "#dc2626",
    border: "1px solid #fca5a5", borderRadius: 10,
    padding: "5px 12px", fontSize: 12, fontWeight: 600, flexShrink: 0,
  },
};
