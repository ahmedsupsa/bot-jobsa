"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Key, BriefcaseBusiness, Bell, LogOut,
  ShoppingBag, TrendingUp, MessageCircle, MailCheck, ShieldCheck, Send,
  Sun, Moon, Contact, MessagesSquare, Activity, BrainCircuit, Radio,
  ChevronDown, KeyRound, X, Loader2, Eye, EyeOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/theme-context";

type Perm =
  | "users" | "codes" | "jobs" | "crm" | "notifications"
  | "store" | "support" | "affiliate" | "finance" | "email-test" | "admins";

type Me = { ok: true; username: string; isSuper: boolean; permissions: Perm[] } | null;
type BadgeKey = "support" | "store" | "affiliate";
type Badges = Partial<Record<BadgeKey, number>>;

type NavLink = {
  href: string;
  label: string;
  icon: any;
  perm: Perm | null;
  superOnly?: boolean;
  badge?: BadgeKey;
};

type NavGroup = {
  id: string;
  title: string;
  links: NavLink[];
};

const groups: NavGroup[] = [
  {
    id: "dashboard",
    title: "لوحة التحكم",
    links: [
      { href: "/admin",        label: "الرئيسية",       icon: LayoutDashboard, perm: null, superOnly: true },
      { href: "/admin/status", label: "حالة النظام",     icon: Activity,        perm: null, superOnly: true },
    ],
  },
  {
    id: "users",
    title: "إدارة المستخدمين",
    links: [
      { href: "/users",        label: "المستخدمون",      icon: Users,       perm: "users" },
      { href: "/codes",        label: "أكواد التفعيل",   icon: Key,         perm: "codes" },
      { href: "/admin/admins", label: "إدارة المسؤولين", icon: ShieldCheck, perm: "admins" },
    ],
  },
  {
    id: "jobs",
    title: "الوظائف والتقديم",
    links: [
      { href: "/jobs",                   label: "الوظائف",           icon: BriefcaseBusiness, perm: "jobs" },
      { href: "/applications",           label: "مراقبة التقديمات",  icon: BrainCircuit,      perm: "jobs" },
      { href: "/admin/telegram-channel", label: "قناة Telegram",     icon: Radio,             perm: "jobs", superOnly: true },
    ],
  },
  {
    id: "comms",
    title: "التواصل والعملاء",
    links: [
      { href: "/admin/chat",       label: "الدردشة الداخلية", icon: MessagesSquare, perm: null },
      { href: "/crm",              label: "علاقات العملاء",   icon: Contact,        perm: "crm" },
      { href: "/support-admin",    label: "الدعم الفني",      icon: MessageCircle,  perm: "support",      badge: "support" },
      { href: "/notifications",    label: "إشعارات Push",     icon: Bell,           perm: "notifications" },
      { href: "/admin/send-email", label: "إرسال بريد",       icon: Send,           perm: "email-test" },
      { href: "/admin/email-test", label: "اختبار الإيميل",   icon: MailCheck,      perm: "email-test" },
    ],
  },
  {
    id: "store",
    title: "المتجر والربح",
    links: [
      { href: "/store-admin",     label: "المتجر",       icon: ShoppingBag, perm: "store",     badge: "store" },
      { href: "/affiliate-admin", label: "برنامج الربح", icon: TrendingUp,  perm: "affiliate", badge: "affiliate" },
      { href: "/finance",         label: "المالية",      icon: TrendingUp,  perm: "finance" },
    ],
  },
];

const allLinks: NavLink[] = groups.flatMap(g => g.links);

function getActiveGroupId(pathname: string): string | null {
  for (const g of groups) {
    for (const l of g.links) {
      if (pathname === l.href || (l.href !== "/admin" && pathname.startsWith(l.href))) {
        return g.id;
      }
    }
  }
  return groups[0]?.id ?? null;
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function save() {
    setErr("");
    if (next !== confirm) { setErr("كلمتا المرور الجديدتان غير متطابقتين"); return; }
    if (next.length < 6) { setErr("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "فشل التغيير"); return; }
      setDone(true);
    } finally { setSaving(false); }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 400, background: "var(--sidebar)", border: "1px solid var(--border)", borderRadius: 20, padding: 24, direction: "rtl" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--panel2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <KeyRound size={16} className="text-ink" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>تغيير كلمة المرور</div>
              <div style={{ fontSize: 11, color: "var(--muted2)" }}>سيُطبَّق على حسابك الحالي</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)", borderRadius: 12, padding: "14px 16px", color: "var(--success-fg)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              ✅ تم تغيير كلمة المرور بنجاح
            </div>
            <button onClick={onClose} className="w-full rounded-xl bg-accent text-accent-fg py-3 text-sm font-bold">
              إغلاق
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <PwField label="كلمة المرور الحالية" value={current} onChange={setCurrent} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />
            <PwField label="كلمة المرور الجديدة" value={next} onChange={setNext} show={showNext} onToggle={() => setShowNext(v => !v)} />
            <PwField label="تأكيد كلمة المرور الجديدة" value={confirm} onChange={setConfirm} show={showNext} onToggle={() => setShowNext(v => !v)} />
            {err && (
              <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 10, padding: "9px 13px", color: "var(--danger)", fontSize: 12.5 }}>
                {err}
              </div>
            )}
            <button
              onClick={save}
              disabled={saving || !current || !next || !confirm}
              className="w-full rounded-xl bg-accent text-accent-fg py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              {saving ? "جاري الحفظ…" : "تغيير كلمة المرور"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PwField({ label, value, onChange, show, onToggle }: { label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          dir="ltr"
          placeholder="••••••••"
          className="w-full rounded-xl bg-panel2 border border-line px-3 py-2.5 text-sm text-ink outline-none focus:border-line2 pr-10"
          style={{ paddingLeft: 36 }}
        />
        <button
          type="button"
          onClick={onToggle}
          style={{ position: "absolute", left: 10, background: "none", border: "none", cursor: "pointer", color: "var(--muted2)", display: "flex", padding: 2 }}
          tabIndex={-1}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </label>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [me, setMe] = useState<Me>(null);
  const [badges, setBadges] = useState<Badges>({});
  const [showChangePw, setShowChangePw] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = getActiveGroupId(path);
    return new Set(active ? [active] : []);
  });

  useEffect(() => {
    const active = getActiveGroupId(path);
    if (active) {
      setOpenGroups(prev => {
        if (prev.has(active)) return prev;
        return new Set([...prev, active]);
      });
    }
  }, [path]);

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
      } catch { }
    };
    load();
    const id = setInterval(load, 30_000);
    window.addEventListener("focus", load);
    return () => { cancelled = true; clearInterval(id); window.removeEventListener("focus", load); };
  }, [me, path]);

  function isVisible(l: NavLink): boolean {
    if (!me) return false;
    if (l.superOnly && !me.isSuper) return false;
    return l.perm === null || me.isSuper || me.permissions.includes(l.perm);
  }

  const visibleGroups = groups
    .map(g => ({ ...g, links: g.links.filter(isVisible) }))
    .filter(g => g.links.length > 0);

  function toggleGroup(id: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (!me) return;
    const firstAllowed = allLinks.find(l => isVisible(l));
    const fallback = firstAllowed?.href ?? "/login";
    if (path === "/admin" && !me.isSuper) { router.replace(fallback); return; }
    const link = allLinks.find(l => l.href !== "/admin" && path.startsWith(l.href));
    if (link) {
      const blocked = (link.superOnly && !me.isSuper) || (link.perm && !me.isSuper && !me.permissions.includes(link.perm));
      if (blocked) router.replace(fallback);
    }
  }, [me, path, router]);

  function renderLink(l: NavLink) {
    const active = path === l.href || (l.href !== "/admin" && path.startsWith(l.href));
    const count = l.badge ? badges[l.badge] || 0 : 0;
    return (
      <Link
        key={l.href}
        href={l.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
          active
            ? "bg-panel2 text-ink border border-line2"
            : "text-muted hover:bg-panel2 hover:text-ink border border-transparent"
        }`}
      >
        <l.icon size={17} className={active ? "text-ink" : "text-muted2"} />
        <span className="flex-1 truncate">{l.label}</span>
        {count > 0 && (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999,
            background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 800, lineHeight: 1,
            boxShadow: "0 0 0 2px var(--sidebar, #fff)",
          }}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    );
  }

  const sidebar = (
    <aside className={`
      fixed inset-y-0 right-0 z-40 flex w-60 flex-col bg-sidebar shadow-sidebar
      border-l border-line transition-transform duration-300
      ${mobileOpen ? "translate-x-0" : "translate-x-full"}
      md:translate-x-0 md:static md:z-auto
    `}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-line shrink-0">
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

      {/* Scrollable area: nav + bottom buttons together */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {/* Nav groups */}
        <nav className="px-3 py-3 space-y-1">
          {visibleGroups.map((group) => {
            const isOpen = openGroups.has(group.id);
            const hasActive = group.links.some(
              l => path === l.href || (l.href !== "/admin" && path.startsWith(l.href))
            );
            return (
              <div key={group.id}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider select-none ${
                    hasActive
                      ? "text-ink bg-panel2 border border-line2"
                      : "text-muted hover:text-ink hover:bg-panel2 border border-transparent"
                  }`}
                >
                  <span>{group.title}</span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div className="mt-0.5 mb-1 space-y-0.5 pr-1">
                    {group.links.map(l => renderLink(l))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom buttons — follow nav content, no gap */}
        <div className="px-3 py-4 border-t border-line space-y-1.5 mt-auto">
          <button
            onClick={toggle}
            aria-label={dark ? "الوضع النهاري" : "الوضع الليلي"}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink2 hover:bg-panel2 transition-all border border-transparent hover:border-line"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
            {dark ? "الوضع النهاري" : "الوضع الليلي"}
          </button>
          <button
            onClick={() => setShowChangePw(true)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink2 hover:bg-panel2 transition-all border border-transparent hover:border-line"
          >
            <KeyRound size={17} />
            تغيير كلمة المرور
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
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen" dir="rtl">
      {sidebar}

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

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  );
}
