"use client";
import { useRouter, usePathname } from "next/navigation";
import { clearToken } from "@/lib/portal-auth";
import { useTheme } from "@/contexts/theme-context";
import { PushPermissionBanner } from "@/components/PushPermissionBanner";
import Image from "next/image";
import {
  Home, ClipboardList, FileText, User, LogOut,
  MessageCircle, TrendingUp, Sun, Moon,
} from "lucide-react";

const NAV = [
  { href: "/portal/dashboard",    icon: Home,          label: "الرئيسية"       },
  { href: "/portal/applications", icon: ClipboardList, label: "التقديمات"      },
  { href: "/portal/cv",           icon: FileText,      label: "سيرتي"          },
  { href: "/portal/profile",      icon: User,          label: "حسابي"          },
  { href: "/portal/affiliate",    icon: TrendingUp,    label: "برنامج الربح"   },
  { href: "/portal/support",      icon: MessageCircle, label: "الدعم"          },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  function logout() { clearToken(); router.replace("/portal/login"); }

  const t = {
    bg:       dark ? "#0a0a0a"   : "#f4f4f5",
    sidebar:  dark ? "#0f0f0f"   : "#ffffff",
    border:   dark ? "#1f1f1f"   : "#e4e4e7",
    border2:  dark ? "#2a2a2a"   : "#d4d4d8",
    text:     dark ? "#ffffff"   : "#09090b",
    text3:    dark ? "#999"      : "#71717a",
    navHover: dark ? "#1a1a1a"   : "#f4f4f5",
    navActive:dark ? "#1e1e1e"   : "#f0f0f0",
    logoFg:   dark ? "#0a0a0a"   : "#ffffff",
    logoBg:   dark ? "#ffffff"   : "#09090b",
    main:     dark ? "#0a0a0a"   : "#f4f4f5",
    bottomBg: dark ? "rgba(10,10,10,0.95)" : "rgba(244,244,245,0.96)",
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", direction: "rtl" }}>

      {/* ─── SIDEBAR ─── */}
      <aside className="portal-sidebar" style={{
        width: 240, minHeight: "100vh",
        background: t.sidebar, borderLeft: `1px solid ${t.border}`,
        display: "flex", flexDirection: "column",
        padding: "0 12px 16px", position: "sticky",
        top: 0, height: "100vh", flexShrink: 0,
        overflowY: "auto",
      }}>
        {/* Logo */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "20px 8px 20px",
          borderBottom: `1px solid ${t.border}`,
          marginBottom: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            overflow: "hidden", flexShrink: 0,
          }}>
            <Image src="/logo.png" alt="Jobbots" width={40} height={40} style={{ borderRadius: 12 }} />
          </div>
          <div>
            <p style={{ color: t.text, fontSize: 15, fontWeight: 800, margin: 0 }}>Jobbots</p>
            <p style={{ color: t.text3, fontSize: 11, margin: "2px 0 0" }}>بوابة المستخدمين</p>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1 }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/portal/dashboard" && pathname.startsWith(href));
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  width: "100%", padding: "12px 12px",
                  borderRadius: 12, background: active ? t.navActive : "transparent",
                  border: "none", cursor: "pointer",
                  marginBottom: 3, position: "relative",
                  transition: "background 0.15s",
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 11,
                  background: active ? (dark ? "#fff" : "#09090b") : (dark ? "#1a1a1a" : "#f4f4f5"),
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  border: `1px solid ${active ? "transparent" : t.border}`,
                }}>
                  <Icon
                    size={18} strokeWidth={active ? 2 : 1.5}
                    color={active ? (dark ? "#0a0a0a" : "#fff") : t.text3}
                  />
                </div>
                <span style={{
                  fontSize: 14, fontWeight: active ? 700 : 400,
                  color: active ? t.text : t.text3,
                }}>
                  {label}
                </span>
                {active && (
                  <div style={{
                    position: "absolute", left: 8, top: "50%",
                    transform: "translateY(-50%)",
                    width: 4, height: 4, borderRadius: "50%",
                    background: dark ? "#fff" : "#09090b",
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${t.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Theme toggle */}
          <button
            onClick={toggle}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              width: "100%", padding: "11px 12px",
              borderRadius: 12, background: "transparent",
              border: `1px solid ${t.border}`,
              cursor: "pointer", transition: "background 0.15s",
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: dark ? "#1a1a1a" : "#f4f4f5",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              border: `1px solid ${t.border}`,
            }}>
              {dark
                ? <Sun size={17} strokeWidth={1.5} color="#f59e0b" />
                : <Moon size={17} strokeWidth={1.5} color="#6366f1" />}
            </div>
            <span style={{ fontSize: 13, color: t.text3, fontWeight: 500 }}>
              {dark ? "الوضع النهاري" : "الوضع الليلي"}
            </span>
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              width: "100%", padding: "11px 12px",
              borderRadius: 12, background: "transparent",
              border: `1px solid ${t.border}`,
              cursor: "pointer",
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: dark ? "#1a0a0a" : "#fff0f0",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              border: `1px solid ${dark ? "#3f1515" : "#fecaca"}`,
            }}>
              <LogOut size={17} strokeWidth={1.5} color="#f87171" />
            </div>
            <span style={{ fontSize: 13, color: "#f87171", fontWeight: 500 }}>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* ─── MAIN ─── */}
      <main className="portal-main" style={{
        flex: 1, padding: "28px 24px 80px",
        minHeight: "100vh", minWidth: 0, background: t.main,
      }}>
        <PushPermissionBanner />
        {children}
      </main>

      {/* ─── MOBILE BOTTOM NAV ─── */}
      <nav className="portal-bottom-nav no-scrollbar" style={{
        display: "none", position: "fixed",
        bottom: 0, left: 0, right: 0,
        background: t.bottomBg,
        WebkitBackdropFilter: "blur(12px)",
        backdropFilter: "blur(12px)",
        borderTop: `1px solid ${t.border}`,
        zIndex: 100,
        paddingBottom: "max(4px, env(safe-area-inset-bottom))",
      }}>
        <div className="no-scrollbar" style={{
          display: "flex", overflowX: "auto", overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
        }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/portal/dashboard" && pathname.startsWith(href));
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                style={{
                  flex: "0 0 auto", minWidth: 60,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 3,
                  background: "transparent", border: "none",
                  cursor: "pointer", padding: "8px 10px 4px",
                  color: active ? t.text : t.text3,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <Icon size={21} strokeWidth={active ? 2 : 1.5} />
                <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 400, whiteSpace: "nowrap" }}>
                  {label}
                </span>
              </button>
            );
          })}
          <button
            onClick={toggle}
            style={{
              flex: "0 0 auto", minWidth: 60,
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 3,
              background: "transparent", border: "none",
              cursor: "pointer", padding: "8px 10px 4px",
              color: t.text3,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {dark ? <Sun size={21} strokeWidth={1.5} color="#f59e0b" /> : <Moon size={21} strokeWidth={1.5} color="#6366f1" />}
            <span style={{ fontSize: 9.5, whiteSpace: "nowrap" }}>{dark ? "نهاري" : "ليلي"}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
