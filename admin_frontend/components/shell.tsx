"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "الرئيسية" },
  { href: "/users", label: "المستخدمون" },
  { href: "/codes", label: "الأكواد" },
  { href: "/jobs", label: "الوظائف" },
  { href: "/announcements", label: "الإعلانات" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <main className="mx-auto min-h-screen max-w-7xl p-4 md:p-8">
      <div className="mb-6 rounded-xl border border-line/60 bg-panel/80 p-5 shadow-glow">
        <h1 className="text-2xl font-bold">لوحة الأدمن الاحترافية</h1>
        <p className="mt-1 text-sm text-slate-300">Next.js + Tailwind + Framer Motion</p>
      </div>
      <nav className="mb-6 flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg border px-3 py-2 text-sm ${
              path === l.href
                ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                : "border-line/70 bg-panel/70 text-slate-200"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
