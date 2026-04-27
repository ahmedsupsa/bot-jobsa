"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useTheme } from "@/contexts/theme-context";
import { portalFetch, clearToken } from "@/lib/portal-auth";
import {
  User, Phone, MapPin, Calendar, Mail, CreditCard, Send,
  Languages, CheckCircle, XCircle, Loader2, Pencil, Save, X,
  LogOut, Trash2, MessageCircle, Lock,
} from "lucide-react";

interface UserData {
  full_name: string; phone: string; age: number | null; city: string;
  subscription_active: boolean; days_left: number; subscription_ends_at: string;
  applications_count: number; email: string; sender_email_alias: string;
  application_language: string; template_type: string;
  email_connected: boolean; smtp_email: string;
}

type Tab = "profile" | "settings";

const CITIES = [
  "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "الظهران",
  "الأحساء", "الطائف", "تبوك", "بريدة", "خميس مشيط", "حائل", "الجبيل", "نجران",
  "أبها", "ينبع", "الخرج", "القطيف", "عرعر", "سكاكا", "جازان", "الباحة",
];

export default function AccountPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [tab, setTab] = useState<Tab>("profile");
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editAge, setEditAge] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  // settings state
  const [savingLang, setSavingLang] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // delete state
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
    } catch { clearToken(); router.replace("/portal/login"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function startEdit() {
    if (!user) return;
    setEditName(user.full_name);
    setEditPhone(user.phone);
    setEditCity(user.city);
    setEditAge(user.age ? String(user.age) : "");
    setMsg(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setMsg(null);
  }

  async function handleSave() {
    if (!editName.trim()) { setMsg({ text: "الاسم الكامل مطلوب", type: "err" }); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await portalFetch("/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: editName.trim(),
          phone: editPhone.trim(),
          city: editCity.trim(),
          age: editAge ? parseInt(editAge) : null,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setMsg({ text: "تم حفظ البيانات بنجاح ✓", type: "ok" });
        await load();
        setEditing(false);
      } else {
        setMsg({ text: d.error || "فشل الحفظ", type: "err" });
      }
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
        setMsg({ text: `تم اختيار القالب ${names[tpl] || tpl}`, type: "ok" }); await load();
      } else { const d = await res.json(); setMsg({ text: d.error || "فشل الحفظ", type: "err" }); }
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

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    padding: "11px 14px",
    background: t.input, border: `1px solid ${t.border2}`,
    borderRadius: 10, color: t.text, fontSize: 14, outline: "none",
    fontFamily: "inherit",
  };

  return (
    <PortalShell>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* ─── Header ─── */}
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
                {user.city && (
                  <span style={{ color: t.text3, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={12} strokeWidth={1.5} /> {user.city}
                  </span>
                )}
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

        {/* ─── Tabs ─── */}
        <div style={{
          display: "flex", gap: 4,
          background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: 14, padding: 4, marginBottom: 20,
        }}>
          {([["profile", "حسابي", <User size={15} key="u" />], ["settings", "الإعدادات", <CreditCard size={15} key="s" />]] as const).map(([key, label, icon]) => (
            <button key={key} onClick={() => { setTab(key as Tab); setMsg(null); setEditing(false); }} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "11px 0", borderRadius: 11, border: "none", cursor: "pointer",
              background: tab === key ? (dark ? "#fff" : "#09090b") : "transparent",
              color: tab === key ? (dark ? "#0a0a0a" : "#fff") : t.text3,
              fontSize: 14, fontWeight: tab === key ? 700 : 400, transition: "all 0.18s",
            }}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ─── Alert ─── */}
        {msg && !editing && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 16px", borderRadius: 12, fontSize: 13, fontWeight: 500, marginBottom: 14,
            background: msg.type === "ok" ? (dark ? "#0a1f0a" : "#f0fdf4") : (dark ? "#1a0a0a" : "#fef2f2"),
            color: msg.type === "ok" ? (dark ? "#fff" : "#166534") : "#f87171",
            border: `1px solid ${msg.type === "ok" ? (dark ? "#2a2a2a" : "#bbf7d0") : (dark ? "#7f1d1d" : "#fecaca")}`,
          }}>
            {msg.type === "ok" ? <CheckCircle size={15} /> : <XCircle size={15} />}
            {msg.text}
          </div>
        )}

        {loading || !user ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
            <Loader2 size={28} color={t.text3} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : tab === "profile" ? (
          /* ── PROFILE TAB ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.2s ease" }}>

            {/* ─── بطاقة البيانات الشخصية ─── */}
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18, overflow: "hidden" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px", borderBottom: `1px solid ${t.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: t.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <User size={16} strokeWidth={1.5} color={t.text2} />
                  </div>
                  <span style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>البيانات الشخصية</span>
                </div>
                {!editing ? (
                  <button onClick={startEdit} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 9, border: `1px solid ${t.border2}`,
                    background: "transparent", color: t.text2, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}>
                    <Pencil size={13} /> تعديل
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={cancelEdit} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "7px 12px", borderRadius: 9, border: `1px solid ${t.border2}`,
                      background: "transparent", color: t.text3, fontSize: 13, cursor: "pointer",
                    }}>
                      <X size={13} /> إلغاء
                    </button>
                    <button onClick={handleSave} disabled={saving} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "7px 14px", borderRadius: 9, border: "none",
                      background: dark ? "#fff" : "#09090b",
                      color: dark ? "#0a0a0a" : "#fff",
                      fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer",
                    }}>
                      {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
                      {saving ? "جاري الحفظ…" : "حفظ"}
                    </button>
                  </div>
                )}
              </div>

              {!editing ? (
                /* ─── وضع العرض ─── */
                <div style={{ padding: "4px 0" }}>
                  <InfoRow t={t} icon={<User size={13} />} label="الاسم الكامل" value={user!.full_name} />
                  <InfoRow t={t} icon={<Phone size={13} />} label="رقم الجوال" value={user!.phone || "—"} dir="ltr" />
                  <InfoRow t={t} icon={<Calendar size={13} />} label="العمر" value={user!.age ? `${user!.age} سنة` : "—"} />
                  <InfoRow t={t} icon={<MapPin size={13} />} label="المدينة" value={user!.city || "—"} last />
                </div>
              ) : (
                /* ─── وضع التعديل ─── */
                <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {msg && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 10, fontSize: 13,
                      background: msg.type === "ok" ? (dark ? "#0a1f0a" : "#f0fdf4") : (dark ? "#1f0d0d" : "#fff5f5"),
                      color: msg.type === "ok" ? "#22c55e" : "#f87171",
                      border: `1px solid ${msg.type === "ok" ? (dark ? "#1a4a1a" : "#bbf7d0") : (dark ? "#4a1a1a" : "#fecaca")}`,
                    }}>
                      {msg.text}
                    </div>
                  )}

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>
                      الاسم الكامل <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="الاسم الكامل"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>رقم الجوال</label>
                    <input
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      placeholder="05xxxxxxxx"
                      dir="ltr"
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>المدينة</label>
                      <select
                        value={editCity}
                        onChange={e => setEditCity(e.target.value)}
                        style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none" }}
                      >
                        <option value="">اختر المدينة</option>
                        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>العمر</label>
                      <input
                        value={editAge}
                        onChange={e => setEditAge(e.target.value.replace(/\D/g, ""))}
                        placeholder="25"
                        maxLength={2}
                        dir="ltr"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ─── الاشتراك ─── */}
            <Card t={t} title="الاشتراك" icon={<CreditCard size={17} strokeWidth={1.5} />}>
              <InfoRow t={t} icon={<CreditCard size={13} />} label="النوع" value="شهري" />
              <InfoRow t={t} icon={<Calendar size={13} />} label="تاريخ الانتهاء" value={endDate} />
              <InfoRow t={t} icon={<Calendar size={13} />} label="الأيام المتبقية" value={`${user!.days_left} يوم`} />
              <InfoRow t={t} icon={<Send size={13} />} label="التقديمات المرسلة" value={`${user!.applications_count} تقديم`} last />
            </Card>

            {/* ─── الإيميل ─── */}
            <Card t={t} title="البريد الإلكتروني" icon={<Mail size={17} strokeWidth={1.5} />}>
              {user!.email_connected ? (
                <InfoRow t={t} icon={<Mail size={13} />} label="الإيميل المربوط" value={user!.smtp_email} dir="ltr" last badge="مفعّل ✓" />
              ) : (
                <div style={{ padding: "4px 0 8px" }}>
                  <a href="/portal/email" style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: dark ? "#fff" : "#09090b", color: dark ? "#0a0a0a" : "#fff",
                    border: "none", borderRadius: 10, padding: "10px 18px",
                    fontSize: 13, fontWeight: 700, textDecoration: "none",
                  }}>
                    <Mail size={14} /> ربط الإيميل
                  </a>
                </div>
              )}
            </Card>

            {/* ─── تسجيل الخروج وحذف الحساب ─── */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => { clearToken(); router.replace("/portal/login"); }} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px", border: `1px solid ${t.border}`, background: t.surface,
                borderRadius: 12, color: t.text2, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                <LogOut size={15} /> تسجيل الخروج
              </button>
              <button onClick={() => setShowDelete(true)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px", border: "1px solid #fecaca", background: dark ? "#1a0a0a" : "#fff5f5",
                borderRadius: 12, color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                <Trash2 size={15} /> حذف الحساب
              </button>
            </div>

            {/* Delete Modal */}
            {showDelete && (
              <div style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 999,
                display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
              }}>
                <div style={{ background: t.surface, borderRadius: 20, padding: 28, maxWidth: 380, width: "100%" }}>
                  <h3 style={{ color: "#f87171", margin: "0 0 10px", fontSize: 17, fontWeight: 800 }}>حذف الحساب نهائياً</h3>
                  <p style={{ color: t.text2, fontSize: 13, lineHeight: 1.7, margin: "0 0 16px" }}>
                    سيتم حذف جميع بياناتك بشكل دائم ولا يمكن التراجع. اكتب <strong style={{ color: t.text }}>حذف</strong> للتأكيد.
                  </p>
                  <input
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="اكتب: حذف"
                    style={{ ...inputStyle, marginBottom: 14 }}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setShowDelete(false); setDeleteConfirm(""); }} style={{
                      flex: 1, padding: "11px", border: `1px solid ${t.border}`, background: t.surface,
                      borderRadius: 10, color: t.text2, fontSize: 13, cursor: "pointer",
                    }}>إلغاء</button>
                    <button onClick={deleteAccount} disabled={deleteConfirm !== "حذف" || deleting} style={{
                      flex: 1, padding: "11px", border: "none", background: "#ef4444",
                      borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700,
                      cursor: deleteConfirm !== "حذف" || deleting ? "not-allowed" : "pointer",
                      opacity: deleteConfirm !== "حذف" ? 0.5 : 1,
                    }}>
                      {deleting ? "جاري الحذف…" : "تأكيد الحذف"}
                    </button>
                  </div>
                </div>
              </div>
            )}
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

            {/* Language */}
            <Card t={t} title="لغة التقديم" icon={<Languages size={17} strokeWidth={1.5} />} sub="اللغة التي ستُرسل بها طلبات التوظيف">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([["ar", "العربية", "رسائل بالعربي"], ["en", "English", "Messages in English"]] as const).map(([lang, label, sub]) => {
                  const isActive = lang === "ar" ? user?.application_language !== "en" : user?.application_language === "en";
                  return (
                    <button key={lang} onClick={() => changeLanguage(lang)} disabled={savingLang} style={{
                      background: isActive ? (dark ? "#0a1f0a" : "#f0fdf4") : t.iconBg,
                      border: `1px solid ${isActive ? (dark ? "#2a2a2a" : "#bbf7d0") : t.border2}`,
                      borderRadius: 12, padding: "12px 14px", cursor: savingLang ? "wait" : "pointer", textAlign: "right",
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
                  { id: "classic", name: "الكلاسيكي", desc: "رسمي ومنظّم • مناسب للشركات الكبرى",
                    preview: (
                      <div style={{ background: "#fff", borderRadius: 8, padding: "8px 10px", fontSize: 9, color: "#333", direction: "rtl", lineHeight: 1.7 }}>
                        <div style={{ fontWeight: 700, borderBottom: "1px solid #eee", paddingBottom: 4, marginBottom: 4, color: "#111" }}>طلب توظيف — مهندس برمجيات</div>
                        <div style={{ color: "#555" }}>السادة المحترمون،</div>
                        <div style={{ color: "#555" }}>أتقدم بكل احترام للتقديم على هذه الوظيفة استناداً لخبرتي في...</div>
                        <div style={{ marginTop: 4, borderTop: "1px solid #eee", paddingTop: 4, color: "#888", fontSize: 8 }}>الاسم · الجوال</div>
                      </div>
                    ),
                  },
                  { id: "modern", name: "الحديث", desc: "عصري وودّي • مناسب للشركات الناشئة",
                    preview: (
                      <div style={{ background: dark ? "#0f0f0f" : "#1f1b2e", borderRadius: 8, padding: "8px 10px", fontSize: 9, color: "#eee", direction: "rtl", lineHeight: 1.7 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, background: "#a78bfa", flexShrink: 0 }} />
                          <div style={{ fontWeight: 700, color: "#fff", fontSize: 10 }}>مهندس برمجيات</div>
                        </div>
                        <div style={{ color: "#ccc" }}>مرحباً! أنا مهتم بهذه الفرصة وأرى تطابقاً واضحاً مع خلفيتي في...</div>
                        <div style={{ marginTop: 4, color: "#a78bfa", fontSize: 8 }}>عرض السيرة الذاتية ←</div>
                      </div>
                    ),
                  },
                  { id: "brief", name: "المختصر", desc: "موجز ومباشر • يوفّر وقت المُوظِّف",
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
                    <button key={tpl.id} onClick={() => changeTemplate(tpl.id)} disabled={savingTemplate} style={{
                      display: "flex", gap: 12, alignItems: "stretch",
                      background: isActive ? (dark ? "#0d0d1a" : "#faf5ff") : t.iconBg,
                      border: `1.5px solid ${isActive ? (dark ? "#4c1d95" : "#c4b5fd") : t.border2}`,
                      borderRadius: 14, padding: "12px 14px", cursor: savingTemplate ? "wait" : "pointer",
                      textAlign: "right", transition: "all 0.15s",
                    }}>
                      <div style={{ width: 120, flexShrink: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${dark ? "#2a2a2a" : "#e4e4e7"}` }}>
                        {tpl.preview}
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <p style={{ margin: 0, color: isActive ? (dark ? "#c4b5fd" : "#7c3aed") : t.text, fontSize: 14, fontWeight: 700 }}>{tpl.name}</p>
                          {isActive && <CheckCircle size={13} color={dark ? "#a78bfa" : "#7c3aed"} />}
                        </div>
                        <p style={{ margin: 0, color: t.text3, fontSize: 12, lineHeight: 1.5 }}>{tpl.desc}</p>
                        {isActive && (
                          <span style={{
                            display: "inline-block", marginTop: 4,
                            padding: "2px 10px", borderRadius: 100,
                            background: dark ? "#2e1065" : "#ede9fe",
                            color: dark ? "#c4b5fd" : "#7c3aed",
                            fontSize: 11, fontWeight: 600,
                          }}>مفعّل</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        select option { background: ${dark ? "#141414" : "#fff"}; color: ${dark ? "#fff" : "#09090b"}; }
      `}</style>
    </PortalShell>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Card({ t, title, icon, sub, children }: {
  t: Record<string, string>; title: string; icon: React.ReactNode; sub?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: t.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <div>
          <p style={{ margin: 0, color: t.text, fontSize: 14, fontWeight: 700 }}>{title}</p>
          {sub && <p style={{ margin: "1px 0 0", color: t.text3, fontSize: 11 }}>{sub}</p>}
        </div>
      </div>
      <div style={{ padding: "4px 0 8px" }}>{children}</div>
    </div>
  );
}

function InfoRow({ t, icon, label, value, dir, last, badge }: {
  t: Record<string, string>; icon: React.ReactNode;
  label: string; value: string; dir?: "ltr"; last?: boolean; badge?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 20px", borderBottom: last ? "none" : `1px solid ${t.divider}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: t.text3 }}>{icon}</span>
        <span style={{ color: t.text2, fontSize: 13 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {badge && (
          <span style={{
            padding: "2px 8px", borderRadius: 100,
            background: "#f0fdf4", color: "#166534",
            fontSize: 11, fontWeight: 600,
          }}>{badge}</span>
        )}
        <span style={{ color: t.text, fontSize: 14, fontWeight: 500 }} dir={dir}>{value}</span>
      </div>
    </div>
  );
}
