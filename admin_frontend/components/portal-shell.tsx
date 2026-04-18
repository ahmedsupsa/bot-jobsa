"use client";
import { useRouter, usePathname } from "next/navigation";
import { clearToken } from "@/lib/portal-auth";
import {
  Home, ClipboardList, FileText, User, Settings, LogOut, Briefcase, SlidersHorizontal, MessageCircle, TrendingUp,
} from "lucide-react";

const NAV = [
  { href: "/portal/dashboard", icon: Home, label: "الرئيسية" },
  { href: "/portal/applications", icon: ClipboardList, label: "التقديمات" },
  { href: "/portal/cv", icon: FileText, label: "السيرة" },
  { href: "/portal/preferences", icon: SlidersHorizontal, label: "تفضيلات" },
  { href: "/portal/affiliate", icon: TrendingUp, label: "برنامج الربح" },
  { href: "/portal/support", icon: MessageCircle, label: "الدعم" },
  { href: "/portal/profile", icon: User, label: "حسابي" },
  { href: "/portal/settings", icon: Settings, label: "الإعدادات" },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  function logout() {
    clearToken();
    router.replace("/portal/login");
  }

  return (
    <div style={s.root} className="portal-root">
      {/* Sidebar */}
      <aside style={s.sidebar} className="portal-sidebar">
        <div style={s.logo}>
          <div style={s.logoIcon}>
            <Briefcase size={20} strokeWidth={1.5} color="#0a0a0a" />
          </div>
          <div>
            <p style={s.logoName}>Jobbots</p>
            <p style={s.logoSub}>بوابة المستخدمين</p>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <button
                key={href}
                style={{ ...s.navItem, ...(active ? s.navActive : {}) }}
                onClick={() => router.push(href)}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.5} color={active ? "#fff" : "#666"} />
                <span style={{ color: active ? "#fff" : "#666", fontWeight: active ? 600 : 400 }}>
                  {label}
                </span>
                {active && <div style={s.activeDot} />}
              </button>
            );
          })}
        </nav>

        <button style={s.logoutBtn} onClick={logout}>
          <LogOut size={16} strokeWidth={1.5} color="#555" />
          <span style={{ color: "#555" }}>تسجيل الخروج</span>
        </button>
      </aside>

      {/* Main */}
      <main style={s.main} className="portal-main">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav style={s.bottomNav} className="portal-bottom-nav">
        <div style={s.bottomScroller}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <button
                key={href}
                style={{ ...s.bottomItem, color: active ? "#fff" : "#555" }}
                onClick={() => router.push(href)}
              >
                <Icon size={20} strokeWidth={active ? 2 : 1.5} />
                <span style={{ fontSize: 10, marginTop: 2, whiteSpace: "nowrap" }}>{label}</span>
              </button>
            );
          })}
          <button style={{ ...s.bottomItem, color: "#555" }} onClick={logout}>
            <LogOut size={20} strokeWidth={1.5} />
            <span style={{ fontSize: 10, marginTop: 2, whiteSpace: "nowrap" }}>خروج</span>
          </button>
        </div>
      </nav>

      <style>{`
        @media (max-width: 900px) {
          .portal-sidebar { display: none !important; }
          .portal-main { padding: 20px 16px 110px !important; }
          .portal-bottom-nav { display: block !important; }
        }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh", background: "#0a0a0a",
    display: "flex", direction: "rtl",
  },
  sidebar: {
    width: 230, minHeight: "100vh",
    background: "#0f0f0f", borderLeft: "1px solid #1f1f1f",
    display: "flex", flexDirection: "column",
    padding: "24px 16px", position: "sticky",
    top: 0, height: "100vh", flexShrink: 0,
  },
  logo: {
    display: "flex", alignItems: "center", gap: 12,
    marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid #1f1f1f",
  },
  logoIcon: {
    width: 40, height: 40, borderRadius: 12, background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  logoName: { color: "#fff", fontSize: 16, fontWeight: 700, margin: 0 },
  logoSub: { color: "#555", fontSize: 11, margin: "2px 0 0" },
  navItem: {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "11px 12px", borderRadius: 10,
    background: "transparent", border: "none",
    cursor: "pointer", textAlign: "right",
    transition: "background 0.15s", marginBottom: 2,
    position: "relative",
  },
  navActive: { background: "#1a1a1a" },
  activeDot: {
    position: "absolute", left: 8, top: "50%",
    transform: "translateY(-50%)",
    width: 4, height: 4, borderRadius: "50%", background: "#fff",
  },
  logoutBtn: {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "11px 12px", borderRadius: 10,
    background: "transparent", border: "1px solid #1f1f1f",
    cursor: "pointer", marginTop: 8,
  },
  main: {
    flex: 1, padding: "32px 28px 80px",
    minHeight: "100vh",
  },
  bottomNav: {
    display: "none", position: "fixed",
    bottom: 0, left: 0, right: 0,
    background: "#0f0f0f", borderTop: "1px solid #1f1f1f",
    zIndex: 100, padding: "6px 0 max(6px, env(safe-area-inset-bottom))",
  },
  bottomScroller: {
    display: "flex", overflowX: "auto", overflowY: "hidden",
    WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
  },
  bottomItem: {
    flex: "0 0 auto", minWidth: 64,
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: 2,
    background: "transparent", border: "none",
    cursor: "pointer", padding: "6px 10px",
    fontFamily: "inherit",
  },
};
