"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";

interface Settings {
  email: string;
  sender_email_alias: string;
  template_type: string;
  application_language: string;
  job_preferences_count: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  async function loadSettings() {
    try {
      const res = await portalFetch("/settings");
      if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
      const d = await res.json();
      setSettings(d);
      setEmailInput(d.email || "");
    } catch {
      clearToken(); router.replace("/portal/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSettings(); }, []);

  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await portalFetch("/settings/email", {
        method: "POST",
        body: JSON.stringify({ email: emailInput }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "خطأ", type: "err" }); return; }
      setMsg({ text: d.sender_alias ? `✓ تم الربط! إيميل التقديم: ${d.sender_alias}` : "✓ تم حفظ الإيميل", type: "ok" });
      await loadSettings();
    } catch {
      setMsg({ text: "خطأ في الاتصال", type: "err" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell>
      <div style={s.container}>
        <h1 style={s.title}>⚙️ الإعدادات</h1>

        {loading ? (
          <p style={s.loading}>جاري التحميل…</p>
        ) : (
          <>
            {msg && (
              <div style={{
                ...s.msg,
                background: msg.type === "ok" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                color: msg.type === "ok" ? "#34d399" : "#f87171",
                border: `1px solid ${msg.type === "ok" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
              }}>
                {msg.text}
              </div>
            )}

            {/* ربط الإيميل */}
            <div style={s.card}>
              <h2 style={s.cardTitle}>📧 ربط الإيميل</h2>
              <p style={s.cardDesc}>
                اربط إيميل Gmail الخاص بك لتقديم على الوظائف باسمك تلقائياً.
              </p>

              {settings?.sender_email_alias && (
                <div style={s.aliasBadge}>
                  <span style={{ fontSize: 18 }}>✅</span>
                  <div>
                    <p style={s.aliasLabel}>إيميل التقديم الخاص بك</p>
                    <p style={s.aliasValue} dir="ltr">{settings.sender_email_alias}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveEmail}>
                <label style={s.fieldLabel}>إيميل Gmail الشخصي</label>
                <input
                  style={s.input}
                  type="email"
                  dir="ltr"
                  placeholder="example@gmail.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
                <button
                  style={s.btn}
                  type="submit"
                  disabled={saving || !emailInput.trim()}
                >
                  {saving ? "جاري الحفظ…" : settings?.email ? "تحديث الإيميل" : "ربط الإيميل"}
                </button>
              </form>

              <div style={s.infoBox}>
                <p style={s.infoTitle}>💡 ملاحظة</p>
                <p style={s.infoText}>
                  بعد ربط الإيميل، يُنشئ النظام تلقائياً عنوان إرسال خاص بك (alias) يُستخدم لإرسال طلبات التوظيف باسمك دون الكشف عن إيميلك الشخصي.
                </p>
              </div>
            </div>

            {/* إحصائيات */}
            <div style={s.card}>
              <h2 style={s.cardTitle}>📊 معلومات الحساب</h2>
              <InfoRow label="الإيميل الشخصي" value={settings?.email || "غير مربوط"} dir={settings?.email ? "ltr" : undefined} />
              <InfoRow label="إيميل التقديم" value={settings?.sender_email_alias || "—"} dir={settings?.sender_email_alias ? "ltr" : undefined} />
              <InfoRow label="لغة التقديم" value={settings?.application_language === "en" ? "English" : "العربية"} />
              <InfoRow label="مجالات الوظائف" value={`${settings?.job_preferences_count || 0} مجال`} />
            </div>

            {/* روابط سريعة */}
            <div style={s.card}>
              <h2 style={s.cardTitle}>🔗 روابط سريعة</h2>
              <div style={s.quickLinks}>
                <QuickLink icon="📎" label="رفع السيرة الذاتية" onClick={() => router.push("/portal/cv")} />
                <QuickLink icon="👤" label="بياناتي" onClick={() => router.push("/portal/profile")} />
                <QuickLink icon="📋" label="التقديمات" onClick={() => router.push("/portal/applications")} />
              </div>
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}

function InfoRow({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1a2d52" }}>
      <span style={{ color: "#7a9cc5", fontSize: 13 }}>{label}</span>
      <span style={{ color: "#e8f0ff", fontSize: 13, fontWeight: 500, direction: dir as any }}>{value || "—"}</span>
    </div>
  );
}

function QuickLink({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button style={{
      display: "flex", alignItems: "center", gap: 10,
      width: "100%", padding: "12px 0", background: "transparent",
      border: "none", color: "#4f8ef7", fontSize: 14, cursor: "pointer", textAlign: "right",
    }} onClick={onClick}>
      <span>{icon}</span><span>{label}</span><span style={{ marginRight: "auto" }}>←</span>
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 600, margin: "0 auto" },
  title: { color: "#e8f0ff", fontSize: 22, fontWeight: 700, marginBottom: 24 },
  loading: { color: "#7a9cc5", textAlign: "center", padding: 60 },
  msg: { padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 14 },
  card: { background: "#0d1628", border: "1px solid #1a2d52", borderRadius: 16, padding: "22px 24px", marginBottom: 20 },
  cardTitle: { color: "#c0d4f0", fontSize: 15, fontWeight: 600, margin: "0 0 8px" },
  cardDesc: { color: "#7a9cc5", fontSize: 13, margin: "0 0 20px", lineHeight: 1.6 },
  aliasBadge: {
    display: "flex", alignItems: "center", gap: 12,
    background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)",
    borderRadius: 10, padding: "12px 16px", marginBottom: 20,
  },
  aliasLabel: { color: "#7a9cc5", fontSize: 12, margin: 0 },
  aliasValue: { color: "#34d399", fontSize: 14, fontWeight: 600, margin: "2px 0 0" },
  fieldLabel: { color: "#8aa8cc", fontSize: 13, display: "block", marginBottom: 8 },
  input: {
    width: "100%", padding: "12px 14px",
    background: "#111e38", border: "1px solid #1a2d52",
    borderRadius: 10, color: "#e8f0ff", fontSize: 14,
    outline: "none", boxSizing: "border-box", marginBottom: 12,
  },
  btn: {
    width: "100%", padding: "12px",
    background: "#4f8ef7", color: "#fff",
    border: "none", borderRadius: 10, fontSize: 14,
    fontWeight: 600, cursor: "pointer",
  },
  infoBox: { background: "rgba(79,142,247,0.06)", border: "1px solid rgba(79,142,247,0.15)", borderRadius: 10, padding: "12px 16px", marginTop: 16 },
  infoTitle: { color: "#4f8ef7", fontSize: 13, fontWeight: 600, margin: "0 0 4px" },
  infoText: { color: "#7a9cc5", fontSize: 12, margin: 0, lineHeight: 1.6 },
  quickLinks: { display: "flex", flexDirection: "column" },
};
