"use client";
import { useRouter, usePathname } from "next/navigation";
import { clearToken } from "@/lib/portal-auth";

const NAV = [
  { href: "/portal/dashboard", icon: "🏠", label: "الرئيسية" },
  { href: "/portal/applications", icon: "📋", label: "التقديمات" },
  { href: "/portal/cv", icon: "📎", label: "السيرة" },
  { href: "/portal/profile", icon: "👤", label: "حسابي" },
  { href: "/portal/settings", icon: "⚙️", label: "الإعدادات" },
];

const GRAD = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)";

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  function logout() {
    clearToken();
    router.replace("/portal/login");
  }

  return (
    <div style={s.root} className="portal-root">
      {/* Sidebar — desktop */}
      <aside style={s.sidebar} className="portal-sidebar">
        <div style={s.logo}>
          <div style={s.logoIcon}>💼</div>
          <div>
            <p style={s.logoName}>جبسا</p>
            <p style={s.logoSub}>بوابة المستخدمين</p>
          </div>
        </div>

        <nav style={s.nav}>
          {NAV.map(({ href, icon, label }) => {
            const active = pathname === href;
            return (
              <button
                key={href}
                style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
                onClick={() => router.push(href)}
              >
                <span style={s.navIcon}>{icon}</span>
                <span>{label}</span>
                {active && <div style={s.activeBar} />}
              </button>
            );
          })}
        </nav>

        <button style={s.logoutBtn} onClick={logout}>
          <span>🚪</span>
          <span>تسجيل الخروج</span>
        </button>
      </aside>

      {/* Main */}
      <main style={s.main} className="portal-main">
        {children}
      </main>

      {/* Bottom nav — mobile */}
      <nav style={s.bottomNav} className="portal-bottom-nav">
        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href;
          return (
            <button
              key={href}
              style={{ ...s.bottomNavItem, ...(active ? s.bottomNavActive : {}) }}
              onClick={() => router.push(href)}
            >
              <span style={{ fontSize: 22 }}>{icon}</span>
              <span style={{ fontSize: 10 }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#f5f3ff",
    display: "flex",
    direction: "rtl",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  sidebar: {
    width: 240,
    minHeight: "100vh",
    background: "#fff",
    borderLeft: "1px solid #ede9fe",
    display: "flex",
    flexDirection: "column",
    padding: "24px 16px",
    position: "sticky",
    top: 0,
    height: "100vh",
    flexShrink: 0,
    boxShadow: "2px 0 20px rgba(99,102,241,0.06)",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
    paddingBottom: 24,
    borderBottom: "1px solid #ede9fe",
  },
  logoIcon: {
    width: 44, height: 44, borderRadius: 12,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 22, flexShrink: 0,
  },
  logoName: { color: "#1e1b4b", fontSize: 16, fontWeight: 700, margin: 0 },
  logoSub: { color: "#a78bfa", fontSize: 11, margin: "2px 0 0" },
  nav: { display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  navItem: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 14px", borderRadius: 12,
    background: "transparent", border: "none",
    color: "#6b7280", fontSize: 14, fontWeight: 500,
    cursor: "pointer", textAlign: "right",
    transition: "all 0.15s", width: "100%",
    position: "relative",
  },
  navItemActive: {
    background: "#f5f3ff",
    color: "#6366f1",
    fontWeight: 700,
  },
  navIcon: { fontSize: 18 },
  activeBar: {
    position: "absolute", left: 0, top: "50%",
    transform: "translateY(-50%)",
    width: 3, height: 20,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    borderRadius: 4,
  },
  logoutBtn: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "12px 14px", borderRadius: 12,
    background: "#fef2f2", border: "none",
    color: "#dc2626", fontSize: 13, fontWeight: 500,
    cursor: "pointer", textAlign: "right",
    marginTop: 16, width: "100%",
  },
  main: {
    flex: 1, padding: "32px 28px 80px",
    minHeight: "100vh", maxWidth: "100%",
  },
  bottomNav: {
    display: "none",
    position: "fixed", bottom: 0, left: 0, right: 0,
    background: "#fff", borderTop: "1px solid #ede9fe",
    zIndex: 100, padding: "8px 0 4px",
    boxShadow: "0 -4px 20px rgba(99,102,241,0.08)",
  },
  bottomNavItem: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", gap: 2,
    background: "transparent", border: "none",
    color: "#9ca3af", cursor: "pointer", padding: "4px 8px",
    fontSize: 10,
  },
  bottomNavActive: { color: "#6366f1" },
};
