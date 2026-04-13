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

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  function logout() {
    clearToken();
    router.replace("/portal/login");
  }

  return (
    <div style={s.root}>
      {/* Sidebar — desktop */}
      <aside style={s.sidebar} className="portal-sidebar">
        <div style={s.sidebarLogo}>
          <span style={{ fontSize: 28 }}>💼</span>
          <span style={s.sidebarLogoText}>جبسا</span>
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
              </button>
            );
          })}
        </nav>
        <button style={s.logoutBtn} onClick={logout}>
          🚪 تسجيل الخروج
        </button>
      </aside>

      {/* Main content */}
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
              style={{ ...s.bottomNavItem, ...(active ? s.bottomNavItemActive : {}) }}
              onClick={() => router.push(href)}
            >
              <span style={{ fontSize: 20 }}>{icon}</span>
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
    background: "#060b18",
    display: "flex",
    direction: "rtl",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  sidebar: {
    width: 220,
    minHeight: "100vh",
    background: "#080f20",
    borderLeft: "1px solid #1a2d52",
    display: "flex",
    flexDirection: "column",
    padding: "24px 16px",
    position: "sticky",
    top: 0,
    height: "100vh",
    flexShrink: 0,
  },
  sidebarLogo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
    paddingBottom: 20,
    borderBottom: "1px solid #1a2d52",
  },
  sidebarLogoText: { color: "#e8f0ff", fontSize: 20, fontWeight: 700 },
  nav: { display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 14px",
    borderRadius: 10,
    background: "transparent",
    border: "none",
    color: "#7a9cc5",
    fontSize: 14,
    cursor: "pointer",
    textAlign: "right",
    transition: "all 0.15s",
    width: "100%",
  },
  navItemActive: {
    background: "rgba(79,142,247,0.12)",
    color: "#4f8ef7",
    fontWeight: 600,
  },
  navIcon: { fontSize: 18 },
  logoutBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "transparent",
    border: "1px solid #1a2d52",
    color: "#7a9cc5",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "right",
    marginTop: 16,
  },
  main: {
    flex: 1,
    padding: "28px 24px 80px",
    minHeight: "100vh",
    overflowY: "auto",
    maxWidth: "100%",
  },
  bottomNav: {
    display: "none",
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#080f20",
    borderTop: "1px solid #1a2d52",
    zIndex: 100,
    padding: "8px 0 4px",
  },
  bottomNavItem: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    background: "transparent",
    border: "none",
    color: "#7a9cc5",
    cursor: "pointer",
    padding: "4px 8px",
  },
  bottomNavItemActive: { color: "#4f8ef7" },
};
