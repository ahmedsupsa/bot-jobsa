"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";

interface Settings {
  email: string; sender_email_alias: string;
  template_type: string; application_language: string;
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
    setSaving(true); setMsg(null);
    try {
      const res = await portalFetch("/settings/email", {
        method: "POST",
        body: JSON.stringify({ email: emailInput }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "خطأ", type: "err" }); return; }
      setMsg({ text: d.sender_alias ? `تم الربط! إيميل التقديم: ${d.sender_alias}` : "تم حفظ الإيميل", type: "ok" });
      await loadSettings();
    } catch {
      setMsg({ text: "خطأ في الاتصال", type: "err" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell>
      <div style={s.page}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>الإعدادات</h1>
            <p style={s.sub}>إعداد إيميلك لتفعيل التقديم التلقائي</p>
          </div>
          <div style={s.headerIcon}>⚙️</div>
        </div>

        {loading ? (
          <p style={{ color: "#8b5cf6", padding: 40, textAlign: "center" }}>⏳ جاري التحميل…</p>
        ) : (
          <>
            {msg && (
              <div style={{
                ...s.msgBox,
                background: msg.type === "ok" ? "#ecfdf5" : "#fef2f2",
                color: msg.type === "ok" ? "#059669" : "#dc2626",
                border: `1.5px solid ${msg.type === "ok" ? "#6ee7b7" : "#fca5a5"}`,
              }}>
                {msg.type === "ok" ? "✅" : "❌"} {msg.text}
              </div>
            )}

            {/* Email setup */}
            <div style={s.card}>
              <div style={s.cardTop}>
                <div style={s.cardIconWrap}>📧</div>
                <div>
                  <h2 style={s.cardTitle}>ربط إيميل Gmail</h2>
                  <p style={s.cardSub}>مطلوب لإرسال طلبات التوظيف باسمك</p>
                </div>
              </div>

              {settings?.sender_email_alias && (
                <div style={s.aliasBadge}>
                  <span style={{ fontSize: 20 }}>🎉</span>
                  <div>
                    <p style={s.aliasLabel}>إيميل التقديم الخاص بك</p>
                    <p style={s.aliasValue} dir="ltr">{settings.sender_email_alias}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveEmail}>
                <label style={s.fieldLabel}>إيميل Gmail الشخصي</label>
                <div style={s.inputWrap}>
                  <input
                    style={s.input}
                    type="email"
                    dir="ltr"
                    placeholder="example@gmail.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                  />
                </div>
                <button style={s.btn} type="submit" disabled={saving || !emailInput.trim()}>
                  {saving ? "جاري الحفظ…" : settings?.email ? "تحديث الإيميل ✓" : "ربط الإيميل ←"}
                </button>
              </form>

              <div style={s.note}>
                <span style={{ fontSize: 16 }}>💡</span>
                <p style={s.noteText}>
                  سيُنشئ النظام عنوان إرسال خاص بك يُستخدم لإرسال الطلبات دون الكشف عن إيميلك الشخصي.
                </p>
              </div>
            </div>

            {/* Account info */}
            <div style={s.card}>
              <div style={s.cardTop}>
                <div style={s.cardIconWrap}>📊</div>
                <div>
                  <h2 style={s.cardTitle}>معلومات الحساب</h2>
                </div>
              </div>
              <div style={s.infoList}>
                <InfoRow label="الإيميل المربوط" value={settings?.email || "—"} dir={settings?.email ? "ltr" : undefined} />
                <InfoRow label="إيميل التقديم" value={settings?.sender_email_alias || "—"} dir={settings?.sender_email_alias ? "ltr" : undefined} />
                <InfoRow label="لغة التقديم" value={settings?.application_language === "en" ? "English" : "العربية"} />
                <InfoRow label="مجالات الوظائف" value={`${settings?.job_preferences_count || 0} مجال`} />
              </div>
            </div>

            {/* Quick nav */}
            <div style={s.quickNav}>
              {[
                { icon: "📎", label: "السيرة الذاتية", href: "/portal/cv" },
                { icon: "👤", label: "حسابي", href: "/portal/profile" },
                { icon: "📋", label: "التقديمات", href: "/portal/applications" },
              ].map(({ icon, label, href }) => (
                <button key={href} style={s.quickNavBtn} onClick={() => router.push(href)}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <span style={{ marginRight: "auto", color: "#9ca3af" }}>←</span>
                </button>
              ))}
            </div>
          </>
        )}
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
  page: { maxWidth: 640, margin: "0 auto" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    borderRadius: 20, padding: "24px 28px", marginBottom: 24,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 },
  sub: { color: "rgba(255,255,255,0.8)", fontSize: 13, margin: "4px 0 0" },
  headerIcon: { fontSize: 44 },
  msgBox: { padding: "14px 18px", borderRadius: 12, marginBottom: 18, fontSize: 14, fontWeight: 500 },
  card: {
    background: "#fff", borderRadius: 20, padding: "24px",
    boxShadow: "0 2px 20px rgba(99,102,241,0.08)", border: "1px solid #ede9fe", marginBottom: 20,
  },
  cardTop: { display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 },
  cardIconWrap: {
    width: 48, height: 48, borderRadius: 14, background: "#f5f3ff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 22, flexShrink: 0,
  },
  cardTitle: { color: "#1e1b4b", fontSize: 16, fontWeight: 700, margin: 0 },
  cardSub: { color: "#9ca3af", fontSize: 12, margin: "4px 0 0" },
  aliasBadge: {
    display: "flex", alignItems: "center", gap: 14,
    background: "#ecfdf5", border: "1.5px solid #6ee7b7",
    borderRadius: 14, padding: "14px 18px", marginBottom: 20,
  },
  aliasLabel: { color: "#059669", fontSize: 11, fontWeight: 600, margin: 0 },
  aliasValue: { color: "#065f46", fontSize: 14, fontWeight: 700, margin: "2px 0 0" },
  fieldLabel: { display: "block", color: "#4c1d95", fontSize: 13, fontWeight: 600, marginBottom: 8 },
  inputWrap: { marginBottom: 16 },
  input: {
    width: "100%", padding: "13px 16px",
    border: "2px solid #ede9fe", borderRadius: 12,
    fontSize: 14, color: "#1e1b4b", outline: "none",
    background: "#faf9ff", boxSizing: "border-box",
  },
  btn: {
    width: "100%", padding: "14px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff", border: "none", borderRadius: 12,
    fontSize: 14, fontWeight: 700, cursor: "pointer",
    boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
  },
  note: {
    display: "flex", alignItems: "flex-start", gap: 10,
    background: "#f5f3ff", borderRadius: 12, padding: "12px 16px", marginTop: 16,
  },
  noteText: { color: "#6d28d9", fontSize: 12, margin: 0, lineHeight: 1.6 },
  infoList: {},
  quickNav: { display: "flex", flexDirection: "column", gap: 10 },
  quickNavBtn: {
    display: "flex", alignItems: "center", gap: 12,
    background: "#fff", border: "1px solid #ede9fe",
    borderRadius: 14, padding: "14px 18px", cursor: "pointer",
    boxShadow: "0 1px 8px rgba(99,102,241,0.06)", color: "#1e1b4b",
    fontSize: 14, width: "100%",
  },
};
