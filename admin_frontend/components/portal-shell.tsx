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

        <nav style={{ flex: 1, overflowY: "auto" }}>
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
      <nav style={s.bottomNav} className="portal-bottom-nav no-scrollbar">
        <div style={s.bottomScroller} className="no-scrollbar">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <button
                key={href}
                style={{ ...s.bottomItem, color: active ? "#fff" : "#555" }}
                onClick={() => router.push(href)}
              >
                <Icon size={20} strokeWidth={active ? 2 : 1.5} />
                <span style={{ fontSize: 9.5, marginTop: 2, whiteSpace: "nowrap", fontWeight: active ? 600 : 400 }}>{label}</span>
              </button>
            );
          })}
          <button style={{ ...s.bottomItem, color: "#555" }} onClick={logout}>
            <LogOut size={20} strokeWidth={1.5} />
            <span style={{ fontSize: 9.5, marginTop: 2, whiteSpace: "nowrap" }}>خروج</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#0a0a0a",
    display: "flex",
    direction: "rtl",
  },
  sidebar: {
    width: 226, minHeight: "100vh",
    background: "#0f0f0f", borderLeft: "1px solid #1f1f1f",
    display: "flex", flexDirection: "column",
    padding: "20px 14px", position: "sticky",
    top: 0, height: "100vh", flexShrink: 0,
    overflowY: "auto",
  },
  logo: {
    display: "flex", alignItems: "center", gap: 12,
    marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #1f1f1f",
    flexShrink: 0,
  },
  logoIcon: {
    width: 38, height: 38, borderRadius: 11, background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  logoName: { color: "#fff", fontSize: 15, fontWeight: 700, margin: 0 },
  logoSub: { color: "#555", fontSize: 10.5, margin: "2px 0 0" },
  navItem: {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "10px 11px", borderRadius: 10,
    background: "transparent", border: "none",
    cursor: "pointer", textAlign: "right",
    transition: "background 0.15s", marginBottom: 2,
    position: "relative", fontSize: 13, fontFamily: "inherit",
  },
  navActive: { background: "#1a1a1a" },
  activeDot: {
    position: "absolute", left: 8, top: "50%",
    transform: "translateY(-50%)",
    width: 4, height: 4, borderRadius: "50%", background: "#fff",
  },
  logoutBtn: {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "10px 11px", borderRadius: 10,
    background: "transparent", border: "1px solid #1f1f1f",
    cursor: "pointer", marginTop: 8, fontFamily: "inherit",
    flexShrink: 0,
  },
  main: {
    flex: 1, padding: "28px 24px 80px",
    minHeight: "100vh",
    minWidth: 0,
  },
  bottomNav: {
    display: "none", position: "fixed",
    bottom: 0, left: 0, right: 0,
    background: "rgba(10,10,10,0.96)",
    WebkitBackdropFilter: "blur(10px)",
    backdropFilter: "blur(10px)",
    borderTop: "1px solid #1f1f1f",
    zIndex: 100,
    paddingBottom: "max(4px, env(safe-area-inset-bottom))",
  },
  bottomScroller: {
    display: "flex",
    overflowX: "auto", overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  bottomItem: {
    flex: "0 0 auto", minWidth: 60,
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: 2,
    background: "transparent", border: "none",
    cursor: "pointer", padding: "8px 8px 4px",
    fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
  },
};
