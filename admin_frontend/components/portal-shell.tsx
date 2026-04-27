"use client";
import { useRouter, usePathname } from "next/navigation";
import { clearToken } from "@/lib/portal-auth";
import { useTheme } from "@/contexts/theme-context";
import { PushPermissionBanner } from "@/components/PushPermissionBanner";
import Image from "next/image";
import {
  Home, ClipboardList, FileText, User, LogOut,
  MessageCircle, TrendingUp, Sun, Moon, Receipt, Mail,
} from "lucide-react";

const SIDEBAR_NAV = [
  { href: "/portal/dashboard",    icon: Home,          label: "الرئيسية"     },
  { href: "/portal/applications", icon: ClipboardList, label: "التقديمات"    },
  { href: "/portal/cv",           icon: FileText,      label: "سيرتي"        },
  { href: "/portal/email",        icon: Mail,          label: "ربط الإيميل"  },
  { href: "/portal/billing",      icon: Receipt,       label: "الفواتير"     },
  { href: "/portal/profile",      icon: User,          label: "حسابي"        },
  { href: "/portal/affiliate",    icon: TrendingUp,    label: "برنامج الربح" },
  { href: "/portal/support",      icon: MessageCircle, label: "الدعم"        },
];

// 5 primary tabs shown in the floating bottom bar
const BOTTOM_NAV = [
  { href: "/portal/dashboard",    icon: Home,          label: "الرئيسية"  },
  { href: "/portal/applications", icon: ClipboardList, label: "التقديمات" },
  { href: "/portal/cv",           icon: FileText,      label: "سيرتي"     },
  { href: "/portal/email",        icon: Mail,          label: "الإيميل"   },
  { href: "/portal/profile",      icon: User,          label: "حسابي"     },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  function logout() { clearToken(); router.replace("/portal/login"); }

  const t = {
    bg:        dark ? "#0a0a0a" : "#f4f4f5",
    sidebar:   dark ? "#0f0f0f" : "#ffffff",
    border:    dark ? "#1f1f1f" : "#e4e4e7",
    border2:   dark ? "#2a2a2a" : "#d4d4d8",
    text:      dark ? "#ffffff" : "#09090b",
    text3:     dark ? "#666"    : "#a1a1aa",
    navActive: dark ? "#1e1e1e" : "#f0f0f0",
    main:      dark ? "#0a0a0a" : "#f4f4f5",
    // floating nav colors
    navBg:     dark ? "rgba(18,18,18,0.96)"  : "rgba(255,255,255,0.96)",
    navShadow: dark
      ? "0 -2px 0 rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)"
      : "0 -1px 0 rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
    pillBg:    dark ? "#ffffff" : "#09090b",
    pillText:  dark ? "#09090b" : "#ffffff",
    iconInactive: dark ? "#555" : "#b0b0b8",
    labelInactive: dark ? "#555" : "#b0b0b8",
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", direction: "rtl" }}>

      {/* ─── SIDEBAR (desktop) ─── */}
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
          padding: "20px 8px",
          borderBottom: `1px solid ${t.border}`,
          marginBottom: 10, flexShrink: 0,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
            <Image src="/logo.png" alt="Jobbots" width={40} height={40} style={{ borderRadius: 12 }} />
          </div>
          <div>
            <p style={{ color: t.text, fontSize: 15, fontWeight: 800, margin: 0 }}>Jobbots</p>
            <p style={{ color: t.text3, fontSize: 11, margin: "2px 0 0" }}>بوابة المستخدمين</p>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1 }}>
          {SIDEBAR_NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/portal/dashboard" && pathname.startsWith(href));
            return (
              <button key={href} onClick={() => router.push(href)} style={{
                display: "flex", alignItems: "center", gap: 12,
                width: "100%", padding: "12px 12px",
                borderRadius: 12, background: active ? t.navActive : "transparent",
                border: "none", cursor: "pointer",
                marginBottom: 3, position: "relative",
                transition: "background 0.15s",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11,
                  background: active ? (dark ? "#fff" : "#09090b") : (dark ? "#1a1a1a" : "#f4f4f5"),
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  border: `1px solid ${active ? "transparent" : t.border}`,
                }}>
                  <Icon size={18} strokeWidth={active ? 2 : 1.5} color={active ? (dark ? "#0a0a0a" : "#fff") : t.text3} />
                </div>
                <span style={{ fontSize: 14, fontWeight: active ? 700 : 400, color: active ? t.text : t.text3 }}>
                  {label}
                </span>
                {active && (
                  <div style={{
                    position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
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
          <button onClick={toggle} style={{
            display: "flex", alignItems: "center", gap: 12,
            width: "100%", padding: "11px 12px",
            borderRadius: 12, background: "transparent",
            border: `1px solid ${t.border}`, cursor: "pointer",
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: dark ? "#1a1a1a" : "#f4f4f5",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              border: `1px solid ${t.border}`,
            }}>
              {dark ? <Sun size={17} strokeWidth={1.5} color="#f59e0b" /> : <Moon size={17} strokeWidth={1.5} color="#6366f1" />}
            </div>
            <span style={{ fontSize: 13, color: t.text3, fontWeight: 500 }}>
              {dark ? "الوضع النهاري" : "الوضع الليلي"}
            </span>
          </button>
          <button onClick={logout} style={{
            display: "flex", alignItems: "center", gap: 12,
            width: "100%", padding: "11px 12px",
            borderRadius: 12, background: "transparent",
            border: `1px solid ${t.border}`, cursor: "pointer",
          }}>
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
        flex: 1, paddingTop: 28, paddingBottom: 96,
        minHeight: "100vh", minWidth: 0, background: t.main,
      }}>
        <div className="portal-container">
          {/* Top bar (mobile only) */}
          <div className="portal-topbar" style={{
            display: "none",
            alignItems: "center", justifyContent: "space-between",
            marginBottom: 16,
            paddingTop: "max(0px, env(safe-area-inset-top))",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, overflow: "hidden", flexShrink: 0 }}>
                <Image src="/logo.png" alt="Jobbots" width={36} height={36} style={{ borderRadius: 11 }} />
              </div>
              <span style={{ color: t.text, fontSize: 15, fontWeight: 800 }}>Jobbots</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={toggle} aria-label="تبديل الوضع" style={{
                width: 40, height: 40, borderRadius: 11,
                background: t.sidebar, border: `1px solid ${t.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0, WebkitTapHighlightColor: "transparent",
              }}>
                {dark ? <Sun size={18} strokeWidth={1.7} color="#f59e0b" /> : <Moon size={18} strokeWidth={1.7} color="#6366f1" />}
              </button>
              <button onClick={logout} aria-label="تسجيل الخروج" style={{
                width: 40, height: 40, borderRadius: 11,
                background: dark ? "#1a0a0a" : "#fff0f0",
                border: `1px solid ${dark ? "#3f1515" : "#fecaca"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0, WebkitTapHighlightColor: "transparent",
              }}>
                <LogOut size={18} strokeWidth={1.7} color="#f87171" />
              </button>
            </div>
          </div>

          <PushPermissionBanner />
          {children}
        </div>
      </main>

      {/* ─── FLOATING MOBILE BOTTOM NAV ─── */}
      <nav
        className="portal-bottom-nav"
        style={{
          display: "none",
          position: "fixed",
          bottom: `max(16px, calc(env(safe-area-inset-bottom) + 10px))`,
          left: 14,
          right: 14,
          background: t.navBg,
          borderRadius: 26,
          boxShadow: t.navShadow,
          zIndex: 100,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          padding: "6px 8px",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
        }}>
          {BOTTOM_NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/portal/dashboard" && pathname.startsWith(href));
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 2px",
                  WebkitTapHighlightColor: "transparent",
                  position: "relative",
                }}
              >
                {/* Icon pill */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  padding: active ? "7px 18px" : "7px 12px",
                  borderRadius: 18,
                  background: active ? t.pillBg : "transparent",
                  transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}>
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.2 : 1.6}
                    color={active ? t.pillText : t.iconInactive}
                  />
                  <span style={{
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    color: active ? t.pillText : t.labelInactive,
                    whiteSpace: "nowrap",
                    letterSpacing: active ? "-0.2px" : "0",
                    lineHeight: 1,
                  }}>
                    {label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
