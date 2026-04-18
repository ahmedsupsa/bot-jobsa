"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";
import { User, Phone, MapPin, Calendar, Mail, CreditCard, Send, ArrowRight } from "lucide-react";

interface UserData {
  full_name: string; phone: string; age: number | null; city: string;
  subscription_active: boolean; days_left: number; subscription_ends_at: string;
  applications_count: number; email: string; sender_email_alias: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalFetch("/me")
      .then(async res => {
        if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
        setUser(await res.json());
      })
      .catch(() => { clearToken(); router.replace("/portal/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <PortalShell><p style={{ color: "#555", padding: 60, textAlign: "center" }}>جاري التحميل…</p></PortalShell>;
  if (!user) return null;

  const active = user.subscription_active;
  const endDate = user.subscription_ends_at
    ? new Date(user.subscription_ends_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  return (
    <PortalShell>
      <div style={s.page}>
        {/* Profile header */}
        <div style={s.hero}>
          <div style={s.avatar}>{user.full_name.charAt(0)}</div>
          <div style={{ flex: 1 }}>
            <h1 style={s.name}>{user.full_name}</h1>
            <div style={s.meta}>
              <span style={s.metaItem}><MapPin size={13} strokeWidth={1.5} /> {user.city}</span>
              {user.age && <span style={s.metaItem}><Calendar size={13} strokeWidth={1.5} /> {user.age} سنة</span>}
            </div>
          </div>
          <div style={{
            ...s.subBadge,
            background: active ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            borderColor: active ? "#22c55e22" : "#ef444422",
            color: active ? "#22c55e" : "#ef4444",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
            {active ? `نشط · ${user.days_left} يوم` : "منتهٍ"}
          </div>
        </div>

        <div style={s.grid}>
          {/* Personal info */}
          <Section icon={<User size={16} strokeWidth={1.5} />} title="البيانات الشخصية">
            <Row icon={<User size={14} strokeWidth={1.5} />} label="الاسم الكامل" value={user.full_name} />
            <Row icon={<Phone size={14} strokeWidth={1.5} />} label="رقم الجوال" value={user.phone} dir="ltr" />
            {user.age && <Row icon={<Calendar size={14} strokeWidth={1.5} />} label="العمر" value={`${user.age} سنة`} />}
            <Row icon={<MapPin size={14} strokeWidth={1.5} />} label="المدينة" value={user.city} />
          </Section>

          {/* Subscription */}
          <Section icon={<CreditCard size={16} strokeWidth={1.5} />} title="الاشتراك">
            <Row icon={<CreditCard size={14} strokeWidth={1.5} />} label="النوع" value="شهري" />
            <Row icon={<Calendar size={14} strokeWidth={1.5} />} label="تاريخ الانتهاء" value={endDate} />
            <Row icon={<Calendar size={14} strokeWidth={1.5} />} label="الأيام المتبقية" value={`${user.days_left} يوم`} />
            <Row icon={<Send size={14} strokeWidth={1.5} />} label="التقديمات المرسلة" value={`${user.applications_count} تقديم`} />
          </Section>

          {/* Email */}
          <Section icon={<Mail size={16} strokeWidth={1.5} />} title="الإيميل">
            {user.email ? (
              <>
                <Row icon={<Mail size={14} strokeWidth={1.5} />} label="الإيميل الشخصي" value={user.email} dir="ltr" />
                {user.sender_email_alias && (
                  <Row icon={<Mail size={14} strokeWidth={1.5} />} label="إيميل التقديم" value={user.sender_email_alias} dir="ltr" />
                )}
              </>
            ) : (
              <div style={{ paddingTop: 8 }}>
                <p style={{ color: "#555", fontSize: 13, margin: "0 0 14px" }}>لم يتم ربط إيميل بعد</p>
                <button style={s.linkBtn} onClick={() => router.push("/portal/settings")}>
                  ربط الإيميل <ArrowRight size={14} strokeWidth={2} />
                </button>
              </div>
            )}
          </Section>
        </div>
      </div>
    </PortalShell>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "#fff" }}>
        {icon}
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ icon, label, value, dir }: { icon: React.ReactNode; label: string; value: string; dir?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1a1a1a" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555" }}>
        {icon}
        <span style={{ fontSize: 12 }}>{label}</span>
      </div>
      <span style={{ color: "#fff", fontSize: 13, fontWeight: 500, direction: dir as any }}>{value || "—"}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 800, margin: "0 auto" },
  hero: {
    display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
    background: "#111", border: "1px solid #1f1f1f",
    borderRadius: 18, padding: "24px 22px", marginBottom: 24,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 16, background: "#fff",
    color: "#0a0a0a", fontSize: 26, fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  name: { color: "#fff", fontSize: 22, fontWeight: 700, margin: "0 0 6px" },
  meta: { display: "flex", alignItems: "center", gap: 16 },
  metaItem: { color: "#666", fontSize: 13, display: "flex", alignItems: "center", gap: 5 },
  subBadge: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 16px", borderRadius: 24, border: "1px solid",
    fontSize: 13, fontWeight: 600,
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14 },
  linkBtn: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#fff", color: "#0a0a0a",
    border: "none", borderRadius: 10, padding: "10px 18px",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
};
