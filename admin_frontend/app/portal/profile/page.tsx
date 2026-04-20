"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useTheme } from "@/contexts/theme-context";
import { portalFetch, clearToken } from "@/lib/portal-auth";
import {
  User, Phone, MapPin, Calendar, Mail, CreditCard, Send,
  Shield, Languages, CheckCircle, XCircle, AlertTriangle,
  LogOut, Trash2, Loader2, X, Lock, MessageCircle,
} from "lucide-react";

interface UserData {
  full_name: string; phone: string; age: number | null; city: string;
  subscription_active: boolean; days_left: number; subscription_ends_at: string;
  applications_count: number; email: string; sender_email_alias: string;
  application_language: string; template_type: string;
}

type Tab = "profile" | "settings";

export default function AccountPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [tab, setTab] = useState<Tab>("profile");
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingLang, setSavingLang] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const t = {
    bg:      dark ? "#0a0a0a" : "#f4f4f5",
    surface: dark ? "#111"    : "#fff",
    border:  dark ? "#1f1f1f" : "#e4e4e7",
    border2: dark ? "#2a2a2a" : "#d4d4d8",
    text:    dark ? "#fff"    : "#09090b",
    text2:   dark ? "#aaa"    : "#71717a",
    text3:   dark ? "#666"    : "#a1a1aa",
    iconBg:  dark ? "#1a1a1a" : "#f4f4f5",
    input:   dark ? "#141414" : "#fff",
    divider: dark ? "#1a1a1a" : "#f0f0f0",
  };

  async function load() {
    try {
      const [meRes, setRes] = await Promise.all([
        portalFetch("/me"),
        portalFetch("/settings"),
      ]);
      if (meRes.status === 401) { clearToken(); router.replace("/portal/login"); return; }
      const me = await meRes.json();
      const settings = await setRes.json();
      setUser({ ...me, application_language: settings.application_language || "ar", template_type: settings.template_type || "classic" });
      setEmailInput(me.email || "");
    } catch { clearToken(); router.replace("/portal/login"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg(null);
    try {
      const res = await portalFetch("/settings/email", { method: "POST", body: JSON.stringify({ email: emailInput }) });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "خطأ", type: "err" }); return; }
      setMsg({ text: d.sender_alias ? `تم الربط — إيميل التقديم: ${d.sender_alias}` : "تم حفظ الإيميل", type: "ok" });
      await load();
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSaving(false); }
  }

  async function changeLanguage(lang: "ar" | "en") {
    if (user?.application_language === lang) return;
    setSavingLang(true); setMsg(null);
    try {
      const res = await portalFetch("/settings", { method: "POST", body: JSON.stringify({ application_language: lang }) });
      if (res.ok) { setMsg({ text: `تم تغيير لغة التقديم إلى ${lang === "ar" ? "العربية" : "English"}`, type: "ok" }); await load(); }
      else { const d = await res.json(); setMsg({ text: d.error || "فشل التغيير", type: "err" }); }
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSavingLang(false); }
  }

  async function changeTemplate(tpl: string) {
    if (user?.template_type === tpl) return;
    setSavingTemplate(true); setMsg(null);
    try {
      const res = await portalFetch("/settings", { method: "POST", body: JSON.stringify({ template_type: tpl }) });
      if (res.ok) {
        const names: Record<string, string> = { classic: "الكلاسيكي", modern: "الحديث", brief: "المختصر" };
        setMsg({ text: `تم اختيار القالب ${names[tpl] || tpl}`, type: "ok" });
        await load();
      } else {
        const d = await res.json();
        setMsg({ text: d.error || "فشل الحفظ", type: "err" });
      }
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSavingTemplate(false); }
  }

  async function deleteAccount() {
    if (deleteConfirm !== "حذف") return;
    setDeleting(true);
    try {
      const res = await portalFetch("/account", { method: "DELETE" });
      const d = await res.json();
      if (res.ok && d.ok) { clearToken(); router.replace("/portal/login"); }
      else { alert(d.error || "فشل الحذف"); setDeleting(false); }
    } catch { alert("خطأ في الاتصال"); setDeleting(false); }
  }

  const active = user?.subscription_active;
  const endDate = user?.subscription_ends_at
    ? new Date(user.subscription_ends_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  return (
    <PortalShell>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header */}
        {!loading && user && (
          <div style={{
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: 20, padding: "24px 20px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
          }}>
            <div style={{
              width: 68, height: 68, borderRadius: 18,
              background: dark ? "#fff" : "#09090b",
              color: dark ? "#0a0a0a" : "#fff",
              fontSize: 28, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {user.full_name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ color: t.text, fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>{user.full_name}</h1>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span style={{ color: t.text3, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={12} strokeWidth={1.5} /> {user.city}
                </span>
                {user.age && (
                  <span style={{ color: t.text3, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={12} strokeWidth={1.5} /> {user.age} سنة
                  </span>
                )}
              </div>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 16px", borderRadius: 100,
              background: active ? (dark ? "#0a1f0a" : "#f0fdf4") : (dark ? "#1a0a0a" : "#fef2f2"),
              border: `1px solid ${active ? (dark ? "#2a2a2a" : "#bbf7d0") : (dark ? "#7f1d1d" : "#fecaca")}`,
              color: active ? (dark ? "#fff" : "#166534") : "#ef4444",
              fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
              {active ? `نشط · ${user.days_left} يوم` : "منتهٍ"}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 4,
          background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: 14, padding: 4, marginBottom: 20,
        }}>
          {([["profile", "حسابي", <User size={15} key="u" />], ["settings", "الإعدادات", <CreditCard size={15} key="s" />]] as const).map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => { setTab(key as Tab); setMsg(null); }}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px 0", borderRadius: 11, border: "none", cursor: "pointer",
                background: tab === key ? (dark ? "#fff" : "#09090b") : "transparent",
                color: tab === key ? (dark ? "#0a0a0a" : "#fff") : t.text3,
                fontSize: 14, fontWeight: tab === key ? 700 : 400,
                transition: "all 0.18s",
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: t.text3, textAlign: "center", padding: 60 }}>جاري التحميل…</p>
        ) : tab === "profile" ? (
          /* ── PROFILE TAB ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.2s ease" }}>
            <Card t={t} title="البيانات الشخصية" icon={<User size={17} strokeWidth={1.5} />}>
              <Row t={t} icon={<User size={13} />} label="الاسم الكامل" value={user!.full_name} />
              <Row t={t} icon={<Phone size={13} />} label="رقم الجوال" value={user!.phone} dir="ltr" />
              {user!.age && <Row t={t} icon={<Calendar size={13} />} label="العمر" value={`${user!.age} سنة`} />}
              <Row t={t} icon={<MapPin size={13} />} label="المدينة" value={user!.city} />
            </Card>

            <Card t={t} title="الاشتراك" icon={<CreditCard size={17} strokeWidth={1.5} />}>
              <Row t={t} icon={<CreditCard size={13} />} label="النوع" value="شهري" />
              <Row t={t} icon={<Calendar size={13} />} label="تاريخ الانتهاء" value={endDate} />
              <Row t={t} icon={<Calendar size={13} />} label="الأيام المتبقية" value={`${user!.days_left} يوم`} />
              <Row t={t} icon={<Send size={13} />} label="التقديمات المرسلة" value={`${user!.applications_count} تقديم`} last />
            </Card>

            <Card t={t} title="الإيميل" icon={<Mail size={17} strokeWidth={1.5} />}>
              {user!.email ? (
                <>
                  <Row t={t} icon={<Mail size={13} />} label="الإيميل الشخصي" value={user!.email} dir="ltr" />
                  {user!.sender_email_alias && (
                    <Row t={t} icon={<Mail size={13} />} label="إيميل التقديم" value={user!.sender_email_alias} dir="ltr" last />
                  )}
                </>
              ) : (
                <button onClick={() => setTab("settings")} style={{
                  display: "flex", alignItems: "center", gap: 8, background: dark ? "#fff" : "#09090b",
                  color: dark ? "#0a0a0a" : "#fff", border: "none", borderRadius: 10, padding: "10px 18px",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 4,
                }}>
                  <Mail size={14} /> ربط الإيميل
                </button>
              )}
            </Card>
          </div>
        ) : (
          /* ── SETTINGS TAB ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.2s ease" }}>
            {msg && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 16px", borderRadius: 12, fontSize: 13, fontWeight: 500,
                background: msg.type === "ok" ? (dark ? "#0a1f0a" : "#f0fdf4") : (dark ? "#1a0a0a" : "#fef2f2"),
                color: msg.type === "ok" ? (dark ? "#fff" : "#166534") : "#f87171",
                border: `1px solid ${msg.type === "ok" ? (dark ? "#2a2a2a" : "#bbf7d0") : (dark ? "#7f1d1d" : "#fecaca")}`,
              }}>
                {msg.type === "ok" ? <CheckCircle size={15} /> : <XCircle size={15} />}
                {msg.text}
              </div>
            )}

            {/* Email */}
            <Card t={t} title="ربط إيميل Gmail" icon={<Mail size={17} strokeWidth={1.5} />} sub="مطلوب لإرسال طلبات التوظيف باسمك">
              {user?.email ? (
                /* الإيميل مربوط — مقفل */
                <>
                  {user.sender_email_alias && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: dark ? "#0a1f0a" : "#f0fdf4",
                      border: `1px solid ${dark ? "#2a2a2a" : "#bbf7d0"}`, borderRadius: 12,
                      padding: "14px 16px", marginBottom: 12,
                    }}>
                      <CheckCircle size={18} strokeWidth={1.5} color={dark ? "#fff" : "#166534"} />
                      <div>
                        <p style={{ color: dark ? "#fff" : "#166534", fontSize: 11, fontWeight: 600, margin: 0 }}>إيميل التقديم الخاص بك</p>
                        <p style={{ color: dark ? "#fff" : "#14532d", fontSize: 13, fontWeight: 700, margin: "3px 0 0" }} dir="ltr">{user.sender_email_alias}</p>
                      </div>
                    </div>
                  )}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: dark ? "#14100a" : "#fffbeb",
                    border: `1px solid ${dark ? "#78350f" : "#fde68a"}`, borderRadius: 12,
                    padding: "14px 16px",
                  }}>
                    <Lock size={16} strokeWidth={1.8} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, color: dark ? "#fcd34d" : "#92400e", fontSize: 13, fontWeight: 700 }}>الإيميل مقفل</p>
                      <p style={{ margin: "3px 0 0", color: dark ? "#a78054" : "#b45309", fontSize: 12 }} dir="ltr">{user.email}</p>
                    </div>
                    <a href="/portal/support" style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "7px 13px", borderRadius: 9,
                      background: "#f59e0b", color: "#000",
                      fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0,
                    }}>
                      <MessageCircle size={12} /> تغيير
                    </a>
                  </div>
                </>
              ) : (
                /* أول مرة — يسمح بالربط */
                <>
                  <form onSubmit={saveEmail}>
                    <label style={{ display: "block", color: t.text2, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>إيميل Gmail</label>
                    <div style={{ position: "relative", marginBottom: 12 }}>
                      <Mail size={15} strokeWidth={1.5} color={t.text3} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" } as any} />
                      <input
                        type="email" dir="ltr" value={emailInput}
                        onChange={e => setEmailInput(e.target.value)}
                        placeholder="example@gmail.com"
                        style={{
                          width: "100%", padding: "13px 42px 13px 16px",
                          background: t.input, border: `1px solid ${t.border2}`,
                          borderRadius: 12, color: t.text, fontSize: 16, outline: "none",
                          boxSizing: "border-box", WebkitAppearance: "none",
                        }}
                      />
                    </div>
                    <button style={{
                      width: "100%", padding: "13px", background: dark ? "#fff" : "#09090b",
                      color: dark ? "#0a0a0a" : "#fff", border: "none", borderRadius: 12,
                      fontSize: 14, fontWeight: 700, cursor: "pointer",
                    }} type="submit" disabled={saving || !emailInput.trim()}>
                      {saving ? "جاري الحفظ…" : "ربط الإيميل"}
                    </button>
                  </form>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12 }}>
                    <Shield size={13} strokeWidth={1.5} color={t.text3} style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: t.text3, fontSize: 12, margin: 0, lineHeight: 1.6 }}>نُنشئ عنوان إرسال خاص بك — إيميلك الشخصي لن يظهر للشركات.</p>
                  </div>
                </>
              )}
            </Card>

            {/* Language */}
            <Card t={t} title="لغة التقديم" icon={<Languages size={17} strokeWidth={1.5} />} sub="اللغة التي ستُرسل بها طلبات التوظيف">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([["ar", "العربية", "رسائل بالعربي"], ["en", "English", "Messages in English"]] as const).map(([lang, label, sub]) => {
                  const isActive = lang === "ar" ? user?.application_language !== "en" : user?.application_language === "en";
                  return (
                    <button key={lang} onClick={() => changeLanguage(lang)} disabled={savingLang} style={{
                      background: savingLang ? t.iconBg : (isActive ? (dark ? "#0a1f0a" : "#f0fdf4") : t.iconBg),
                      border: `1px solid ${isActive ? (dark ? "#2a2a2a" : "#bbf7d0") : t.border2}`,
                      borderRadius: 12, padding: "12px 14px", cursor: savingLang ? "wait" : "pointer",
                      textAlign: "right",
                    }}>
                      <p style={{ margin: 0, color: isActive ? (dark ? "#fff" : "#166534") : t.text, fontSize: 14, fontWeight: 700 }}>
                        {label} {isActive && <CheckCircle size={12} style={{ verticalAlign: "middle" }} />}
                      </p>
                      <p style={{ margin: "3px 0 0", color: t.text3, fontSize: 11 }}>{sub}</p>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Email Templates */}
            <Card t={t} title="قالب الإيميل" icon={<Mail size={17} strokeWidth={1.5} />} sub="شكل وأسلوب إيميل التقديم المُرسَل للشركات">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {([
                  {
                    id: "classic",
                    name: "الكلاسيكي",
                    desc: "رسمي ومنظّم • مناسب للشركات الكبرى",
                    preview: (
                      <div style={{ background: "#fff", borderRadius: 8, padding: "8px 10px", fontSize: 9, color: "#333", direction: "rtl", lineHeight: 1.7 }}>
                        <div style={{ fontWeight: 700, borderBottom: "1px solid #eee", paddingBottom: 4, marginBottom: 4, color: "#111" }}>طلب توظيف — مهندس برمجيات</div>
                        <div style={{ color: "#555" }}>السادة المحترمون،</div>
                        <div style={{ color: "#555" }}>أتقدم بكل احترام للتقديم على هذه الوظيفة استناداً لخبرتي في...</div>
                        <div style={{ marginTop: 4, borderTop: "1px solid #eee", paddingTop: 4, color: "#888", fontSize: 8 }}>الاسم · الجوال</div>
                      </div>
                    ),
                  },
                  {
                    id: "modern",
                    name: "الحديث",
                    desc: "عصري وودّي • مناسب للشركات الناشئة",
                    preview: (
                      <div style={{
                        background: dark ? "#0f0f0f" : "#1f1b2e",
                        borderRadius: 8, padding: "8px 10px", fontSize: 9,
                        color: "#eee", direction: "rtl", lineHeight: 1.7,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, background: "#a78bfa", flexShrink: 0 }} />
                          <div style={{ fontWeight: 700, color: "#fff", fontSize: 10 }}>مهندس برمجيات</div>
                        </div>
                        <div style={{ color: "#ccc" }}>مرحباً! أنا مهتم بهذه الفرصة وأرى تطابقاً واضحاً مع خلفيتي في...</div>
                        <div style={{ marginTop: 4, color: "#a78bfa", fontSize: 8 }}>عرض السيرة الذاتية ←</div>
                      </div>
                    ),
                  },
                  {
                    id: "brief",
                    name: "المختصر",
                    desc: "موجز ومباشر • يوفّر وقت المُوظِّف",
                    preview: (
                      <div style={{ background: "#f8f8f8", borderRadius: 8, padding: "8px 10px", fontSize: 9, color: "#333", direction: "rtl", lineHeight: 1.7 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, color: "#111" }}>التقديم على: مهندس برمجيات</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ display: "flex", gap: 4 }}><span style={{ color: "#888" }}>•</span><span style={{ color: "#555" }}>5 سنوات خبرة في React</span></div>
                          <div style={{ display: "flex", gap: 4 }}><span style={{ color: "#888" }}>•</span><span style={{ color: "#555" }}>خبرة سابقة في نفس المجال</span></div>
                          <div style={{ display: "flex", gap: 4 }}><span style={{ color: "#888" }}>•</span><span style={{ color: "#555" }}>متاح للبدء فوراً</span></div>
                        </div>
                      </div>
                    ),
                  },
                ] as const).map((tpl) => {
                  const isActive = (user?.template_type || "classic") === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => changeTemplate(tpl.id)}
                      disabled={savingTemplate}
                      style={{
                        display: "flex", gap: 12, alignItems: "stretch",
                        background: savingTemplate ? t.iconBg : (isActive ? (dark ? "#0d0d1a" : "#faf5ff") : t.iconBg),
                        border: `1.5px solid ${isActive ? (dark ? "#4c1d95" : "#c4b5fd") : t.border2}`,
                        borderRadius: 14, padding: "12px 14px", cursor: savingTemplate ? "wait" : "pointer",
                        textAlign: "right",
                        transition: "all 0.15s",
                      }}
                    >
                      {/* mini preview */}
                      <div style={{ width: 120, flexShrink: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${dark ? "#2a2a2a" : "#e4e4e7"}` }}>
                        {tpl.preview}
                      </div>
                      {/* info */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <p style={{ margin: 0, color: isActive ? (dark ? "#c4b5fd" : "#7c3aed") : t.text, fontSize: 14, fontWeight: 700 }}>{tpl.name}</p>
                          {isActive && <CheckCircle size={13} color={dark ? "#a78bfa" : "#7c3aed"} />}
                        </div>
                        <p style={{ margin: 0, color: t.text3, fontSize: 12, lineHeight: 1.5 }}>{tpl.desc}</p>
                        {isActive && (
                          <span style={{
                            display: "inline-block", marginTop: 4,
                            padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                            background: dark ? "#1e1b3a" : "#ede9fe",
                            color: dark ? "#c4b5fd" : "#6d28d9",
                          }}>مُفعّل</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Security */}
            <Card t={t} title="الأمان" icon={<Shield size={17} strokeWidth={1.5} />} sub="تسجيل الدخول عبر إيميلك">
              <p style={{ color: t.text2, fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                نظامنا لا يستخدم كلمات سر. تسجيل الدخول يتم بإيميلك المربوط مباشرة، فلا حاجة لتذكر أي كلمة سر.
              </p>
            </Card>

            {/* Danger zone */}
            <div style={{
              background: t.surface, border: `1px solid ${dark ? "#7f1d1d" : "#fecaca"}`,
              borderRadius: 16, padding: "18px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11,
                  background: dark ? "#1f0a0a" : "#fef2f2",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <AlertTriangle size={17} strokeWidth={1.5} color="#f87171" />
                </div>
                <div>
                  <p style={{ color: "#f87171", fontSize: 14, fontWeight: 600, margin: 0 }}>منطقة الخطر</p>
                  <p style={{ color: t.text3, fontSize: 12, margin: "2px 0 0" }}>إجراءات لا يمكن التراجع عنها</p>
                </div>
              </div>
              <button onClick={() => { clearToken(); router.replace("/portal/login"); }} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "12px", background: t.iconBg, color: t.text2,
                border: `1px solid ${t.border2}`, borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: "pointer", marginBottom: 10,
              }}>
                <LogOut size={16} strokeWidth={1.5} /> تسجيل الخروج
              </button>
              <button onClick={() => setShowDelete(true)} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "12px", background: dark ? "#1f0a0a" : "#fef2f2",
                color: "#f87171", border: `1px solid ${dark ? "#7f1d1d" : "#fecaca"}`, borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
                <Trash2 size={16} strokeWidth={1.5} /> حذف الحساب نهائياً
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete modal */}
      {showDelete && (
        <div onClick={() => !deleting && setShowDelete(false)} style={{
          position: "fixed", inset: 0, background: "#000", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: dark ? "#0d0d0d" : "#fff",
            border: `1px solid ${dark ? "#7f1d1d" : "#fecaca"}`,
            borderRadius: 18, padding: "24px 20px", width: "100%", maxWidth: 440,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: "#f87171", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={17} /> حذف الحساب
              </h2>
              <button onClick={() => setShowDelete(false)} style={{ background: "none", border: "none", color: t.text3, cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ background: dark ? "#1a0a0a" : "#fef2f2", border: `1px solid ${dark ? "#7f1d1d" : "#fecaca"}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <p style={{ margin: 0, color: "#fca5a5", fontSize: 13, lineHeight: 1.7 }}>سيتم حذف كل بياناتك نهائياً وبدون رجعة.</p>
            </div>
            <p style={{ color: t.text2, fontSize: 13, margin: "0 0 8px" }}>اكتب كلمة <strong style={{ color: "#f87171" }}>حذف</strong> للتأكيد:</p>
            <input
              value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="حذف" disabled={deleting}
              style={{
                width: "100%", background: t.input, border: `1px solid ${t.border2}`,
                borderRadius: 10, padding: "10px 12px", color: t.text, fontSize: 16,
                outline: "none", boxSizing: "border-box", marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDelete(false)} disabled={deleting} style={{
                flex: 1, background: t.iconBg, color: t.text, border: `1px solid ${t.border2}`,
                borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>إلغاء</button>
              <button onClick={deleteAccount} disabled={deleting || deleteConfirm !== "حذف"} style={{
                flex: 1, background: deleteConfirm === "حذف" ? "#ef4444" : t.iconBg,
                color: deleteConfirm === "حذف" ? "#fff" : t.text3,
                border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700,
                cursor: deleteConfirm === "حذف" ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                {deleting && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                {deleting ? "جاري الحذف..." : "حذف نهائي"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

function Card({ t, title, icon, sub, children }: { t: any; title: string; icon: React.ReactNode; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: "18px 16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11,
          background: t.iconBg, border: `1px solid ${t.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, color: t.text,
        }}>{icon}</div>
        <div>
          <p style={{ color: t.text, fontSize: 14, fontWeight: 600, margin: 0 }}>{title}</p>
          {sub && <p style={{ color: t.text3, fontSize: 12, margin: "3px 0 0" }}>{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Row({ t, icon, label, value, dir, last }: { t: any; icon: React.ReactNode; label: string; value: string; dir?: string; last?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 0", borderBottom: last ? "none" : `1px solid ${t.divider}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.text3 }}>
        {icon}
        <span style={{ fontSize: 12 }}>{label}</span>
      </div>
      <span style={{ color: t.text, fontSize: 13, fontWeight: 500, direction: dir as any, maxWidth: "60%", textAlign: "left", wordBreak: "break-all" }}>
        {value || "—"}
      </span>
    </div>
  );
}
