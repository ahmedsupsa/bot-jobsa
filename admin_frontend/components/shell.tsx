"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Key, BriefcaseBusiness, Megaphone, Bell, LogOut, ShoppingBag, TrendingUp, MessageCircle, MailCheck } from "lucide-react";
import { useState } from "react";

const links = [
  { href: "/admin", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/users", label: "المستخدمون", icon: Users },
  { href: "/codes", label: "أكواد التفعيل", icon: Key },
  { href: "/jobs", label: "الوظائف", icon: BriefcaseBusiness },
  { href: "/announcements", label: "الإعلانات", icon: Megaphone },
  { href: "/notifications", label: "إشعارات Push", icon: Bell },
  { href: "/store-admin", label: "المتجر", icon: ShoppingBag },
  { href: "/support-admin", label: "الدعم الفني", icon: MessageCircle },
  { href: "/affiliate-admin", label: "برنامج الربح", icon: TrendingUp },
  { href: "/finance", label: "المالية", icon: TrendingUp },
  { href: "/admin/email-test", label: "اختبار الإيميل", icon: MailCheck },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen" dir="rtl">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 right-0 z-40 flex w-60 flex-col bg-sidebar shadow-sidebar
          border-l border-line transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "translate-x-full"}
          md:translate-x-0 md:static md:z-auto
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-line">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden">
            <Image src="/logo.png" alt="Jobbots" width={36} height={36} className="rounded-xl" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Jobbots</div>
            <div className="text-xs text-slate-500">لوحة الإدارة</div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {links.map((l) => {
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

        {/* Footer */}
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

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar (mobile) */}
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-bg">
          {children}
        </main>
      </div>
    </div>
  );
}
