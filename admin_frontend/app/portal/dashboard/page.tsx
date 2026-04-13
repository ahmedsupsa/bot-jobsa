"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";
import {
  Send, CalendarDays, Mail, AlertCircle, ArrowRight,
  FileText, Settings, User, ClipboardList, TrendingUp,
} from "lucide-react";

interface UserData {
  full_name: string; phone: string; city: string;
  subscription_active: boolean; days_left: number;
  subscription_ends_at: string; email: string;
  sender_email_alias: string; applications_count: number;
}
interface Application { id: string; job_title: string; applied_at: string; }

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, appsRes] = await Promise.all([portalFetch("/me"), portalFetch("/applications")]);
        if (meRes.status === 401) { clearToken(); router.replace("/portal/login"); return; }
        const me = await meRes.json();
        const appsData = await appsRes.json();
        setUser(me);
        setApps((appsData.applications || []).slice(0, 5));
      } catch { clearToken(); router.replace("/portal/login"); }
      finally { setLoading(false); }
    }
    load();
  }, [router]);

  if (loading) return <PortalShell><Loader /></PortalShell>;
  if (!user) return null;

  const stats = [
    { icon: <Send size={20} strokeWidth={1.5} />, value: user.applications_count, label: "تقديمات مرسلة", key: "apps" },
    { icon: <CalendarDays size={20} strokeWidth={1.5} />, value: user.days_left, label: "أيام الاشتراك", key: "days" },
    { icon: <Mail size={20} strokeWidth={1.5} />, value: user.email ? "مربوط" : "غير مربوط", label: "الإيميل", key: "email" },
  ];

  const quickLinks = [
    { icon: <FileText size={18} strokeWidth={1.5} />, label: "رفع السيرة", sub: "PDF أو صورة", href: "/portal/cv" },
    { icon: <Mail size={18} strokeWidth={1.5} />, label: "ربط الإيميل", sub: "Gmail فقط", href: "/portal/settings" },
    { icon: <User size={18} strokeWidth={1.5} />, label: "بياناتي", sub: "الاسم والجوال", href: "/portal/profile" },
    { icon: <ClipboardList size={18} strokeWidth={1.5} />, label: "التقديمات", sub: `${user.applications_count} تقديم`, href: "/portal/applications" },
  ];

  return (
    <PortalShell>
      <div style={s.page}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <div style={s.avatar}>{user.full_name.charAt(0)}</div>
            <div>
              <h1 style={s.greeting}>مرحباً، {user.full_name.split(" ")[0]}</h1>
              <p style={s.greetingSub}>{user.city} · {new Date().toLocaleDateString("ar-SA", { weekday: "long", month: "long", day: "numeric" })}</p>
            </div>
          </div>
          <div style={{
            ...s.subBadge,
            background: user.subscription_active ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            borderColor: user.subscription_active ? "#22c55e22" : "#ef444422",
            color: user.subscription_active ? "#22c55e" : "#ef4444",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
            {user.subscription_active ? `${user.days_left} يوم متبقي` : "الاشتراك منتهٍ"}
          </div>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          {stats.map(({ icon, value, label, key }) => (
            <div key={key} style={s.statCard}>
              <div style={s.statIconWrap}>{icon}</div>
              <p style={s.statValue}>{value}</p>
              <p style={s.statLabel}>{label}</p>
            </div>
          ))}
        </div>

        {/* Alert */}
        {!user.email && (
          <div style={s.alert} onClick={() => router.push("/portal/settings")}>
            <AlertCircle size={20} strokeWidth={1.5} color="#f59e0b" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={s.alertTitle}>اربط إيميلك لبدء التقديم التلقائي</p>
              <p style={s.alertSub}>لن يعمل البوت بدون إيميل مربوط</p>
            </div>
            <ArrowRight size={18} strokeWidth={1.5} color="#f59e0b" />
          </div>
        )}

        <div style={s.twoCol}>
          {/* Recent apps */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardTitleRow}>
                <TrendingUp size={18} strokeWidth={1.5} color="#fff" />
                <span style={s.cardTitle}>آخر التقديمات</span>
              </div>
              <button style={s.viewAll} onClick={() => router.push("/portal/applications")}>
                عرض الكل <ArrowRight size={14} strokeWidth={2} />
              </button>
            </div>
            {apps.length === 0 ? (
              <div style={s.empty}>
                <Send size={32} strokeWidth={1} color="#333" />
                <p style={s.emptyTitle}>لا توجد تقديمات بعد</p>
                <p style={s.emptySub}>البوت يعمل كل 30 دقيقة</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {apps.map((a) => (
                  <div key={a.id} style={s.appRow}>
                    <div style={s.appBullet} />
                    <div style={{ flex: 1 }}>
                      <p style={s.appTitle}>{a.job_title || "وظيفة"}</p>
                      <p style={s.appDate}>{fmtDate(a.applied_at)}</p>
                    </div>
                    <span style={s.sentTag}>مُرسَل</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={s.cardTitleRow}>
              <Settings size={16} strokeWidth={1.5} color="#888" />
              <span style={{ color: "#888", fontSize: 13, fontWeight: 500 }}>إجراءات سريعة</span>
            </div>
            {quickLinks.map(({ icon, label, sub, href }) => (
              <button key={href} style={s.quickBtn} onClick={() => router.push(href)}>
                <div style={s.quickIcon}>{icon}</div>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <p style={s.quickLabel}>{label}</p>
                  <p style={s.quickSub}>{sub}</p>
                </div>
                <ArrowRight size={15} strokeWidth={1.5} color="#444" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

function Loader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <p style={{ color: "#555", fontSize: 15 }}>جاري التحميل…</p>
    </div>
  );
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso.slice(0, 10); }
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 860, margin: "0 auto" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "28px 32px", background: "#111", border: "1px solid #1f1f1f",
    borderRadius: 18, marginBottom: 24, flexWrap: "wrap", gap: 16,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 16 },
  avatar: {
    width: 52, height: 52, borderRadius: 14, background: "#fff",
    color: "#0a0a0a", fontSize: 22, fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  greeting: { color: "#fff", fontSize: 22, fontWeight: 700, margin: 0 },
  greetingSub: { color: "#666", fontSize: 13, margin: "3px 0 0" },
  subBadge: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 16px", borderRadius: 24,
    border: "1px solid", fontSize: 13, fontWeight: 600,
  },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 },
  statCard: {
    background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "22px 20px",
  },
  statIconWrap: {
    width: 40, height: 40, borderRadius: 12, background: "#1a1a1a",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", marginBottom: 14,
  },
  statValue: { color: "#fff", fontSize: 24, fontWeight: 800, margin: "0 0 4px" },
  statLabel: { color: "#666", fontSize: 12, margin: 0 },
  alert: {
    display: "flex", alignItems: "center", gap: 14,
    background: "#0f0d00", border: "1px solid #f59e0b22",
    borderRadius: 14, padding: "16px 20px", marginBottom: 24, cursor: "pointer",
  },
  alertTitle: { color: "#f59e0b", fontWeight: 600, fontSize: 14, margin: 0 },
  alertSub: { color: "#a16207", fontSize: 12, margin: "2px 0 0" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 260px", gap: 20, alignItems: "start" },
  card: { background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "22px" },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  cardTitleRow: { display: "flex", alignItems: "center", gap: 8 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: 600 },
  viewAll: {
    background: "transparent", border: "none", color: "#666",
    fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
  },
  empty: { textAlign: "center", padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  emptyTitle: { color: "#555", fontSize: 14, fontWeight: 600, margin: 0 },
  emptySub: { color: "#444", fontSize: 12, margin: 0 },
  appRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 14px", background: "#161616", borderRadius: 12,
  },
  appBullet: { width: 6, height: 6, borderRadius: "50%", background: "#fff", flexShrink: 0 },
  appTitle: { color: "#fff", fontSize: 13, fontWeight: 500, margin: 0 },
  appDate: { color: "#555", fontSize: 12, margin: "2px 0 0" },
  sentTag: {
    background: "#0a1f0a", color: "#22c55e",
    border: "1px solid #22c55e22", borderRadius: 8,
    padding: "3px 10px", fontSize: 11, fontWeight: 600, flexShrink: 0,
  },
  quickBtn: {
    display: "flex", alignItems: "center", gap: 12,
    background: "#111", border: "1px solid #1f1f1f",
    borderRadius: 14, padding: "14px 16px", cursor: "pointer", width: "100%",
  },
  quickIcon: {
    width: 38, height: 38, borderRadius: 10, background: "#1a1a1a",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", flexShrink: 0,
  },
  quickLabel: { color: "#fff", fontSize: 13, fontWeight: 600, margin: 0 },
  quickSub: { color: "#555", fontSize: 11, margin: "2px 0 0" },
};
