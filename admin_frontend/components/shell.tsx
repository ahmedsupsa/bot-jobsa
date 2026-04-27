"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Key, BriefcaseBusiness, Bell, LogOut,
  ShoppingBag, TrendingUp, MessageCircle, MailCheck, ShieldCheck, Send,
  Sun, Moon, Contact,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/theme-context";

type Perm =
  | "users" | "codes" | "jobs" | "crm" | "notifications"
  | "store" | "support" | "affiliate" | "finance" | "email-test" | "admins";

type Me = { ok: true; username: string; isSuper: boolean; permissions: Perm[] } | null;
type BadgeKey = "support" | "store" | "affiliate";
type Badges = Partial<Record<BadgeKey, number>>;

const links: { href: string; label: string; icon: any; perm: Perm | null; badge?: BadgeKey }[] = [
  { href: "/admin", label: "الرئيسية", icon: LayoutDashboard, perm: null },
  { href: "/users", label: "المستخدمون", icon: Users, perm: "users" },
  { href: "/codes", label: "أكواد التفعيل", icon: Key, perm: "codes" },
  { href: "/jobs", label: "الوظائف", icon: BriefcaseBusiness, perm: "jobs" },
  { href: "/crm", label: "علاقات العملاء", icon: Contact, perm: "crm" },
  { href: "/notifications", label: "إشعارات Push", icon: Bell, perm: "notifications" },
  { href: "/store-admin", label: "المتجر", icon: ShoppingBag, perm: "store", badge: "store" },
  { href: "/support-admin", label: "الدعم الفني", icon: MessageCircle, perm: "support", badge: "support" },
  { href: "/affiliate-admin", label: "برنامج الربح", icon: TrendingUp, perm: "affiliate", badge: "affiliate" },
  { href: "/finance", label: "المالية", icon: TrendingUp, perm: "finance" },
  { href: "/admin/email-test", label: "اختبار الإيميل", icon: MailCheck, perm: "email-test" },
  { href: "/admin/send-email", label: "إرسال بريد", icon: Send, perm: "email-test" },
  { href: "/admin/admins", label: "إدارة المسؤولين", icon: ShieldCheck, perm: "admins" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [me, setMe] = useState<Me>(null);
  const [badges, setBadges] = useState<Badges>({});

  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/admin/badges", { credentials: "include", cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled && j.ok) setBadges(j.badges || {});
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [me, path]);

  const visible = me
    ? links.filter(l => l.perm === null || me.isSuper || me.permissions.includes(l.perm))
    : links;

  // Block rendering when current page is forbidden for this admin.
  useEffect(() => {
    if (!me) return;
    const link = links.find(l => l.href !== "/admin" && path.startsWith(l.href));
    if (link && link.perm && !me.isSuper && !me.permissions.includes(link.perm)) {
      router.replace("/admin");
    }
  }, [me, path, router]);

  return (
    <div className="flex min-h-screen" dir="rtl">
      <aside
        className={`
          fixed inset-y-0 right-0 z-40 flex w-60 flex-col bg-sidebar shadow-sidebar
          border-l border-line transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "translate-x-full"}
          md:translate-x-0 md:static md:z-auto
        `}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-line">
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 5 }}>
            <Image src="/logo-transparent.png" alt="Jobbots" width={28} height={28} style={{ display: "block" }} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-ink truncate">Jobbots</div>
            <div className="text-xs text-muted truncate">
              {me ? (me.isSuper ? "مدير عام" : `أهلاً، ${me.username}`) : "لوحة الإدارة"}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visible.map((l) => {
            const active = path === l.href;
            const count = l.badge ? badges[l.badge] || 0 : 0;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all
                  ${active
                    ? "bg-panel2 text-ink border border-line2"
                    : "text-muted hover:bg-panel2 hover:text-ink border border-transparent"
                  }
                `}
              >
                <l.icon size={17} className={active ? "text-ink" : "text-muted2"} />
                <span className="flex-1 truncate">{l.label}</span>
                {count > 0 && (
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999,
                      background: "#ef4444", color: "#fff",
                      fontSize: 11, fontWeight: 800, lineHeight: 1,
                      boxShadow: "0 0 0 2px var(--sidebar, #fff)",
                    }}
                    title={`${count} عنصر يحتاج انتباهك`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-line space-y-1.5">
          <button
            onClick={toggle}
            aria-label={dark ? "الوضع النهاري" : "الوضع الليلي"}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink2 hover:bg-panel2 transition-all border border-transparent hover:border-line"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
            {dark ? "الوضع النهاري" : "الوضع الليلي"}
          </button>
          <button
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
              window.location.href = "/login";
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-danger hover:bg-danger-bg transition-all border border-transparent hover:border-danger-border"
          >
            <LogOut size={17} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[var(--modal-backdrop)] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-line bg-sidebar px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }}>
              <Image src="/logo-transparent.png" alt="Jobbots" width={22} height={22} style={{ display: "block" }} />
            </div>
            <span className="text-sm font-semibold text-ink">Jobbots</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label={dark ? "الوضع النهاري" : "الوضع الليلي"}
              className="rounded-lg border border-line p-2 text-ink2 hover:text-ink"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-line p-2 text-muted hover:text-ink"
            >
              ☰
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-bg">
          {children}
        </main>
      </div>
    </div>
  );
}
