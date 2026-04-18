"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";
import {
  Mail, CheckCircle, XCircle, Globe, Languages,
  FileText, User, ClipboardList, ArrowRight, Shield,
  LogOut, Trash2, AlertTriangle, Loader2, X, Lock,
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
  const [savingLang, setSavingLang] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  async function changeLanguage(lang: "ar" | "en") {
    if (settings?.application_language === lang) return;
    setSavingLang(true); setMsg(null);
    try {
      const res = await portalFetch("/settings", {
        method: "POST",
        body: JSON.stringify({ application_language: lang }),
      });
      if (res.ok) {
        setMsg({ text: `تم تغيير لغة التقديم إلى ${lang === "ar" ? "العربية" : "English"}`, type: "ok" });
        await loadSettings();
      } else {
        const d = await res.json();
        setMsg({ text: d.error || "فشل التغيير", type: "err" });
      }
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSavingLang(false); }
  }

  function handleLogout() {
    if (!confirm("تأكيد تسجيل الخروج؟")) return;
    clearToken();
    router.replace("/portal/login");
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "حذف") return;
    setDeleting(true);
    try {
      const res = await portalFetch("/account", { method: "DELETE" });
      const d = await res.json();
      if (res.ok && d.ok) {
        clearToken();
        alert("تم حذف حسابك بنجاح");
        router.replace("/portal/login");
      } else {
        alert(d.error || "فشل حذف الحساب");
        setDeleting(false);
      }
    } catch {
      alert("خطأ في الاتصال");
      setDeleting(false);
    }
  }

  return (
    <PortalShell>
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerIcon}><Mail size={22} strokeWidth={1.5} color="#fff" /></div>
          <div>
            <h1 style={s.title}>الإعدادات</h1>
            <p style={s.sub}>أدر حسابك وتفضيلاتك</p>
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

            {/* Email */}
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
                    type="email" dir="ltr"
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

            {/* Language */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardHeaderIcon}><Languages size={18} strokeWidth={1.5} color="#fff" /></div>
                <div>
                  <p style={s.cardTitle}>لغة التقديم</p>
                  <p style={s.cardSub}>اللغة التي ستُرسل بها طلبات التوظيف</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <LangBtn
                  active={settings?.application_language !== "en"}
                  onClick={() => changeLanguage("ar")}
                  disabled={savingLang}
                  label="العربية"
                  sub="رسائل بالعربي"
                />
                <LangBtn
                  active={settings?.application_language === "en"}
                  onClick={() => changeLanguage("en")}
                  disabled={savingLang}
                  label="English"
                  sub="Messages in English"
                />
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

            {/* Security note (no password) */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardHeaderIcon}><Lock size={18} strokeWidth={1.5} color="#fff" /></div>
                <div>
                  <p style={s.cardTitle}>الأمان</p>
                  <p style={s.cardSub}>تسجيل الدخول عبر إيميلك</p>
                </div>
              </div>
              <p style={{ color: "#888", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                نظامنا لا يستخدم كلمات سر. تسجيل الدخول يتم بإيميلك المربوط مباشرة، فلا حاجة لتذكر أي كلمة سر أو تغييرها.
              </p>
            </div>

            {/* Danger zone */}
            <div style={{ ...s.card, borderColor: "#ef444433" }}>
              <div style={s.cardHeader}>
                <div style={{ ...s.cardHeaderIcon, background: "#1f0a0a" }}><AlertTriangle size={18} strokeWidth={1.5} color="#f87171" /></div>
                <div>
                  <p style={{ ...s.cardTitle, color: "#f87171" }}>منطقة الخطر</p>
                  <p style={s.cardSub}>إجراءات لا يمكن التراجع عنها</p>
                </div>
              </div>

              <button onClick={handleLogout} style={s.dangerBtnSoft}>
                <LogOut size={16} strokeWidth={1.5} />
                تسجيل الخروج
              </button>

              <button onClick={() => setShowDelete(true)} style={s.dangerBtn}>
                <Trash2 size={16} strokeWidth={1.5} />
                حذف الحساب نهائياً
              </button>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDelete && (
        <div onClick={() => !deleting && setShowDelete(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#0d0d0d", border: "1px solid #ef444444", borderRadius: 16,
            padding: 24, width: "100%", maxWidth: 440,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: "#f87171", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={18} /> حذف الحساب
              </h2>
              <button onClick={() => setShowDelete(false)} disabled={deleting} style={{ background: "none", border: "none", color: "#666", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid #ef444433",
              borderRadius: 10, padding: 14, marginBottom: 16,
            }}>
              <p style={{ margin: 0, color: "#fca5a5", fontSize: 13, lineHeight: 1.7 }}>
                سيتم حذف كل بياناتك نهائياً وبدون رجعة:
              </p>
              <ul style={{ margin: "8px 0 0", paddingInlineStart: 18, color: "#fca5a5", fontSize: 12, lineHeight: 1.8 }}>
                <li>السيرة الذاتية والتفضيلات</li>
                <li>سجل التقديمات والاشتراك</li>
                <li>برنامج الربح والعمولات المتراكمة</li>
                <li>محادثات الدعم</li>
              </ul>
            </div>

            <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 8px" }}>
              للتأكيد، اكتب كلمة <strong style={{ color: "#f87171" }}>حذف</strong> في الحقل التالي:
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="حذف"
              disabled={deleting}
              style={{
                width: "100%", background: "#070707", border: "1px solid #1f1f1f",
                borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14,
                outline: "none", boxSizing: "border-box", marginBottom: 14,
              }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDelete(false)} disabled={deleting} style={{
                flex: 1, background: "#1a1a1a", color: "#fff", border: "1px solid #2a2a2a",
                borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 600,
                cursor: "pointer", opacity: deleting ? 0.5 : 1,
              }}>إلغاء</button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== "حذف"}
                style={{
                  flex: 1, background: deleteConfirm === "حذف" ? "#ef4444" : "#1a1a1a",
                  color: deleteConfirm === "حذف" ? "#fff" : "#666",
                  border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700,
                  cursor: deleteConfirm === "حذف" ? "pointer" : "not-allowed",
                  opacity: deleting ? 0.6 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? "جاري الحذف..." : "حذف نهائي"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

function LangBtn({ active, onClick, disabled, label, sub }: { active: boolean; onClick: () => void; disabled: boolean; label: string; sub: string }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: active ? "#0a1f0a" : "#141414",
      border: `1px solid ${active ? "#22c55e" : "#2a2a2a"}`,
      borderRadius: 12, padding: "12px 14px", cursor: disabled ? "wait" : "pointer",
      textAlign: "right", opacity: disabled ? 0.6 : 1,
    }}>
      <p style={{ margin: 0, color: active ? "#22c55e" : "#fff", fontSize: 14, fontWeight: 700 }}>
        {label} {active && <CheckCircle size={13} style={{ verticalAlign: "middle", marginInlineStart: 4 }} />}
      </p>
      <p style={{ margin: "3px 0 0", color: "#666", fontSize: 11 }}>{sub}</p>
    </button>
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
  dangerBtnSoft: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", padding: "12px", background: "#1a1a1a", color: "#ccc",
    border: "1px solid #2a2a2a", borderRadius: 10, fontSize: 14, fontWeight: 600,
    cursor: "pointer", marginBottom: 10,
  },
  dangerBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", padding: "12px", background: "#1f0a0a", color: "#f87171",
    border: "1px solid #ef444433", borderRadius: 10, fontSize: 14, fontWeight: 600,
    cursor: "pointer",
  },
};
