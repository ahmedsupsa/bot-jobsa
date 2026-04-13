"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";

interface UserData {
  full_name: string;
  phone: string;
  city: string;
  subscription_active: boolean;
  days_left: number;
  subscription_ends_at: string;
  email: string;
  sender_email_alias: string;
  applications_count: number;
}

interface Application {
  id: string;
  job_title: string;
  applied_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, appsRes] = await Promise.all([
          portalFetch("/me"),
          portalFetch("/applications"),
        ]);
        if (meRes.status === 401) { clearToken(); router.replace("/portal/login"); return; }
        const me = await meRes.json();
        const appsData = await appsRes.json();
        setUser(me);
        setApps((appsData.applications || []).slice(0, 5));
      } catch {
        clearToken();
        router.replace("/portal/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) return <PortalShell><LoadingScreen /></PortalShell>;
  if (!user) return null;

  const setupItems = [
    { done: !!user.email, label: "ربط الإيميل", href: "/portal/settings", icon: "📧" },
    { done: true, label: "بيانات الحساب مكتملة", href: "/portal/profile", icon: "✅" },
  ];

  return (
    <PortalShell>
      <div style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.greeting}>مرحباً، {user.full_name.split(" ")[0]} 👋</h1>
            <p style={s.greetingSub}>{user.city} · {user.subscription_active ? "اشتراك نشط" : "اشتراك منتهي"}</p>
          </div>
          <div style={{
            ...s.statusBadge,
            background: user.subscription_active ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
            color: user.subscription_active ? "#34d399" : "#f87171",
            border: `1px solid ${user.subscription_active ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
          }}>
            {user.subscription_active ? `✓ ${user.days_left} يوم` : "منتهي"}
          </div>
        </div>

        {/* Stats */}
        <div style={s.statsGrid}>
          <StatCard icon="📤" value={user.applications_count} label="تقديمات مرسلة" color="#4f8ef7" />
          <StatCard icon="📅" value={user.days_left} label="أيام متبقية" color="#34d399" />
          <StatCard icon="📧" value={user.email ? "مربوط" : "غير مربوط"} label="الإيميل" color={user.email ? "#34d399" : "#f87171"} />
        </div>

        {/* إشعار ربط الإيميل */}
        {!user.email && (
          <div style={s.alertCard} onClick={() => router.push("/portal/settings")}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <p style={s.alertTitle}>الإيميل غير مربوط</p>
              <p style={s.alertSub}>اربط إيميلك لبدء التقديم التلقائي على الوظائف</p>
            </div>
            <span style={s.alertArrow}>←</span>
          </div>
        )}

        {/* آخر التقديمات */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitle}>آخر التقديمات</h2>
            <button style={s.seeAll} onClick={() => router.push("/portal/applications")}>
              عرض الكل ←
            </button>
          </div>
          {apps.length === 0 ? (
            <div style={s.emptyCard}>
              <p style={{ fontSize: 36 }}>📭</p>
              <p style={s.emptyText}>لا توجد تقديمات حتى الآن</p>
              <p style={s.emptySubText}>البوت سيبدأ التقديم تلقائياً بمجرد ربط إيميلك ورفع سيرتك</p>
            </div>
          ) : (
            <div style={s.appList}>
              {apps.map((a) => (
                <div key={a.id} style={s.appItem}>
                  <div style={s.appIcon}>📩</div>
                  <div style={{ flex: 1 }}>
                    <p style={s.appTitle}>{a.job_title || "وظيفة"}</p>
                    <p style={s.appDate}>{formatDate(a.applied_at)}</p>
                  </div>
                  <span style={s.appStatus}>مُرسَل</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* روابط سريعة */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>روابط سريعة</h2>
          <div style={s.quickLinks}>
            {[
              { icon: "📋", label: "سجل التقديمات", href: "/portal/applications" },
              { icon: "📎", label: "السيرة الذاتية", href: "/portal/cv" },
              { icon: "📧", label: "ربط الإيميل", href: "/portal/settings" },
              { icon: "👤", label: "حسابي", href: "/portal/profile" },
            ].map(({ icon, label, href }) => (
              <button key={href} style={s.quickLink} onClick={() => router.push(href)}>
                <span style={{ fontSize: 24 }}>{icon}</span>
                <span style={s.quickLinkLabel}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

function StatCard({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statIcon, background: color + "18", color }}>{icon}</div>
      <div style={{ ...s.statValue, color }}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <p style={{ color: "#7a9cc5", fontSize: 16 }}>جاري التحميل…</p>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso.slice(0, 10); }
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 800, margin: "0 auto" },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 },
  greeting: { color: "#e8f0ff", fontSize: 24, fontWeight: 700, margin: 0 },
  greetingSub: { color: "#7a9cc5", fontSize: 14, margin: "4px 0 0" },
  statusBadge: { padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 },
  statCard: {
    background: "#0d1628", border: "1px solid #1a2d52", borderRadius: 14,
    padding: "20px 16px", textAlign: "center",
  },
  statIcon: { width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, margin: "0 auto 10px" },
  statValue: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  statLabel: { color: "#7a9cc5", fontSize: 12 },
  alertCard: {
    display: "flex", alignItems: "center", gap: 16,
    background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)",
    borderRadius: 12, padding: "16px 20px", marginBottom: 24, cursor: "pointer",
  },
  alertTitle: { color: "#fbbf24", fontWeight: 600, margin: 0, fontSize: 14 },
  alertSub: { color: "#d4a44e", fontSize: 12, margin: "2px 0 0" },
  alertArrow: { color: "#fbbf24", fontSize: 18, marginRight: "auto" },
  section: { marginBottom: 28 },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: { color: "#c0d4f0", fontSize: 16, fontWeight: 600, margin: 0 },
  seeAll: { background: "transparent", border: "none", color: "#4f8ef7", fontSize: 13, cursor: "pointer" },
  emptyCard: {
    background: "#0d1628", border: "1px solid #1a2d52", borderRadius: 14,
    padding: 32, textAlign: "center",
  },
  emptyText: { color: "#c0d4f0", fontSize: 15, fontWeight: 600, margin: "8px 0 4px" },
  emptySubText: { color: "#7a9cc5", fontSize: 13, margin: 0 },
  appList: { display: "flex", flexDirection: "column", gap: 10 },
  appItem: {
    display: "flex", alignItems: "center", gap: 14,
    background: "#0d1628", border: "1px solid #1a2d52",
    borderRadius: 12, padding: "14px 16px",
  },
  appIcon: {
    width: 40, height: 40, background: "rgba(79,142,247,0.12)",
    borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
  },
  appTitle: { color: "#e8f0ff", fontSize: 14, fontWeight: 500, margin: 0 },
  appDate: { color: "#7a9cc5", fontSize: 12, margin: "2px 0 0" },
  appStatus: { padding: "4px 10px", background: "rgba(52,211,153,0.12)", color: "#34d399", borderRadius: 8, fontSize: 12 },
  quickLinks: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  quickLink: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    background: "#0d1628", border: "1px solid #1a2d52", borderRadius: 14,
    padding: "18px 8px", cursor: "pointer",
  },
  quickLinkLabel: { color: "#c0d4f0", fontSize: 12, fontWeight: 500 },
};
