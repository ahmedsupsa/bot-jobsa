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

  if (loading) return <PortalShell><Loader /></PortalShell>;
  if (!user) return null;

  return (
    <PortalShell>
      <div style={s.page}>
        {/* Hero header */}
        <div style={s.hero}>
          <div style={s.heroLeft}>
            <p style={s.heroGreeting}>مرحباً، {user.full_name.split(" ")[0]} 👋</p>
            <p style={s.heroSub}>{user.city} · {new Date().toLocaleDateString("ar-SA", { weekday: "long", month: "long", day: "numeric" })}</p>
          </div>
          <div style={{
            ...s.heroBadge,
            background: user.subscription_active ? "#ecfdf5" : "#fef2f2",
            color: user.subscription_active ? "#059669" : "#dc2626",
            border: `1.5px solid ${user.subscription_active ? "#6ee7b7" : "#fca5a5"}`,
          }}>
            {user.subscription_active ? `✅ ${user.days_left} يوم متبقي` : "❌ الاشتراك منتهٍ"}
          </div>
        </div>

        {/* Stats */}
        <div style={s.statsGrid}>
          <StatCard
            icon="📤" value={user.applications_count}
            label="تقديمات مرسلة"
            grad="linear-gradient(135deg, #6366f1, #8b5cf6)"
            lightBg="#f5f3ff" lightText="#6366f1"
          />
          <StatCard
            icon="📅" value={user.days_left}
            label="أيام الاشتراك"
            grad="linear-gradient(135deg, #10b981, #059669)"
            lightBg="#ecfdf5" lightText="#059669"
          />
          <StatCard
            icon="📧" value={user.email ? "مربوط ✓" : "غير مربوط"}
            label="الإيميل"
            grad={user.email ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #ef4444, #dc2626)"}
            lightBg={user.email ? "#fffbeb" : "#fef2f2"}
            lightText={user.email ? "#d97706" : "#dc2626"}
          />
        </div>

        {/* Alert */}
        {!user.email && (
          <div style={s.alert} onClick={() => router.push("/portal/settings")}>
            <span style={{ fontSize: 24 }}>💡</span>
            <div style={{ flex: 1 }}>
              <p style={s.alertTitle}>اربط إيميلك لبدء التقديم التلقائي</p>
              <p style={s.alertSub}>خطوة واحدة تكفي لتشغيل التقديم بالذكاء الاصطناعي</p>
            </div>
            <button style={s.alertBtn}>اربط الآن ←</button>
          </div>
        )}

        <div style={s.twoCol}>
          {/* Recent applications */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <h2 style={s.cardTitle}>📋 آخر التقديمات</h2>
              <button style={s.viewAll} onClick={() => router.push("/portal/applications")}>عرض الكل ←</button>
            </div>
            {apps.length === 0 ? (
              <div style={s.empty}>
                <p style={{ fontSize: 40, margin: "0 0 8px" }}>📭</p>
                <p style={s.emptyTitle}>لا توجد تقديمات حتى الآن</p>
                <p style={s.emptySub}>البوت يعمل كل 30 دقيقة</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {apps.map((a) => (
                  <div key={a.id} style={s.appRow}>
                    <div style={s.appDot} />
                    <div style={{ flex: 1 }}>
                      <p style={s.appTitle}>{a.job_title || "وظيفة"}</p>
                      <p style={s.appDate}>{fmtDate(a.applied_at)}</p>
                    </div>
                    <span style={s.appBadge}>✓ مُرسَل</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={s.cardTitle}>⚡ إجراءات سريعة</h2>
            {[
              { icon: "📎", label: "رفع السيرة الذاتية", sub: "PDF أو صورة", href: "/portal/cv", color: "#8b5cf6" },
              { icon: "📧", label: "ربط الإيميل", sub: "Gmail فقط", href: "/portal/settings", color: "#6366f1" },
              { icon: "👤", label: "بياناتي", sub: "الاسم والجوال", href: "/portal/profile", color: "#10b981" },
              { icon: "📋", label: "سجل التقديمات", sub: `${user.applications_count} تقديم`, href: "/portal/applications", color: "#f59e0b" },
            ].map(({ icon, label, sub, href, color }) => (
              <button key={href} style={s.quickAction} onClick={() => router.push(href)}>
                <div style={{ ...s.qaIcon, background: color + "18", color }}>{icon}</div>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <p style={s.qaLabel}>{label}</p>
                  <p style={s.qaSub}>{sub}</p>
                </div>
                <span style={{ color: "#9ca3af" }}>←</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

function StatCard({ icon, value, label, grad, lightBg, lightText }: {
  icon: string; value: string | number; label: string;
  grad: string; lightBg: string; lightText: string;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: "22px 20px", boxShadow: "0 2px 16px rgba(99,102,241,0.08)", border: "1px solid #ede9fe" }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14 }}>
        {icon}
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: lightText, margin: "0 0 4px" }}>{value}</p>
      <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{label}</p>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
        <p style={{ color: "#8b5cf6", fontSize: 15 }}>جاري التحميل…</p>
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso.slice(0, 10); }
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 900, margin: "0 auto" },
  hero: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    borderRadius: 20, padding: "28px 32px", marginBottom: 28,
    flexWrap: "wrap", gap: 16,
  },
  heroLeft: {},
  heroGreeting: { color: "#fff", fontSize: 24, fontWeight: 800, margin: 0 },
  heroSub: { color: "rgba(255,255,255,0.8)", fontSize: 14, margin: "4px 0 0" },
  heroBadge: { padding: "8px 18px", borderRadius: 24, fontSize: 13, fontWeight: 600 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 },
  alert: {
    display: "flex", alignItems: "center", gap: 14,
    background: "#fffbeb", border: "1.5px solid #fcd34d",
    borderRadius: 16, padding: "16px 20px", marginBottom: 28, cursor: "pointer",
  },
  alertTitle: { color: "#92400e", fontWeight: 700, margin: 0, fontSize: 14 },
  alertSub: { color: "#a16207", fontSize: 12, margin: "2px 0 0" },
  alertBtn: {
    background: "#f59e0b", color: "#fff", border: "none",
    borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600,
    cursor: "pointer", flexShrink: 0,
  },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" },
  card: { background: "#fff", borderRadius: 18, padding: "24px", boxShadow: "0 2px 16px rgba(99,102,241,0.07)", border: "1px solid #ede9fe" },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  cardTitle: { color: "#1e1b4b", fontSize: 16, fontWeight: 700, margin: 0 },
  viewAll: { background: "transparent", border: "none", color: "#6366f1", fontSize: 13, cursor: "pointer", fontWeight: 600 },
  empty: { textAlign: "center", padding: "32px 20px" },
  emptyTitle: { color: "#4b5563", fontSize: 15, fontWeight: 600, margin: "0 0 4px" },
  emptySub: { color: "#9ca3af", fontSize: 13, margin: 0 },
  appRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px", background: "#fafafa", borderRadius: 12 },
  appDot: { width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", flexShrink: 0 },
  appTitle: { color: "#1e1b4b", fontSize: 13, fontWeight: 600, margin: 0 },
  appDate: { color: "#9ca3af", fontSize: 12, margin: "2px 0 0" },
  appBadge: { background: "#ecfdf5", color: "#059669", border: "1px solid #6ee7b7", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 600 },
  quickAction: {
    display: "flex", alignItems: "center", gap: 12,
    background: "#fff", border: "1px solid #ede9fe",
    borderRadius: 14, padding: "14px 16px", cursor: "pointer",
    boxShadow: "0 1px 8px rgba(99,102,241,0.06)", width: "100%",
  },
  qaIcon: { width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 },
  qaLabel: { color: "#1e1b4b", fontSize: 13, fontWeight: 600, margin: 0 },
  qaSub: { color: "#9ca3af", fontSize: 11, margin: "2px 0 0" },
};
