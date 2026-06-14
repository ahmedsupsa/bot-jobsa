"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";
import {
  Send, CalendarDays, Mail, AlertCircle, AlertTriangle, ArrowRight,
  FileText, User, ClipboardList, Clock, Zap, PauseCircle,
} from "lucide-react";

interface UserData {
  full_name: string; phone: string;
  subscription_active: boolean; days_left: number;
  subscription_ends_at: string; email: string;
  smtp_email: string; applications_count: number;
  email_connected: boolean;
  cv_rejected: boolean;
}
interface Application { id: string; job_title: string; applied_at: string; }

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function NextRunCard({ active }: { active: boolean }) {
  const [secs, setSecs] = useState(0);
  const [label, setLabel] = useState("");
  const targetRef = useRef(0);

  function nextHalf(n: number) {
    const d = new Date(n);
    d.setSeconds(0, 0);
    if (d.getMinutes() < 30) d.setMinutes(30);
    else { d.setMinutes(0); d.setHours(d.getHours() + 1); }
    return d.getTime();
  }

  async function refetch() {
    try {
      const r = await fetch("/api/portal/worker-status", { cache: "no-store" });
      const data = await r.json();
      const now = Date.now();
      let t: number;
      if (data.next_run_at) {
        t = new Date(data.next_run_at).getTime();
        t = t > now ? t : nextHalf(now);
      } else if (data.last_ran_at) {
        t = new Date(data.last_ran_at).getTime() + 1800_000;
        t = t > now ? t : nextHalf(now);
      } else {
        t = nextHalf(now);
      }
      targetRef.current = t;
      setLabel(new Date(t).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }));
    } catch { targetRef.current = nextHalf(Date.now()); }
  }

  useEffect(() => {
    let cancelled = false;
    let tick: ReturnType<typeof setInterval>;
    let refetching = false;

    (async () => {
      await refetch();
      if (cancelled) return;

      tick = setInterval(() => {
        const remaining = targetRef.current - Date.now();
        if (remaining <= 0 && !refetching) {
          refetching = true;
          refetch().finally(() => { refetching = false; });
          return;
        }
        if (!cancelled) setSecs(Math.max(0, Math.floor(remaining / 1000)));
      }, 1000);
    })();

    return () => { cancelled = true; if (tick) clearInterval(tick); };
  }, []);

  const pct = Math.max(0, Math.min(100, ((1800 - secs) / 1800) * 100));

  return (
    <div style={{
      background: active ? "var(--surface)" : "var(--danger-bg)",
      border: `1px solid ${active ? "var(--border)" : "var(--danger-border)"}`,
      borderRadius: 16, padding: "20px 22px", marginBottom: 20,
      position: "relative", overflow: "hidden",
    }}>
      {!active && (
        <div style={{
          position: "absolute", top: 0, right: 0, left: 0, height: 3,
          background: "var(--danger-accent)",
        }} />
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: active ? "var(--surface2)" : "var(--surface)",
            border: active ? "none" : "1px solid var(--danger-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {active
              ? <Zap size={17} strokeWidth={1.8} color="var(--text)" />
              : <PauseCircle size={18} strokeWidth={1.8} color="var(--danger)" />}
          </div>
          <div>
            <p style={{ margin: 0, color: active ? "var(--text)" : "var(--danger-fg)", fontSize: 14, fontWeight: 600 }}>
              {active ? "التقديم التلقائي القادم" : "التقديم التلقائي موقوف"}
            </p>
            <p style={{ margin: 0, color: "var(--text3)", fontSize: 12 }}>
              {active
                ? `يعمل كل 30 دقيقة · الجلسة التالية ${label}`
                : "لن يتم إرسال تقديمات حتى يستأنف العمل"}
            </p>
          </div>
        </div>
        <span style={{
          padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: active ? "var(--surface2)" : "var(--surface)",
          border: `1px solid ${active ? "var(--border2)" : "var(--danger-border)"}`,
          color: active ? "var(--text)" : "var(--danger-fg)",
        }}>{active ? "نشط" : "موقوف"}</span>
      </div>

      <div style={{ background: active ? "var(--surface2)" : "var(--danger-border)", borderRadius: 999, height: 4, marginBottom: 12, overflow: "hidden" }}>
        <div style={{
          width: `${active ? pct : 100}%`, height: "100%",
          background: active ? "var(--text)" : "var(--danger-accent)",
          borderRadius: 999, transition: "width 1s linear",
        }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: active ? "var(--text3)" : "var(--danger-fg)", fontSize: 12, fontWeight: active ? 400 : 600 }}>
          <Clock size={12} />
          {active ? "متبقي على الجلسة القادمة" : "جدّد اشتراكك لاستئناف التقديم التلقائي"}
        </div>
        <span style={{
          fontFamily: "monospace", fontWeight: 700, fontSize: 22, letterSpacing: 2,
          color: active ? "var(--text)" : "var(--text4)",
          textDecoration: active ? "none" : "line-through",
        }}>{active ? fmt(secs) : "--:--"}</span>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ display: "flex", height: "60vh", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--text3)", fontSize: 14 }}>جاري التحميل...</div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayLabel, setTodayLabel] = useState("");

  const load = useCallback(async () => {
    try {
      const [meRes, appsRes] = await Promise.all([portalFetch("/me"), portalFetch("/applications")]);
      if (meRes.status === 401) { clearToken(); router.replace("/portal/login"); return; }
      const me = await meRes.json();
      const appsData = await appsRes.json();
      setUser(me);
      setApps((appsData.applications || []).slice(0, 5));
    } catch { clearToken(); router.replace("/portal/login"); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString("ar-SA", { weekday: "long", month: "long", day: "numeric" }));
  }, []);

  if (loading) return <PortalShell><Loader /></PortalShell>;
  if (!user) return null;

  const stats = [
    { icon: <Send size={20} strokeWidth={1.5} />, value: user.applications_count, label: "تقديمات مرسلة", key: "apps" },
    { icon: <CalendarDays size={20} strokeWidth={1.5} />, value: user.days_left, label: "أيام الاشتراك", key: "days" },
    { icon: <Mail size={20} strokeWidth={1.5} />, value: user.email_connected ? "مربوط ✓" : "—", label: "الإيميل", key: "email" },
  ];

  const quickLinks = [
    { icon: <FileText size={18} strokeWidth={1.5} />, label: "رفع السيرة الذاتية", sub: "PDF أو صورة", href: "/portal/cv" },
    { icon: <Mail size={18} strokeWidth={1.5} />, label: "ربط الإيميل", sub: user.email_connected ? (user.smtp_email || "مربوط ✓") : "غير مربوط", href: "/portal/email" },
    { icon: <User size={18} strokeWidth={1.5} />, label: "بياناتي", sub: "الاسم والجوال", href: "/portal/profile" },
    { icon: <ClipboardList size={18} strokeWidth={1.5} />, label: "جميع التقديمات", sub: `${user.applications_count} تقديم`, href: "/portal/applications" },
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
              <p style={s.greetingSub}>
                {todayLabel || ""}
              </p>
            </div>
          </div>
          <div style={{
            ...s.subBadge,
            background: user.subscription_active ? "var(--surface2)" : "var(--danger-bg)",
            borderColor: user.subscription_active ? "var(--border2)" : "var(--danger-border)",
            color: user.subscription_active ? "var(--text)" : "var(--danger-fg)",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
            {user.subscription_active ? `${user.days_left} يوم متبقي` : "الاشتراك منتهٍ"}
          </div>
        </div>

        {/* Next run countdown */}
        <NextRunCard active={user.subscription_active} />

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

        {/* Alert: CV rejected */}
        {user.cv_rejected && (
          <div style={{ ...s.alert, borderColor: "#dc2626", background: "#fef2f2" }} onClick={() => router.push("/portal/cv")}>
            <AlertTriangle size={20} color="#dc2626" strokeWidth={1.5} />
            <div>
              <p style={{ ...s.alertTitle, color: "#dc2626" }}>السيرة الذاتية غير صالحة — أعد رفعها</p>
              <p style={{ ...s.alertSub, color: "#991b1b" }}>الملف السابق لا يحتوي على بيانات سيرة ذاتية حقيقية. ارجع لصفحة السيرة وارفع ملف CV صحيح لتتمكن من التقديم</p>
            </div>
            <ArrowRight size={16} color="#991b1b" style={{ marginRight: "auto" }} />
          </div>
        )}

        {/* Alert: email not connected */}
        {!user.email_connected && (
          <div style={s.alert} onClick={() => router.push("/portal/email")}>
            <AlertCircle size={20} color="#f59e0b" strokeWidth={1.5} />
            <div>
              <p style={s.alertTitle}>ربط الإيميل مطلوب للتقديم التلقائي</p>
              <p style={s.alertSub}>أضف بريدك وكلمة مرور التطبيق حتى يُرسل النظام طلبات التوظيف باسمك</p>
            </div>
            <ArrowRight size={16} color="#a16207" style={{ marginRight: "auto" }} />
          </div>
        )}

        {/* Two-column layout */}
        <div style={s.twoCol} className="dashboard-two-col">
          {/* Recent applications */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardTitleRow}>
                <Send size={15} strokeWidth={1.5} color="#888" />
                <span style={s.cardTitle}>آخر التقديمات</span>
              </div>
              <button style={s.viewAll} onClick={() => router.push("/portal/applications")}>
                عرض الكل <ArrowRight size={12} />
              </button>
            </div>
            {apps.length === 0 ? (
              <div style={s.empty}>
                <Send size={28} strokeWidth={1} color="#333" />
                <p style={s.emptyTitle}>لا توجد تقديمات بعد</p>
                <p style={s.emptySub}>سيبدأ النظام التقديم تلقائياً في الجلسة القادمة</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {apps.map((a) => (
                  <div key={a.id} style={s.appRow}>
                    <div style={s.appBullet} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={s.appTitle}>{a.job_title}</p>
                      <p style={s.appDate}>{new Date(a.applied_at).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })}</p>
                    </div>
                    <span style={s.sentTag}>أُرسل</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {quickLinks.map(({ icon, label, sub, href }) => (
              <button key={href} style={s.quickBtn} onClick={() => router.push(href)}>
                <div style={s.quickIcon}>{icon}</div>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <p style={s.quickLabel}>{label}</p>
                  <p style={s.quickSub}>{sub}</p>
                </div>
                <ArrowRight size={14} color="#333" />
              </button>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .dashboard-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PortalShell>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: "8px 0 28px" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 24, flexWrap: "wrap", gap: 12,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  avatar: {
    width: 46, height: 46, borderRadius: 14, background: "var(--accent)",
    color: "var(--accent-fg)", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, fontWeight: 700, flexShrink: 0,
  },
  greeting: { color: "var(--text)", fontSize: 20, fontWeight: 700, margin: 0 },
  greetingSub: { color: "var(--text3)", fontSize: 13, margin: "3px 0 0" },
  subBadge: {
    display: "flex", alignItems: "center", gap: 7,
    border: "1px solid", borderRadius: 10, padding: "6px 14px",
    fontSize: 13, fontWeight: 600,
  },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 },
  statCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 14px" },
  statIconWrap: {
    width: 38, height: 38, borderRadius: 10, background: "var(--surface2)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--text2)", marginBottom: 12,
  },
  statValue: { color: "var(--text)", fontSize: 22, fontWeight: 800, margin: "0 0 4px" },
  statLabel: { color: "var(--text3)", fontSize: 12, margin: 0 },
  alert: {
    display: "flex", alignItems: "center", gap: 14,
    background: "var(--alert-bg)", border: "1px solid var(--alert-border)",
    borderRadius: 14, padding: "16px 20px", marginBottom: 24, cursor: "pointer",
  },
  alertTitle: { color: "#f59e0b", fontWeight: 600, fontSize: 14, margin: 0 },
  alertSub: { color: "#a16207", fontSize: 12, margin: "2px 0 0" },
  twoCol: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 260px)", gap: 20, alignItems: "start" },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "22px" },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  cardTitleRow: { display: "flex", alignItems: "center", gap: 8 },
  cardTitle: { color: "var(--text)", fontSize: 15, fontWeight: 600 },
  viewAll: {
    background: "transparent", border: "none", color: "var(--text3)",
    fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
  },
  empty: { textAlign: "center", padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  emptyTitle: { color: "var(--text3)", fontSize: 14, fontWeight: 600, margin: 0 },
  emptySub: { color: "var(--text4)", fontSize: 12, margin: 0 },
  appRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface2)", borderRadius: 12 },
  appBullet: { width: 6, height: 6, borderRadius: "50%", background: "var(--text3)", flexShrink: 0 },
  appTitle: { color: "var(--text)", fontSize: 13, fontWeight: 500, margin: 0 },
  appDate: { color: "var(--text3)", fontSize: 12, margin: "2px 0 0" },
  sentTag: {
    background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border2)",
    borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 600, flexShrink: 0,
  },
  quickBtn: {
    display: "flex", alignItems: "center", gap: 12,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 14, padding: "14px 16px", cursor: "pointer", width: "100%",
  },
  quickIcon: {
    width: 38, height: 38, borderRadius: 10, background: "var(--surface2)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--text2)", flexShrink: 0,
  },
  quickLabel: { color: "var(--text)", fontSize: 13, fontWeight: 600, margin: 0 },
  quickSub: { color: "var(--text3)", fontSize: 11, margin: "2px 0 0" },
};
