"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useTheme } from "@/contexts/theme-context";
import { portalFetch, clearToken, getToken } from "@/lib/portal-auth";
import {
  User, Phone, MapPin, Calendar, Mail, CreditCard, Send,
  CheckCircle, XCircle, Loader2, Pencil, Save, X,
  LogOut, Trash2, FileDown, Receipt, Award, Plus, GraduationCap,
  ShieldCheck, BookOpen, ClipboardList, BadgeCheck, Eye, ChevronDown,
} from "lucide-react";
import { TEMPLATE_META, TEMPLATE_IDS, getTemplatePreview, getTemplateIcon } from "./template-previews";

interface UserData {
  full_name: string; phone: string; age: number | null; city: string; gender: string;
  subscription_active: boolean; days_left: number; subscription_ends_at: string;
  applications_count: number; email: string; sender_email_alias: string;
  template_type: string;
  email_connected: boolean; smtp_email: string;
}

type Tab = "profile" | "settings" | "invoices";

type CertType = "license" | "certificate" | "course" | "qiyas" | "other";
interface Certification {
  id: string; type: CertType; name: string; issuer: string | null;
  issued_at: string | null; expires_at: string | null;
}
const CERT_TYPES: { value: CertType; label: string; icon: React.ReactNode }[] = [
  { value: "license",     label: "رخصة مهنية",          icon: <ShieldCheck size={13} /> },
  { value: "certificate", label: "شهادة احترافية",       icon: <BadgeCheck size={13} /> },
  { value: "course",      label: "دورة تدريبية",         icon: <BookOpen size={13} /> },
  { value: "qiyas",       label: "اختبار قياس",          icon: <ClipboardList size={13} /> },
  { value: "other",       label: "اعتماد آخر",           icon: <GraduationCap size={13} /> },
];

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
  const [editGender, setEditGender] = useState("male");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  // settings state
  const [savingTemplate, setSavingTemplate] = useState(false);

  // delete state
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // certifications state
  const [certs, setCerts] = useState<Certification[]>([]);
  const [certsLoading, setCertsLoading] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [certForm, setCertForm] = useState({ type: "certificate" as CertType, name: "", issuer: "", issued_at: "", expires_at: "" });
  const [certSaving, setCertSaving] = useState(false);
  const [certMsg, setCertMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  // preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // edit cover letter state
  const [editMode, setEditMode] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // invoices state
  type PortalOrder = {
    id: string; status: string; amount: number; paid_at: string | null;
    payment_gateway: string | null;
    store_products: { name: string; duration_days: number } | null;
  };
  const [invoices, setInvoices] = useState<PortalOrder[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);

  const GATEWAY_AR: Record<string, string> = { tamara: "تمارا", streampay: "StreamPay", bank_transfer: "تحويل بنكي" };

  function buildInvoiceUrl(orderId: string): string {
    const token = getToken() || "";
    return `/api/portal/invoice/${orderId}?token=${encodeURIComponent(token)}`;
  }

  async function loadInvoices() {
    setInvoicesLoading(true);
    try {
      const res = await portalFetch("/refunds");
      const d = await res.json();
      if (d.ok) setInvoices((d.orders || []).filter((o: PortalOrder) => o.status === "paid"));
    } catch { /* silent */ }
    finally { setInvoicesLoading(false); setInvoicesLoaded(true); }
  }

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
    accent:  dark ? "#fff"    : "#09090b",
    accentFg: dark ? "#0a0a0a" : "#fff",
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
      setUser({ ...me, template_type: settings.template_type || "classic" });
    } catch { clearToken(); router.replace("/portal/login"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); loadCerts(); }, []);

  async function loadCerts() {
    setCertsLoading(true);
    try {
      const res = await portalFetch("/certifications");
      const d = await res.json();
      if (d.ok) setCerts(d.certifications || []);
    } catch { /* silent */ }
    finally { setCertsLoading(false); }
  }

  function openAddCert() {
    setEditingCert(null);
    setCertForm({ type: "certificate", name: "", issuer: "", issued_at: "", expires_at: "" });
    setCertMsg(null);
    setShowCertModal(true);
  }

  function openEditCert(c: Certification) {
    setEditingCert(c);
    setCertForm({ type: c.type, name: c.name, issuer: c.issuer || "", issued_at: c.issued_at || "", expires_at: c.expires_at || "" });
    setCertMsg(null);
    setShowCertModal(true);
  }

  async function saveCert() {
    if (!certForm.name.trim()) { setCertMsg({ text: "اسم الشهادة مطلوب", type: "err" }); return; }
    setCertSaving(true); setCertMsg(null);
    try {
      const body = { ...certForm, name: certForm.name.trim(), issuer: certForm.issuer.trim() || null, issued_at: certForm.issued_at || null, expires_at: certForm.expires_at || null };
      const res = await portalFetch("/certifications", { method: editingCert ? "PUT" : "POST", body: JSON.stringify(editingCert ? { ...body, id: editingCert.id } : body) });
      const d = await res.json();
      if (res.ok && d.ok) { setShowCertModal(false); await loadCerts(); }
      else setCertMsg({ text: d.error || "فشل الحفظ", type: "err" });
    } catch { setCertMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setCertSaving(false); }
  }

  async function deleteCert(id: string) {
    if (!confirm("هل تريد حذف هذا السجل؟")) return;
    const res = await portalFetch(`/certifications?id=${id}`, { method: "DELETE" });
    if (res.ok) await loadCerts();
  }

  function startEdit() {
    if (!user) return;
    setEditName(user.full_name);
    setEditPhone(user.phone);
    setEditCity(user.city);
    setEditAge(user.age ? String(user.age) : "");
    setEditGender(user.gender || "male");
    setMsg(null); setEditing(true);
  }
  function cancelEdit() { setEditing(false); setMsg(null); }

  async function handleSave() {
    if (!editName.trim()) { setMsg({ text: "الاسم الكامل مطلوب", type: "err" }); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await portalFetch("/me", {
        method: "PATCH",
        body: JSON.stringify({ full_name: editName.trim(), phone: editPhone.trim(), city: editCity.trim(), age: editAge ? parseInt(editAge) : null, gender: editGender }),
      });
      const d = await res.json();
      if (res.ok) { setMsg({ text: "تم حفظ البيانات بنجاح ✓", type: "ok" }); await load(); setEditing(false); }
      else { setMsg({ text: d.error || "فشل الحفظ", type: "err" }); }
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSaving(false); }
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

  async function loadPreview(regen = false) {
    setPreviewLoading(true);
    setShowPreview(true);
    setEditMode(false);
    try {
      const url = regen ? "/cv/preview-letter?regenerate=1" : "/cv/preview-letter";
      const res = await portalFetch(url);
      const html = await res.text();
      setPreviewHtml(html);
    } catch { setPreviewHtml(""); }
    finally { setPreviewLoading(false); }
  }

  async function enterEditMode() {
    setEditMode(true);
    try {
      const res = await portalFetch("/cv/preview-letter?format=json");
      const data = await res.json();
      setEditBody(data.body || "");
    } catch { setEditBody(""); }
  }

  async function saveEdit() {
    if (!editBody.trim()) return;
    setSavingEdit(true);
    try {
      const res = await portalFetch("/settings", {
        method: "POST",
        body: JSON.stringify({ cover_letter_body: editBody }),
      });
      if (res.ok) {
        setEditMode(false);
        setPreviewLoading(true);
        const r = await portalFetch("/cv/preview-letter");
        setPreviewHtml(await r.text());
        setPreviewLoading(false);
      }
    } catch { /* silent */ }
    finally { setSavingEdit(false); }
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
    width: "100%", boxSizing: "border-box", padding: "11px 14px",
    background: t.input, border: `1px solid ${t.border2}`,
    borderRadius: 10, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit",
  };

  const tabDefs: { key: Tab; label: string }[] = [
    { key: "profile",  label: "حسابي" },
    { key: "settings", label: "الإعدادات" },
    { key: "invoices", label: "فواتيري" },
  ];

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
              background: t.accent, color: t.accentFg,
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
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 100,
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
          {tabDefs.map(({ key, label }) => (
            <button key={key} onClick={() => {
              setTab(key); setMsg(null); setEditing(false);
              if (key === "invoices" && !invoicesLoaded) loadInvoices();
            }} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "11px 0", borderRadius: 11, border: "none", cursor: "pointer",
              background: tab === key ? t.accent : "transparent",
              color: tab === key ? t.accentFg : t.text3,
              fontSize: 13, fontWeight: tab === key ? 700 : 400, transition: "all 0.18s",
            }}>
              {key === "profile" ? <User size={15} /> : key === "settings" ? <CreditCard size={15} /> : <Receipt size={15} />}
              {label}
            </button>
          ))}
        </div>

        {/* ─── Global alert ─── */}
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
          /* ══════════════ PROFILE TAB ══════════════ */
          <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.2s ease" }}>

            {/* البيانات الشخصية */}
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
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                    borderRadius: 9, border: `1px solid ${t.border2}`, background: "transparent",
                    color: t.text2, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}>
                    <Pencil size={13} /> تعديل
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={cancelEdit} style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "7px 12px",
                      borderRadius: 9, border: `1px solid ${t.border2}`, background: "transparent",
                      color: t.text3, fontSize: 13, cursor: "pointer",
                    }}>
                      <X size={13} /> إلغاء
                    </button>
                    <button onClick={handleSave} disabled={saving} style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
                      borderRadius: 9, border: "none",
                      background: t.accent, color: t.accentFg,
                      fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer",
                    }}>
                      {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
                      {saving ? "جاري الحفظ…" : "حفظ"}
                    </button>
                  </div>
                )}
              </div>

              {!editing ? (
                <div style={{ padding: "4px 0" }}>
                  <InfoRow t={t} icon={<User size={13} />} label="الاسم الكامل" value={user.full_name} />
                  <InfoRow t={t} icon={<Phone size={13} />} label="رقم الجوال" value={user.phone || "—"} dir="ltr" />
                  <InfoRow t={t} icon={<Calendar size={13} />} label="العمر" value={user.age ? `${user.age} سنة` : "—"} />
                  <InfoRow t={t} icon={<MapPin size={13} />} label="المدينة" value={user.city || "—"} />
                  <InfoRow t={t} icon={<User size={13} />} label="الجنس" value={user.gender === "female" ? "أنثى" : "ذكر"} last />
                </div>
              ) : (
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {msg && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 10, fontSize: 13,
                      background: msg.type === "ok" ? (dark ? "#0a1f0a" : "#f0fdf4") : (dark ? "#1f0d0d" : "#fff5f5"),
                      color: msg.type === "ok" ? "#22c55e" : "#f87171",
                      border: `1px solid ${msg.type === "ok" ? (dark ? "#1a4a1a" : "#bbf7d0") : (dark ? "#4a1a1a" : "#fecaca")}`,
                    }}>{msg.text}</div>
                  )}
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>
                      الاسم الكامل <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="الاسم الكامل" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>رقم الجوال</label>
                    <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="05xxxxxxxx" dir="ltr" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>الجنس</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {(["male", "female"] as const).map(g => (
                        <button key={g} type="button" onClick={() => setEditGender(g)} style={{
                          flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${editGender === g ? t.accent : t.border2}`,
                          background: editGender === g ? t.accent : "transparent",
                          color: editGender === g ? t.accentFg : t.text2,
                          fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                        }}>
                          {g === "male" ? "ذكر" : "أنثى"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>المدينة</label>
                      <select value={editCity} onChange={e => setEditCity(e.target.value)}
                        style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none" }}>
                        <option value="">اختر المدينة</option>
                        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>العمر</label>
                      <input value={editAge} onChange={e => setEditAge(e.target.value.replace(/\D/g, ""))}
                        placeholder="25" maxLength={2} dir="ltr" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* الاشتراك */}
            <Card t={t} title="الاشتراك" icon={<CreditCard size={17} strokeWidth={1.5} />}>
              <InfoRow t={t} icon={<CreditCard size={13} />} label="النوع" value="شهري" />
              <InfoRow t={t} icon={<Calendar size={13} />} label="تاريخ الانتهاء" value={endDate} />
              <InfoRow t={t} icon={<Calendar size={13} />} label="الأيام المتبقية" value={`${user.days_left} يوم`} />
              <InfoRow t={t} icon={<Send size={13} />} label="التقديمات المرسلة" value={`${user.applications_count} تقديم`} last />
            </Card>

            {/* الإيميل */}
            <Card t={t} title="البريد الإلكتروني" icon={<Mail size={17} strokeWidth={1.5} />}>
              {user.email_connected ? (
                <InfoRow t={t} icon={<Mail size={13} />} label="الإيميل المربوط" value={user.smtp_email} dir="ltr" last badge="مفعّل ✓" />
              ) : (
                <div style={{ padding: "8px 20px 12px" }}>
                  <a href="/portal/email" style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: t.accent, color: t.accentFg,
                    border: "none", borderRadius: 10, padding: "10px 18px",
                    fontSize: 13, fontWeight: 700, textDecoration: "none",
                  }}>
                    <Mail size={14} /> ربط الإيميل
                  </a>
                </div>
              )}
            </Card>

            {/* الشهادات والرخص */}
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18, overflow: "hidden" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px", borderBottom: certs.length > 0 ? `1px solid ${t.border}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: t.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Award size={16} strokeWidth={1.5} color={t.text2} />
                  </div>
                  <span style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>الشهادات والرخص</span>
                  {certs.length > 0 && (
                    <span style={{ background: t.iconBg, color: t.text3, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100 }}>
                      {certs.length}
                    </span>
                  )}
                </div>
                <button onClick={openAddCert} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                  borderRadius: 9, border: `1px solid ${t.border2}`, background: "transparent",
                  color: t.text2, fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>
                  <Plus size={13} /> إضافة
                </button>
              </div>

              {certsLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                  <Loader2 size={20} color={t.text3} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : certs.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center" }}>
                  <p style={{ color: t.text3, fontSize: 13, margin: 0 }}>لا توجد شهادات أو رخص مضافة بعد</p>
                </div>
              ) : (
                <div>
                  {certs.map((c, i) => {
                    const typeMeta = CERT_TYPES.find(ct => ct.value === c.type);
                    return (
                      <div key={c.id} style={{
                        display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 20px",
                        borderBottom: i < certs.length - 1 ? `1px solid ${t.divider}` : "none",
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, background: t.iconBg, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center", color: t.text3,
                        }}>
                          {typeMeta?.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, color: t.text, fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>{c.name}</p>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                            <span style={{ color: t.text3, fontSize: 12 }}>{typeMeta?.label}</span>
                            {c.issuer && <span style={{ color: t.text3, fontSize: 12 }}>· {c.issuer}</span>}
                            {c.expires_at && (
                              <span style={{ color: t.text3, fontSize: 12 }}>
                                · تنتهي {new Date(c.expires_at).toLocaleDateString("ar-SA", { year: "numeric", month: "short" })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => openEditCert(c)} style={{
                            background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 8,
                            padding: "5px 8px", cursor: "pointer", color: t.text3, display: "flex", alignItems: "center",
                          }}>
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteCert(c.id)} style={{
                            background: "transparent", border: "1px solid #fecaca", borderRadius: 8,
                            padding: "5px 8px", cursor: "pointer", color: "#f87171", display: "flex", alignItems: "center",
                          }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* تسجيل الخروج / حذف */}
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
                  <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="اكتب: حذف" style={{ ...inputStyle, marginBottom: 14 }} />
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

            {/* Certification Modal */}
            {showCertModal && (
              <div style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 999,
                display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
              }} onClick={e => { if (e.target === e.currentTarget) setShowCertModal(false); }}>
                <div style={{ background: t.surface, borderRadius: 20, padding: 28, maxWidth: 440, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <h3 style={{ color: t.text, margin: 0, fontSize: 16, fontWeight: 800 }}>
                      {editingCert ? "تعديل الشهادة" : "إضافة شهادة / رخصة"}
                    </h3>
                    <button onClick={() => setShowCertModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: t.text3 }}>
                      <X size={18} />
                    </button>
                  </div>

                  {certMsg && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14,
                      background: certMsg.type === "ok" ? (dark ? "#0a1f0a" : "#f0fdf4") : (dark ? "#1f0d0d" : "#fff5f5"),
                      color: certMsg.type === "ok" ? "#22c55e" : "#f87171",
                      border: `1px solid ${certMsg.type === "ok" ? (dark ? "#1a4a1a" : "#bbf7d0") : (dark ? "#4a1a1a" : "#fecaca")}`,
                    }}>{certMsg.text}</div>
                  )}

                  {/* النوع */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 8 }}>النوع</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {CERT_TYPES.map(ct => (
                        <button key={ct.value} type="button" onClick={() => setCertForm(f => ({ ...f, type: ct.value }))} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                          borderRadius: 10, border: `2px solid ${certForm.type === ct.value ? t.accent : t.border2}`,
                          background: certForm.type === ct.value ? t.accent : "transparent",
                          color: certForm.type === ct.value ? t.accentFg : t.text2,
                          fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                          textAlign: "right",
                        }}>
                          {ct.icon} {ct.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* الاسم */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>
                      الاسم <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <input
                      value={certForm.name}
                      onChange={e => setCertForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="مثال: رخصة مزاولة المهنة - هيئة المهندسين"
                      style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", background: t.input, border: `1px solid ${t.border2}`, borderRadius: 10, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
                    />
                  </div>

                  {/* الجهة المانحة */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>الجهة المانحة</label>
                    <input
                      value={certForm.issuer}
                      onChange={e => setCertForm(f => ({ ...f, issuer: e.target.value }))}
                      placeholder="مثال: هيئة المهندسين السعوديين"
                      style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", background: t.input, border: `1px solid ${t.border2}`, borderRadius: 10, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
                    />
                  </div>

                  {/* التواريخ */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>تاريخ الإصدار</label>
                      <input type="date" value={certForm.issued_at} onChange={e => setCertForm(f => ({ ...f, issued_at: e.target.value }))}
                        style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", background: t.input, border: `1px solid ${t.border2}`, borderRadius: 10, color: certForm.issued_at ? t.text : t.text3, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text2, marginBottom: 6 }}>تاريخ الانتهاء</label>
                      <input type="date" value={certForm.expires_at} onChange={e => setCertForm(f => ({ ...f, expires_at: e.target.value }))}
                        style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", background: t.input, border: `1px solid ${t.border2}`, borderRadius: 10, color: certForm.expires_at ? t.text : t.text3, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setShowCertModal(false)} style={{
                      flex: 1, padding: "11px", border: `1px solid ${t.border}`, background: t.surface,
                      borderRadius: 10, color: t.text2, fontSize: 13, cursor: "pointer",
                    }}>إلغاء</button>
                    <button onClick={saveCert} disabled={certSaving} style={{
                      flex: 2, padding: "11px", border: "none", background: t.accent, color: t.accentFg,
                      borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: certSaving ? "wait" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}>
                      {certSaving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
                      {certSaving ? "جاري الحفظ…" : "حفظ"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        ) : tab === "invoices" ? (
          /* ══════════════ INVOICES TAB ══════════════ */
          <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.2s ease" }}>
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${t.border}` }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: t.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Receipt size={16} strokeWidth={1.5} color={t.text2} />
                </div>
                <div>
                  <p style={{ margin: 0, color: t.text, fontSize: 15, fontWeight: 700 }}>فواتير الاشتراكات</p>
                  <p style={{ margin: "1px 0 0", color: t.text3, fontSize: 11 }}>فواتير رسمية بالبيانات الكاملة</p>
                </div>
              </div>
              {invoicesLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader2 size={24} color={t.text3} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : invoices.length === 0 ? (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16, background: t.iconBg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 14px",
                  }}>
                    <Receipt size={22} color={t.text3} strokeWidth={1.5} />
                  </div>
                  <p style={{ color: t.text, fontSize: 14, fontWeight: 700, margin: "0 0 6px" }}>لا توجد فواتير بعد</p>
                  <p style={{ color: t.text3, fontSize: 13, margin: 0 }}>ستظهر فواتير اشتراكاتك المدفوعة هنا</p>
                </div>
              ) : (
                <div style={{ padding: "8px 0" }}>
                  {invoices.map((o, i) => {
                    const productName = o.store_products?.name || "اشتراك Jobbots";
                    const dateStr = o.paid_at ? new Date(o.paid_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }) : "—";
                    const year = o.paid_at ? new Date(o.paid_at).getFullYear() : new Date().getFullYear();
                    const invNum = `JBT-${year}-${o.id.slice(0, 8).toUpperCase()}`;
                    const gwLabel = GATEWAY_AR[o.payment_gateway || ""] || o.payment_gateway || "—";
                    const isLast = i === invoices.length - 1;
                    const invoiceUrl = buildInvoiceUrl(o.id);
                    return (
                      <div key={o.id} style={{
                        padding: "16px 20px",
                        borderBottom: isLast ? "none" : `1px solid ${t.divider}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          {/* Left info */}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1, minWidth: 0 }}>
                            <div style={{
                              width: 44, height: 44, borderRadius: 12, background: t.iconBg,
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                              <Receipt size={18} color={t.text3} strokeWidth={1.5} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, color: t.text, fontSize: 14, fontWeight: 800 }}>{productName}</p>
                              <p style={{ margin: "3px 0 0", color: t.text3, fontSize: 12 }}>{invNum}</p>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "3px 10px", borderRadius: 100,
                                  background: t.iconBg, color: t.text2, fontSize: 11, fontWeight: 600,
                                }}>
                                  <Calendar size={10} /> {dateStr}
                                </span>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "3px 10px", borderRadius: 100,
                                  background: t.iconBg, color: t.text2, fontSize: 11, fontWeight: 600,
                                }}>
                                  {gwLabel}
                                </span>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "3px 10px", borderRadius: 100,
                                  background: dark ? "#0a1f0a" : "#f0fdf4",
                                  color: dark ? "#4ade80" : "#16a34a",
                                  fontSize: 11, fontWeight: 700,
                                }}>
                                  ✓ مدفوعة
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: amount + button */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
                            <span style={{ color: t.text, fontSize: 18, fontWeight: 900, whiteSpace: "nowrap" }}>
                              {o.amount} ر.س
                            </span>
                            <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "9px 16px", borderRadius: 10,
                              background: t.accent, color: t.accentFg,
                              fontSize: 13, fontWeight: 700, textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}>
                              <FileDown size={13} /> عرض الفاتورة
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        ) : (
          /* ══════════════ SETTINGS TAB ══════════════ */
          <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.2s ease" }}>

            {/* ─── Inline Preview ─── */}
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18, overflow: "hidden" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 10, padding: "16px 20px",
                borderBottom: showPreview ? `1px solid ${t.border}` : "none",
              }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}
                  onClick={() => { if (!showPreview) { loadPreview(); } else { setShowPreview(false); } }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: t.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Eye size={16} strokeWidth={1.5} color={t.text2} />
                  </div>
                  <div>
                    <p style={{ margin: 0, color: t.text, fontSize: 14, fontWeight: 700 }}>معاينة رسالة التقديم</p>
                    <p style={{ margin: "1px 0 0", color: t.text3, fontSize: 11 }}>الإيميل الحقيقي الذي يصل للشركات باسمك</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {showPreview && !previewLoading && !editMode && (
                    <>
                      <button
                        onClick={enterEditMode}
                        title="تعديل الرسالة يدوياً"
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${t.border2}`, background: "transparent",
                          color: t.text2, fontSize: 12, fontWeight: 600,
                        }}
                      >
                        <Pencil size={12} /> تعديل
                      </button>
                      <button
                        onClick={() => loadPreview(true)}
                        title="إعادة إنشاء بالذكاء الاصطناعي"
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${t.border2}`, background: "transparent",
                          color: t.text2, fontSize: 12, fontWeight: 600,
                        }}
                      >
                        <Loader2 size={12} /> إعادة إنشاء
                      </button>
                    </>
                  )}
                  {editMode && (
                    <>
                      <button
                        onClick={saveEdit}
                        disabled={savingEdit}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "6px 14px", borderRadius: 8, cursor: savingEdit ? "wait" : "pointer",
                          border: "none", background: dark ? "#fff" : "#09090b",
                          color: dark ? "#09090b" : "#fff", fontSize: 12, fontWeight: 700,
                        }}
                      >
                        {savingEdit
                          ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                          : <Save size={12} />
                        }
                        {savingEdit ? "جاري الحفظ..." : "حفظ"}
                      </button>
                      <button
                        onClick={() => { setEditMode(false); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${t.border2}`, background: "transparent",
                          color: t.text3, fontSize: 12, fontWeight: 600,
                        }}
                      >
                        <X size={12} /> إلغاء
                      </button>
                    </>
                  )}
                  {!editMode && (
                    <div
                      style={{ cursor: "pointer", padding: 4 }}
                      onClick={() => { if (!showPreview) { loadPreview(); } else { setShowPreview(false); } }}
                    >
                      {previewLoading
                        ? <Loader2 size={16} color={t.text3} style={{ animation: "spin 1s linear infinite" }} />
                        : <ChevronDown size={16} color={t.text3} style={{ transform: showPreview ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                      }
                    </div>
                  )}
                </div>
              </div>

              {showPreview && previewLoading && (
                <div style={{ padding: 48, textAlign: "center" }}>
                  <Loader2 size={26} color={t.text3} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              )}

              {showPreview && !previewLoading && editMode && (
                <div style={{ padding: "16px 20px 20px" }}>
                  <p style={{ margin: "0 0 10px", color: t.text3, fontSize: 12 }}>
                    عدّل نص رسالتك مباشرة — يُحفظ ويُستخدم في جميع تقديماتك القادمة
                  </p>
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    dir="rtl"
                    rows={12}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "14px 16px", borderRadius: 12,
                      border: `1px solid ${t.border2}`,
                      background: t.bg, color: t.text,
                      fontSize: 14, lineHeight: 2,
                      fontFamily: "'IBM Plex Sans Arabic', Tahoma, sans-serif",
                      resize: "vertical", outline: "none",
                    }}
                    placeholder="اكتب نص رسالة التقديم هنا..."
                  />
                  <p style={{ margin: "8px 0 0", color: t.text3, fontSize: 11 }}>
                    💡 اكتب فقرات مفصولة بسطر فارغ. التحية والتوقيع يُضافان تلقائياً.
                  </p>
                </div>
              )}

              {showPreview && !previewLoading && !editMode && previewHtml && (
                <iframe
                  srcDoc={previewHtml}
                  title="معاينة رسالة التقديم"
                  style={{ width: "100%", height: 480, border: "none", display: "block" }}
                  sandbox="allow-same-origin"
                />
              )}
            </div>

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
      <div>{children}</div>
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
          <span style={{ padding: "2px 8px", borderRadius: 100, background: "#f0fdf4", color: "#166534", fontSize: 11, fontWeight: 600 }}>
            {badge}
          </span>
        )}
        <span style={{ color: t.text, fontSize: 14, fontWeight: 500 }} dir={dir}>{value}</span>
      </div>
    </div>
  );
}
