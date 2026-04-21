"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Key, BriefcaseBusiness, Bell, LogOut,
  ShoppingBag, TrendingUp, MessageCircle, MailCheck, FileText, ShieldCheck, Send,
} from "lucide-react";
import { useEffect, useState } from "react";

type Perm =
  | "users" | "codes" | "jobs" | "templates" | "notifications"
  | "store" | "support" | "affiliate" | "finance" | "email-test" | "admins";

type Me = { ok: true; username: string; isSuper: boolean; permissions: Perm[] } | null;

const links: { href: string; label: string; icon: any; perm: Perm | null }[] = [
  { href: "/admin", label: "الرئيسية", icon: LayoutDashboard, perm: null },
  { href: "/users", label: "المستخدمون", icon: Users, perm: "users" },
  { href: "/codes", label: "أكواد التفعيل", icon: Key, perm: "codes" },
  { href: "/jobs", label: "الوظائف", icon: BriefcaseBusiness, perm: "jobs" },
  { href: "/templates", label: "قوالب الرسائل", icon: FileText, perm: "templates" },
  { href: "/notifications", label: "إشعارات Push", icon: Bell, perm: "notifications" },
  { href: "/store-admin", label: "المتجر", icon: ShoppingBag, perm: "store" },
  { href: "/support-admin", label: "الدعم الفني", icon: MessageCircle, perm: "support" },
  { href: "/affiliate-admin", label: "برنامج الربح", icon: TrendingUp, perm: "affiliate" },
  { href: "/finance", label: "المالية", icon: TrendingUp, perm: "finance" },
  { href: "/admin/email-test", label: "اختبار الإيميل", icon: MailCheck, perm: "email-test" },
  { href: "/admin/send-email", label: "إرسال بريد", icon: Send, perm: "email-test" },
  { href: "/admin/admins", label: "إدارة المسؤولين", icon: ShieldCheck, perm: "admins" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [me, setMe] = useState<Me>(null);

  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden">
            <Image src="/logo.png" alt="Jobbots" width={36} height={36} className="rounded-xl" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">Jobbots</div>
            <div className="text-xs text-slate-500 truncate">
              {me ? (me.isSuper ? "مدير عام" : `أهلاً، ${me.username}`) : "لوحة الإدارة"}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visible.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all
                  ${active
                    ? "bg-white/10 text-white border border-white/20"
                    : "text-slate-400 hover:bg-panel2 hover:text-white border border-transparent"
                  }
                `}
              >
                <l.icon size={17} className={active ? "text-white" : "text-slate-500"} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-line">
          <button
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
              window.location.href = "/login";
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
          >
            <LogOut size={17} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-line bg-sidebar px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden">
              <Image src="/logo.png" alt="Jobbots" width={28} height={28} className="rounded-lg" />
            </div>
            <span className="text-sm font-semibold text-white">Jobbots</span>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-line p-2 text-slate-400 hover:text-white"
          >
            ☰
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-bg">
          {children}
        </main>
      </div>
    </div>
  );
}
