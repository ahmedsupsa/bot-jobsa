"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";

interface UserData {
  full_name: string;
  phone: string;
  age: number | null;
  city: string;
  subscription_active: boolean;
  days_left: number;
  subscription_ends_at: string;
  applications_count: number;
  email: string;
  sender_email_alias: string;
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

  if (loading) return <PortalShell><p style={loadStyle}>جاري التحميل…</p></PortalShell>;
  if (!user) return null;

  const subActive = user.subscription_active;
  const endDate = user.subscription_ends_at
    ? new Date(user.subscription_ends_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  return (
    <PortalShell>
      <div style={s.container}>
        <h1 style={s.title}>👤 حسابي</h1>

        {/* Avatar */}
        <div style={s.avatarCard}>
          <div style={s.avatar}>{user.full_name.charAt(0)}</div>
          <div>
            <p style={s.name}>{user.full_name}</p>
            <p style={s.city}>{user.city}</p>
          </div>
        </div>

        {/* Info */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>📄 البيانات الشخصية</h2>
          <InfoRow label="الاسم الكامل" value={user.full_name} />
          <InfoRow label="رقم الجوال" value={user.phone} dir="ltr" />
          {user.age && <InfoRow label="العمر" value={`${user.age} سنة`} />}
          <InfoRow label="المدينة" value={user.city} />
        </div>

        {/* Subscription */}
        <div style={{ ...s.card, borderColor: subActive ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)" }}>
          <h2 style={s.cardTitle}>📊 الاشتراك</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{
              padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600,
              background: subActive ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
              color: subActive ? "#34d399" : "#f87171",
            }}>
              {subActive ? "✓ نشط" : "✗ منتهي"}
            </div>
          </div>
          <InfoRow label="نوع الاشتراك" value="اشتراك شهري" />
          <InfoRow label="تاريخ الانتهاء" value={endDate} />
          <InfoRow label="الأيام المتبقية" value={`${user.days_left} يوم`} />
          <InfoRow label="التقديمات المرسلة" value={`${user.applications_count} تقديم`} />
        </div>

        {/* Email */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>📧 الإيميل</h2>
          {user.email ? (
            <>
              <InfoRow label="إيميلك الشخصي" value={user.email} dir="ltr" />
              {user.sender_email_alias && (
                <InfoRow label="إيميل التقديم" value={user.sender_email_alias} dir="ltr" />
              )}
            </>
          ) : (
            <div style={s.noEmail}>
              <p style={{ color: "#f87171", margin: 0 }}>لم يتم ربط الإيميل بعد</p>
              <button style={s.linkBtn} onClick={() => router.push("/portal/settings")}>
                ربط الإيميل ←
              </button>
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}

function InfoRow({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1a2d52" }}>
      <span style={{ color: "#7a9cc5", fontSize: 13 }}>{label}</span>
      <span style={{ color: "#e8f0ff", fontSize: 14, fontWeight: 500, direction: dir as any }}>{value || "—"}</span>
    </div>
  );
}

const loadStyle: React.CSSProperties = { color: "#7a9cc5", textAlign: "center", padding: 60 };

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 600, margin: "0 auto" },
  title: { color: "#e8f0ff", fontSize: 22, fontWeight: 700, marginBottom: 24 },
  avatarCard: {
    display: "flex", alignItems: "center", gap: 16,
    background: "linear-gradient(135deg, #111e38, #0d1628)",
    border: "1px solid #1a2d52", borderRadius: 16, padding: "20px 24px", marginBottom: 20,
  },
  avatar: {
    width: 56, height: 56, borderRadius: "50%", background: "#4f8ef7",
    color: "#fff", fontSize: 24, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  name: { color: "#e8f0ff", fontSize: 18, fontWeight: 600, margin: 0 },
  city: { color: "#7a9cc5", fontSize: 13, margin: "4px 0 0" },
  card: { background: "#0d1628", border: "1px solid #1a2d52", borderRadius: 16, padding: "20px 24px", marginBottom: 16 },
  cardTitle: { color: "#c0d4f0", fontSize: 15, fontWeight: 600, margin: "0 0 8px" },
  noEmail: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  linkBtn: { background: "#4f8ef7", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" },
};
