"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { setToken } from "@/lib/portal-auth";
import {
  KeyRound, ArrowRight, Loader2,
  User, Phone, MapPin, Calendar, ChevronRight,
  Mail, Sparkles, ShieldCheck, Zap,
} from "lucide-react";

type Step = "login" | "register";

export default function PortalLogin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("login");
  const [value, setValue] = useState("");
  const [codeId, setCodeId] = useState("");
  const [subDays, setSubDays] = useState(30);
  const [form, setForm] = useState({ full_name: "", phone: "", age: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEmail = value.includes("@");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (isEmail) {
        const res = await fetch("/api/portal/login-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: value.trim() }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "البريد غير مرتبط بأي حساب"); return; }
        setToken(data.token);
        router.replace("/portal/dashboard");
      } else {
        const res = await fetch("/api/portal/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: value.trim() }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "الكود غير صالح أو مستخدم"); return; }
        if (data.status === "ok") { setToken(data.token); router.replace("/portal/dashboard"); }
        else if (data.status === "needs_registration") {
          setCodeId(data.code_id); setSubDays(data.subscription_days || 30); setStep("register");
        }
      }
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
    { key: "full_name", label: "الاسم الكامل", icon: <User size={15} strokeWidth={1.5} /> },
    { key: "phone", label: "رقم الجوال", icon: <Phone size={15} strokeWidth={1.5} />, dir: "ltr" },
    { key: "age", label: "العمر", icon: <Calendar size={15} strokeWidth={1.5} />, type: "number" },
    { key: "city", label: "المدينة", icon: <MapPin size={15} strokeWidth={1.5} /> },
  ];

  const yr = new Date().getFullYear();

  return (
    <>
    <div className="login-split">
      {/* Left — Branding */}
      <div className="login-left">
        <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "auto" }}>
            <Image src="/logo-transparent.png" alt="Jobbots" width={34} height={34} style={{ borderRadius: 8 }} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 17, letterSpacing: "-0.3px" }}>Jobbots</span>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 40 }}>
            <h1 style={{
              color: "#fff", fontSize: 36, fontWeight: 800,
              lineHeight: 1.3, margin: "0 0 16px", letterSpacing: "-0.5px",
            }}>
              التقديم على الوظائف<br />
              <span style={{ color: "rgba(255,255,255,0.45)" }}>بشكل تلقائي</span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 1.7, margin: "0 0 40px", maxWidth: 320 }}>
              نقدّم نيابةً عنك على أنسب الوظائف يومياً — بدون تعب، بدون فوات فرص.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { icon: <Sparkles size={15} strokeWidth={2} />, text: "رسالة تغطية مخصّصة لكل وظيفة" },
                { icon: <ShieldCheck size={15} strokeWidth={2} />, text: "10 تقديمات يومية تلقائياً" },
                { icon: <Zap size={15} strokeWidth={2} />, text: "مطابقة ذكية بين سيرتك والوظيفة" },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.7)",
                  }}>{icon}</div>
                  <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 14 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>© 2026 Jobbots — جميع الحقوق محفوظة</p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="login-right">
        <div style={{ width: "100%", maxWidth: 400 }}>

          {step === "register" ? (
            <>
              <div style={s.iconWrap}>
                <User size={20} strokeWidth={1.5} color="#fff" />
              </div>
              <h2 style={s.title}>أكمل بياناتك</h2>
              <p style={s.sub}>اشتراك <strong>{subDays} يوم</strong> — خطوة أخيرة للبدء</p>

              <form onSubmit={handleRegister} style={{ marginTop: 24 }}>
                {regFields.map(({ key, label, icon, dir, type }) => (
                  <div key={key} style={{ marginBottom: 14 }}>
                    <label style={s.label}>{label}</label>
                    <div style={s.inputRow}>
                      <span style={s.inputIcon}>{icon}</span>
                      <input
                        style={s.input} type={type || "text"} dir={dir as any}
                        value={form[key as keyof typeof form]}
                        onChange={e => setForm({ ...form, [key]: e.target.value })}
                        inputMode={type === "number" ? "numeric" : undefined}
                      />
                    </div>
                  </div>
                ))}

                {error && <div style={s.error}>{error}</div>}

                <button style={s.btn} type="submit"
                  disabled={loading || !form.full_name || !form.phone || !form.city}>
                  {loading
                    ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> جاري الإنشاء…</>
                    : <>إنشاء الحساب <ArrowRight size={15} strokeWidth={2} /></>}
                </button>
                <button style={s.btnBack} type="button"
                  onClick={() => { setStep("login"); setError(""); }}>
                  <ChevronRight size={15} strokeWidth={2} /> رجوع
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={s.iconWrap}>
                {isEmail
                  ? <Mail size={20} strokeWidth={1.5} color="#fff" />
                  : <KeyRound size={20} strokeWidth={1.5} color="#fff" />}
              </div>
              <h2 style={s.title}>مرحباً بك</h2>
              <p style={s.sub}>أدخل كود التفعيل أو بريدك الإلكتروني</p>

              <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
                <div style={s.inputRow}>
                  <span style={s.inputIcon}>
                    {isEmail
                      ? <Mail size={15} strokeWidth={1.5} color="var(--text4)" />
                      : <KeyRound size={15} strokeWidth={1.5} color="var(--text4)" />}
                  </span>
                  <input
                    style={s.input}
                    dir={isEmail ? "ltr" : "ltr"}
                    value={value}
                    onChange={e => { setValue(e.target.value); setError(""); }}
                    placeholder="كود التفعيل أو البريد الإلكتروني"
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="email"
                    inputMode={isEmail ? "email" : "text"}
                  />
                </div>

                {value && (
                  <p style={s.hint}>
                    {isEmail ? "🔐 تسجيل دخول بالبريد الإلكتروني" : "🎟️ تفعيل اشتراك جديد بالكود"}
                  </p>
                )}

                {error && <div style={s.error}>{error}</div>}

                <button style={s.btn} type="submit" disabled={loading || !value.trim()}>
                  {loading
                    ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> جاري التحقق…</>
                    : <>دخول <ArrowRight size={15} strokeWidth={2} /></>}
                </button>
              </form>

              <p style={s.footer}>
                عندك كود تفعيل؟ أدخله مباشرة في الحقل أعلاه
              </p>
            </>
          )}
        </div>
      </div>
    </div>
      <footer style={{
        textAlign: "center", padding: "16px 20px",
        background: "#0a0a0a", color: "rgba(255,255,255,0.25)",
        fontSize: 12, borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        © {yr} Jobbots — جميع الحقوق محفوظة
      </footer>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  iconWrap: {
    width: 48, height: 48, borderRadius: 14,
    background: "var(--accent)", display: "flex",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: { color: "var(--text)", fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.3px" },
  sub: { color: "var(--text3)", fontSize: 14, margin: 0, lineHeight: 1.6 },
  label: { display: "block", color: "var(--text2)", fontSize: 13, fontWeight: 500, marginBottom: 6 },
  inputRow: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: {
    position: "absolute", right: 14,
    display: "flex", alignItems: "center", zIndex: 1, pointerEvents: "none",
  } as React.CSSProperties,
  input: {
    width: "100%", padding: "13px 44px 13px 16px",
    background: "var(--input-bg)", border: "1.5px solid var(--border2)",
    borderRadius: 12, color: "var(--text)", fontSize: 15, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
    WebkitAppearance: "none", fontFamily: "inherit",
  },
  hint: {
    margin: "8px 2px 0", fontSize: 12,
    color: "var(--text4)", fontWeight: 500,
  },
  btn: {
    width: "100%", padding: "14px", marginTop: 20,
    background: "var(--accent)", color: "var(--accent-fg)",
    border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 8, fontFamily: "inherit",
    transition: "opacity 0.2s", WebkitAppearance: "none",
  },
  btnBack: {
    width: "100%", padding: "12px", marginTop: 10,
    background: "transparent", border: "1.5px solid var(--border2)",
    borderRadius: 12, color: "var(--text3)", fontSize: 14,
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 6, fontFamily: "inherit",
  },
  error: {
    background: "var(--danger-bg)", color: "var(--danger)",
    border: "1px solid var(--danger-border)",
    borderRadius: 10, padding: "10px 14px", fontSize: 13, margin: "12px 0",
  },
  footer: {
    marginTop: 24, textAlign: "center" as const,
    color: "var(--text4)", fontSize: 12, lineHeight: 1.6,
  },
};
