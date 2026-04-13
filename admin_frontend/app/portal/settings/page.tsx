"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";
import {
  Mail, CheckCircle, XCircle, Globe, Languages,
  FileText, User, ClipboardList, ArrowRight, Shield,
} from "lucide-react";

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
    } catch { clearToken(); router.replace("/portal/login"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadSettings(); }, []);

  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg(null);
    try {
      const res = await portalFetch("/settings/email", { method: "POST", body: JSON.stringify({ email: emailInput }) });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "خطأ", type: "err" }); return; }
      setMsg({ text: d.sender_alias ? `تم الربط — إيميل التقديم: ${d.sender_alias}` : "تم حفظ الإيميل", type: "ok" });
      await loadSettings();
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSaving(false); }
  }

  return (
    <PortalShell>
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerIcon}><Mail size={22} strokeWidth={1.5} color="#fff" /></div>
          <div>
            <h1 style={s.title}>الإعدادات</h1>
            <p style={s.sub}>اربط إيميلك لتفعيل التقديم التلقائي</p>
          </div>
        </div>

        {loading ? <p style={{ color: "#555", padding: 40, textAlign: "center" }}>جاري التحميل…</p> : (
          <>
            {msg && (
              <div style={{
                ...s.msgBox,
                background: msg.type === "ok" ? "#0a1f0a" : "#1a0a0a",
                color: msg.type === "ok" ? "#22c55e" : "#f87171",
                border: `1px solid ${msg.type === "ok" ? "#22c55e22" : "#f8717122"}`,
              }}>
                {msg.type === "ok" ? <CheckCircle size={16} strokeWidth={1.5} /> : <XCircle size={16} strokeWidth={1.5} />}
                <span>{msg.text}</span>
              </div>
            )}

            {/* Email card */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardHeaderIcon}><Mail size={18} strokeWidth={1.5} color="#fff" /></div>
                <div>
                  <p style={s.cardTitle}>ربط إيميل Gmail</p>
                  <p style={s.cardSub}>مطلوب لإرسال طلبات التوظيف باسمك</p>
                </div>
              </div>

              {settings?.sender_email_alias && (
                <div style={s.aliasBanner}>
                  <CheckCircle size={18} strokeWidth={1.5} color="#22c55e" />
                  <div>
                    <p style={s.aliasLabel}>إيميل التقديم الخاص بك</p>
                    <p style={s.aliasValue} dir="ltr">{settings.sender_email_alias}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveEmail}>
                <label style={s.label}>إيميل Gmail</label>
                <div style={s.inputRow}>
                  <Mail size={16} strokeWidth={1.5} color="#444" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" } as any} />
                  <input
                    style={s.input}
                    type="email"
                    dir="ltr"
                    placeholder="example@gmail.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                  />
                </div>
                <button style={s.btn} type="submit" disabled={saving || !emailInput.trim()}>
                  {saving ? "جاري الحفظ…" : settings?.email ? "تحديث الإيميل" : "ربط الإيميل"}
                </button>
              </form>

              <div style={s.noteRow}>
                <Shield size={14} strokeWidth={1.5} color="#555" style={{ flexShrink: 0 }} />
                <p style={s.noteText}>نُنشئ عنوان إرسال خاص بك — إيميلك الشخصي لن يظهر للشركات.</p>
              </div>
            </div>

            {/* Account info */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardHeaderIcon}><Globe size={18} strokeWidth={1.5} color="#fff" /></div>
                <div>
                  <p style={s.cardTitle}>معلومات الحساب</p>
                </div>
              </div>
              <InfoRow icon={<Mail size={14} strokeWidth={1.5} />} label="الإيميل المربوط" value={settings?.email || "—"} dir={settings?.email ? "ltr" : undefined} />
              <InfoRow icon={<Mail size={14} strokeWidth={1.5} />} label="إيميل التقديم" value={settings?.sender_email_alias || "—"} dir={settings?.sender_email_alias ? "ltr" : undefined} />
              <InfoRow icon={<Languages size={14} strokeWidth={1.5} />} label="لغة التقديم" value={settings?.application_language === "en" ? "English" : "العربية"} />
            </div>

            {/* Quick nav */}
            <div style={s.card}>
              {[
                { icon: <FileText size={16} strokeWidth={1.5} />, label: "السيرة الذاتية", href: "/portal/cv" },
                { icon: <User size={16} strokeWidth={1.5} />, label: "حسابي", href: "/portal/profile" },
                { icon: <ClipboardList size={16} strokeWidth={1.5} />, label: "التقديمات", href: "/portal/applications" },
              ].map(({ icon, label, href }) => (
                <button key={href} style={s.navBtn} onClick={() => router.push(href)}>
                  <div style={s.navBtnIcon}>{icon}</div>
                  <span style={{ color: "#ccc", fontSize: 14, flex: 1, textAlign: "right" }}>{label}</span>
                  <ArrowRight size={15} strokeWidth={1.5} color="#444" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}

function InfoRow({ icon, label, value, dir }: { icon: React.ReactNode; label: string; value: string; dir?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #1a1a1a" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555" }}>
        {icon}
        <span style={{ fontSize: 12 }}>{label}</span>
      </div>
      <span style={{ color: "#fff", fontSize: 13, fontWeight: 500, direction: dir as any }}>{value || "—"}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 620, margin: "0 auto" },
  header: {
    display: "flex", alignItems: "center", gap: 16,
    background: "#111", border: "1px solid #1f1f1f",
    borderRadius: 18, padding: "24px 28px", marginBottom: 24,
  },
  headerIcon: {
    width: 52, height: 52, borderRadius: 14, background: "#1a1a1a",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 },
  sub: { color: "#666", fontSize: 13, margin: "4px 0 0" },
  msgBox: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "13px 16px", borderRadius: 12, marginBottom: 16, fontSize: 13, fontWeight: 500,
  },
  card: { background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "22px", marginBottom: 16 },
  cardHeader: { display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 },
  cardHeaderIcon: {
    width: 44, height: 44, borderRadius: 12, background: "#1a1a1a",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: 600, margin: 0 },
  cardSub: { color: "#666", fontSize: 12, margin: "3px 0 0" },
  aliasBanner: {
    display: "flex", alignItems: "center", gap: 12,
    background: "#0a1f0a", border: "1px solid #22c55e22",
    borderRadius: 12, padding: "14px 16px", marginBottom: 18,
  },
  aliasLabel: { color: "#22c55e", fontSize: 11, fontWeight: 600, margin: 0 },
  aliasValue: { color: "#4ade80", fontSize: 13, fontWeight: 700, margin: "3px 0 0" },
  label: { display: "block", color: "#888", fontSize: 13, fontWeight: 500, marginBottom: 8 },
  inputRow: { position: "relative", marginBottom: 14 },
  input: {
    width: "100%", padding: "13px 42px 13px 16px",
    background: "#141414", border: "1px solid #2a2a2a",
    borderRadius: 12, color: "#fff", fontSize: 14, outline: "none",
    boxSizing: "border-box",
  },
  btn: {
    width: "100%", padding: "13px",
    background: "#fff", color: "#0a0a0a",
    border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
  noteRow: { display: "flex", alignItems: "flex-start", gap: 8, marginTop: 14 },
  noteText: { color: "#555", fontSize: 12, margin: 0, lineHeight: 1.6 },
  navBtn: {
    display: "flex", alignItems: "center", gap: 12,
    width: "100%", padding: "13px 0", background: "transparent",
    border: "none", borderBottom: "1px solid #1a1a1a", cursor: "pointer",
  },
  navBtnIcon: { width: 32, height: 32, borderRadius: 8, background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 },
};
