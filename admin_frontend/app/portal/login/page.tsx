"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/portal-auth";
import {
  KeyRound, ArrowRight, Loader2,
  User, Phone, MapPin, Calendar, ChevronLeft, Mail,
} from "lucide-react";

type Tab = "email" | "code";
type Step = "tab" | "register";

export default function PortalLogin() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("email");
  const [step, setStep] = useState<Step>("tab");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeId, setCodeId] = useState("");
  const [subDays, setSubDays] = useState(30);
  const [form, setForm] = useState({ full_name: "", phone: "", age: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/portal/login-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "خطأ"); return; }
      setToken(data.token);
      router.replace("/portal/dashboard");
    } catch { setError("خطأ في الاتصال بالخادم"); }
    finally { setLoading(false); }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "خطأ"); return; }
      if (data.status === "ok") { setToken(data.token); router.replace("/portal/dashboard"); }
      else if (data.status === "needs_registration") { setCodeId(data.code_id); setSubDays(data.subscription_days || 30); setStep("register"); }
    } catch { setError("خطأ في الاتصال بالخادم"); }
    finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code_id: codeId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "خطأ"); return; }
      setToken(data.token); router.replace("/portal/dashboard");
    } catch { setError("خطأ في الاتصال بالخادم"); }
    finally { setLoading(false); }
  }

  const regFields = [
    { key: "full_name", label: "الاسم الكامل", placeholder: "أحمد محمد", icon: <User size={16} strokeWidth={1.5} /> },
    { key: "phone", label: "رقم الجوال", placeholder: "05xxxxxxxx", icon: <Phone size={16} strokeWidth={1.5} />, dir: "ltr" },
    { key: "age", label: "العمر", placeholder: "25", icon: <Calendar size={16} strokeWidth={1.5} />, type: "number" },
    { key: "city", label: "المدينة", placeholder: "الرياض", icon: <MapPin size={16} strokeWidth={1.5} /> },
  ];

  return (
    <div className="login-split">
      {/* Right panel */}
      <div className="login-right">
        <div style={s.formBox}>
          {step === "register" ? (
            <>
              <div style={s.formIcon}><User size={22} strokeWidth={1.5} color="var(--accent-fg)" /></div>
              <h2 style={s.formTitle}>أكمل التسجيل</h2>
              <p style={s.formSub}>اشتراك {subDays} يوم — أدخل بياناتك للبدء</p>
              <form onSubmit={handleRegister} style={{ marginTop: 24 }}>
                {regFields.map(({ key, label, placeholder, icon, dir, type }) => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <label style={s.label}>{label}</label>
                    <div style={s.inputWrap}>
                      <span style={s.inputIcon}>{icon}</span>
                      <input
                        style={s.input} type={type || "text"} dir={dir as any}
                        placeholder={placeholder}
                        value={form[key as keyof typeof form]}
                        onChange={e => setForm({ ...form, [key]: e.target.value })}
                        inputMode={type === "number" ? "numeric" : undefined}
                      />
                    </div>
                  </div>
                ))}
                {error && <div style={s.error}>{error}</div>}
                <button style={s.btn} type="submit" disabled={loading || !form.full_name || !form.phone || !form.city}>
                  {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
                  {loading ? "جاري الإنشاء…" : "إنشاء الحساب"}
                  {!loading && <ArrowRight size={16} strokeWidth={2} />}
                </button>
                <button style={s.btnBack} type="button" onClick={() => { setStep("tab"); setError(""); }}>
                  <ChevronLeft size={16} strokeWidth={2} /> رجوع
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={s.formIcon}>
                {tab === "email"
                  ? <Mail size={22} strokeWidth={1.5} color="var(--accent-fg)" />
                  : <KeyRound size={22} strokeWidth={1.5} color="var(--accent-fg)" />}
              </div>
              <h2 style={s.formTitle}>مرحباً بك</h2>
              <p style={s.formSub}>سجّل دخولك للوصول إلى حسابك</p>

              {/* Tabs */}
              <div style={s.tabs}>
                <button style={{ ...s.tab, ...(tab === "email" ? s.tabActive : {}) }} onClick={() => { setTab("email"); setError(""); }}>
                  مسجّل من قبل
                </button>
                <button style={{ ...s.tab, ...(tab === "code" ? s.tabActive : {}) }} onClick={() => { setTab("code"); setError(""); }}>
                  مشترك جديد
                </button>
              </div>

              {tab === "email" ? (
                <form onSubmit={handleEmailSubmit} style={{ marginTop: 20 }}>
                  <label style={s.label}>البريد الإلكتروني</label>
                  <div style={s.inputWrap}>
                    <Mail size={16} strokeWidth={1.5} color="var(--text4)" style={s.inputIcon} />
                    <input
                      style={s.input} type="email" dir="ltr"
                      value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="example@email.com" autoFocus
                      inputMode="email"
                      autoComplete="email"
                    />
                  </div>
                  {error && <div style={s.error}>{error}</div>}
                  <button style={s.btn} type="submit" disabled={loading || !email.trim()}>
                    {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
                    {loading ? "جاري التحقق…" : "دخول"}
                    {!loading && <ArrowRight size={16} strokeWidth={2} />}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCodeSubmit} style={{ marginTop: 20 }}>
                  <label style={s.label}>كود التفعيل</label>
                  <div style={s.inputWrap}>
                    <KeyRound size={16} strokeWidth={1.5} color="var(--text4)" style={s.inputIcon} />
                    <input
                      style={s.input} dir="ltr"
                      value={code} onChange={e => setCode(e.target.value)}
                      placeholder="أدخل كود التفعيل هنا" autoFocus
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="off"
                    />
                  </div>
                  {error && <div style={s.error}>{error}</div>}
                  <button style={s.btn} type="submit" disabled={loading || !code.trim()}>
                    {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
                    {loading ? "جاري التحقق…" : "دخول"}
                    {!loading && <ArrowRight size={16} strokeWidth={2} />}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  formBox: { width: "100%", maxWidth: 400 },
  formIcon: {
    width: 52, height: 52, borderRadius: 14, background: "var(--accent)",
    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  formTitle: { color: "var(--text)", fontSize: 26, fontWeight: 700, margin: "0 0 6px" },
  formSub: { color: "var(--text3)", fontSize: 14, margin: 0 },
  tabs: {
    display: "flex", gap: 8, marginTop: 24,
    background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 12, padding: 4,
  },
  tab: {
    flex: 1, padding: "10px 0", border: "none", borderRadius: 10,
    background: "transparent", color: "var(--text3)", fontSize: 13, fontWeight: 600, cursor: "pointer",
    transition: "all 0.2s", fontFamily: "inherit",
  },
  tabActive: { background: "var(--accent)", color: "var(--accent-fg)" },
  label: { display: "block", color: "var(--text2)", fontSize: 13, fontWeight: 500, marginBottom: 8, marginTop: 16 },
  inputWrap: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: { position: "absolute", right: 14, color: "var(--text4)", display: "flex", alignItems: "center", zIndex: 1 } as any,
  input: {
    width: "100%", padding: "13px 42px 13px 16px",
    background: "var(--input-bg)", border: "1px solid var(--border2)",
    borderRadius: 12, color: "var(--text)", fontSize: 16, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
    WebkitAppearance: "none",
  },
  btn: {
    width: "100%", padding: "14px", marginTop: 20,
    background: "var(--accent)", color: "var(--accent-fg)", border: "none", borderRadius: 12,
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    transition: "opacity 0.2s", fontFamily: "inherit", WebkitAppearance: "none",
  },
  btnBack: {
    width: "100%", padding: "12px", marginTop: 10,
    background: "transparent", border: "1px solid var(--border2)",
    borderRadius: 12, color: "var(--text3)", fontSize: 14, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    fontFamily: "inherit",
  },
  error: {
    background: "rgba(248,113,113,0.08)", color: "#dc2626", border: "1px solid rgba(248,113,113,0.3)",
    borderRadius: 10, padding: "10px 14px", fontSize: 13, margin: "10px 0",
  },
};
