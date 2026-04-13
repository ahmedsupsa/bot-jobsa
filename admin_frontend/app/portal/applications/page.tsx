"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";

interface Application {
  id: string;
  job_title: string;
  applied_at: string;
}

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
      <div style={s.container}>
        <div style={s.header}>
          <h1 style={s.title}>📋 التقديمات</h1>
          <div style={s.countBadge}>{count} تقديم</div>
        </div>

        {loading ? (
          <p style={s.loading}>جاري التحميل…</p>
        ) : apps.length === 0 ? (
          <div style={s.empty}>
            <p style={{ fontSize: 48 }}>📭</p>
            <p style={s.emptyTitle}>لا توجد تقديمات حتى الآن</p>
            <p style={s.emptySub}>البوت يعمل كل 30 دقيقة ويقدّم تلقائياً على الوظائف المناسبة</p>
          </div>
        ) : (
          <div style={s.list}>
            {apps.map((a, i) => (
              <div key={a.id} style={s.card}>
                <div style={s.num}>{i + 1}</div>
                <div style={s.info}>
                  <p style={s.jobTitle}>{a.job_title || "وظيفة"}</p>
                  <p style={s.date}>{formatDate(a.applied_at)}</p>
                </div>
                <div style={s.badge}>✓ مُرسَل</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalShell>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso.slice(0, 16); }
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 700, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  title: { color: "#e8f0ff", fontSize: 22, fontWeight: 700, margin: 0 },
  countBadge: { background: "rgba(79,142,247,0.15)", color: "#4f8ef7", border: "1px solid rgba(79,142,247,0.3)", padding: "6px 16px", borderRadius: 20, fontSize: 14, fontWeight: 600 },
  loading: { color: "#7a9cc5", textAlign: "center", padding: 40 },
  empty: { textAlign: "center", padding: "60px 20px", background: "#0d1628", border: "1px solid #1a2d52", borderRadius: 16 },
  emptyTitle: { color: "#c0d4f0", fontSize: 16, fontWeight: 600, margin: "8px 0 4px" },
  emptySub: { color: "#7a9cc5", fontSize: 13 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  card: {
    display: "flex", alignItems: "center", gap: 14,
    background: "#0d1628", border: "1px solid #1a2d52",
    borderRadius: 12, padding: "16px 18px",
  },
  num: {
    width: 32, height: 32, borderRadius: "50%",
    background: "rgba(79,142,247,0.12)", color: "#4f8ef7",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 600, flexShrink: 0,
  },
  info: { flex: 1 },
  jobTitle: { color: "#e8f0ff", fontSize: 14, fontWeight: 500, margin: 0 },
  date: { color: "#7a9cc5", fontSize: 12, margin: "3px 0 0" },
  badge: { padding: "5px 12px", background: "rgba(52,211,153,0.12)", color: "#34d399", borderRadius: 8, fontSize: 12, flexShrink: 0 },
};
