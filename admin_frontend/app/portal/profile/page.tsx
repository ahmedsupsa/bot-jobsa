"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";

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
      .then(async (res) => {
        if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
        setUser(await res.json());
      })
      .catch(() => { clearToken(); router.replace("/portal/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <PortalShell><p style={{ color: "#8b5cf6", padding: 60, textAlign: "center" }}>⏳ جاري التحميل…</p></PortalShell>;
  if (!user) return null;

  const active = user.subscription_active;
  const endDate = user.subscription_ends_at
    ? new Date(user.subscription_ends_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  return (
    <PortalShell>
      <div style={s.page}>
        {/* Profile hero */}
        <div style={s.hero}>
          <div style={s.avatar}>{user.full_name.charAt(0)}</div>
          <div>
            <h1 style={s.name}>{user.full_name}</h1>
            <p style={s.heroSub}>📍 {user.city}{user.age ? ` · ${user.age} سنة` : ""}</p>
          </div>
          <div style={{
            ...s.subBadge,
            background: active ? "#ecfdf5" : "#fef2f2",
            color: active ? "#059669" : "#dc2626",
            border: `1.5px solid ${active ? "#6ee7b7" : "#fca5a5"}`,
          }}>
            {active ? `✅ نشط · ${user.days_left} يوم` : "❌ منتهي"}
          </div>
        </div>

        <div style={s.grid}>
          {/* Personal info */}
          <div style={s.card}>
            <div style={s.cardIcon}>👤</div>
            <h2 style={s.cardTitle}>البيانات الشخصية</h2>
            <InfoRow label="الاسم الكامل" value={user.full_name} />
            <InfoRow label="رقم الجوال" value={user.phone} dir="ltr" />
            {user.age && <InfoRow label="العمر" value={`${user.age} سنة`} />}
            <InfoRow label="المدينة" value={user.city} />
          </div>

          {/* Subscription */}
          <div style={s.card}>
            <div style={{ ...s.cardIcon, background: active ? "#ecfdf5" : "#fef2f2" }}>📊</div>
            <h2 style={s.cardTitle}>الاشتراك</h2>
            <InfoRow label="نوع الاشتراك" value="شهري" />
            <InfoRow label="تاريخ الانتهاء" value={endDate} />
            <InfoRow label="الأيام المتبقية" value={`${user.days_left} يوم`} />
            <InfoRow label="التقديمات المرسلة" value={`${user.applications_count} تقديم`} />
          </div>

          {/* Email */}
          <div style={s.card}>
            <div style={s.cardIcon}>📧</div>
            <h2 style={s.cardTitle}>إعدادات الإيميل</h2>
            {user.email ? (
              <>
                <InfoRow label="الإيميل الشخصي" value={user.email} dir="ltr" />
                {user.sender_email_alias && <InfoRow label="إيميل التقديم" value={user.sender_email_alias} dir="ltr" />}
              </>
            ) : (
              <div style={s.noEmail}>
                <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 14px" }}>لم يتم ربط إيميل بعد</p>
                <button style={s.linkBtn} onClick={() => router.push("/portal/settings")}>
                  ربط الإيميل ←
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

function InfoRow({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ color: "#9ca3af", fontSize: 12 }}>{label}</span>
      <span style={{ color: "#1e1b4b", fontSize: 13, fontWeight: 600, direction: dir as any }}>{value || "—"}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 800, margin: "0 auto" },
  hero: {
    display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    borderRadius: 20, padding: "28px 32px", marginBottom: 28,
  },
  avatar: {
    width: 68, height: 68, borderRadius: "50%",
    background: "rgba(255,255,255,0.25)", color: "#fff",
    fontSize: 28, fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, border: "3px solid rgba(255,255,255,0.4)",
  },
  name: { color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 },
  heroSub: { color: "rgba(255,255,255,0.8)", fontSize: 14, margin: "4px 0 0" },
  subBadge: { padding: "8px 18px", borderRadius: 24, fontSize: 12, fontWeight: 700, marginRight: "auto" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 },
  card: {
    background: "#fff", borderRadius: 18, padding: "24px",
    boxShadow: "0 2px 16px rgba(99,102,241,0.07)", border: "1px solid #ede9fe",
  },
  cardIcon: {
    width: 42, height: 42, borderRadius: 12, background: "#f5f3ff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, marginBottom: 12,
  },
  cardTitle: { color: "#1e1b4b", fontSize: 15, fontWeight: 700, margin: "0 0 12px" },
  noEmail: { textAlign: "center", paddingTop: 8 },
  linkBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff",
    border: "none", borderRadius: 10, padding: "10px 20px",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
};
