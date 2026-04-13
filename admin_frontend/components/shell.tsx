"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Key, BriefcaseBusiness, Megaphone, LogOut, Bot } from "lucide-react";
import { useState } from "react";

const links = [
  { href: "/", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/users", label: "المستخدمون", icon: Users },
  { href: "/codes", label: "أكواد التفعيل", icon: Key },
  { href: "/jobs", label: "الوظائف", icon: BriefcaseBusiness },
  { href: "/announcements", label: "الإعلانات", icon: Megaphone },
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
          border-l border-line/60 transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "translate-x-full"}
          md:translate-x-0 md:static md:z-auto
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-line/60">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20 border border-accent/30">
            <Bot size={20} className="text-accent" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Jobsa Bot</div>
            <div className="text-xs text-slate-400">لوحة الإدارة</div>
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
                    ? "bg-accent/15 text-accent border border-accent/25"
                    : "text-slate-300 hover:bg-panel2 hover:text-white border border-transparent"
                  }
                `}
              >
                <l.icon size={17} className={active ? "text-accent" : "text-slate-400"} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-line/60">
          <a
            href="/logout"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
          >
            <LogOut size={17} />
            تسجيل الخروج
          </a>
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
        <header className="flex items-center justify-between border-b border-line/60 bg-panel/80 px-4 py-3 md:hidden">
          <div className="text-sm font-semibold">Jobsa Bot Admin</div>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-line p-2 text-slate-300"
          >
            ☰
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
