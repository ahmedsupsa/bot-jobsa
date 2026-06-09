"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Lock, ArrowLeft, Loader2, User, Zap, ShieldCheck } from "lucide-react";

const features = [
  { icon: Zap,         text: "إدارة الوظائف والتقديمات تلقائياً" },
  { icon: ShieldCheck, text: "لوحة تحكم آمنة ومتكاملة" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "بيانات الدخول غير صحيحة"); return; }
      router.replace("/admin");
    } catch { setError("خطأ في الاتصال بالخادم"); }
    finally { setLoading(false); }
  }

  return (
    <div style={s.formBox}>
      <div style={s.brand}>
        <Image src="/logo-transparent.png" alt="Jobbots" width={28} height={28} style={{ borderRadius: 6 }} />
        <span style={s.brandName}>Jobbots</span>
      </div>

      <h2 style={s.formTitle}>مرحباً بعودتك</h2>
      <p style={s.formSub}>أدخل اسم المستخدم وكلمة المرور</p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={s.label}>اسم المستخدم</label>
          <div style={s.inputWrap}>
            <User size={15} strokeWidth={1.6} color="var(--text4)" style={s.inputIcon} />
            <input
              type="text" style={s.input} dir="ltr"
              placeholder="username" value={username} autoComplete="username"
              onChange={e => setUsername(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label style={s.label}>كلمة المرور</label>
          <div style={s.inputWrap}>
            <Lock size={15} strokeWidth={1.6} color="var(--text4)" style={s.inputIcon} />
            <input
              type={showPass ? "text" : "password"} style={{ ...s.input, paddingLeft: 42 }}
              dir="ltr"
              placeholder="••••••••" value={password} autoComplete="current-password"
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              style={s.eyeBtn}
              tabIndex={-1}
            >
              {showPass ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div style={s.error}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <button style={{ ...s.btn, opacity: loading || !password ? 0.6 : 1 }} type="submit" disabled={loading || !password}>
          {loading
            ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /><span>جاري التحقق…</span></>
            : <><span>دخول</span><ArrowLeft size={15} strokeWidth={2.2} /></>}
        </button>
      </form>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <>
      <div className="login-split" dir="rtl">
        <div className="login-left">
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "auto" }}>
              <Image src="/logo-transparent.png" alt="Jobbots" width={36} height={36} style={{ borderRadius: 8 }} />
              <span style={{ color: "white", fontWeight: 800, fontSize: 18, letterSpacing: "-0.3px" }}>Jobbots</span>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>لوحة الإدارة</div>
              <h1 style={{ color: "white", fontSize: "clamp(26px,3vw,34px)", fontWeight: 900, lineHeight: 1.2, margin: "0 0 14px", letterSpacing: "-0.5px" }}>
                منصة التقديم<br />التلقائي على الوظائف
              </h1>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 1.7, margin: "0 0 36px" }}>
                أدِر المستخدمين والوظائف والتقديمات من مكان واحد
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {features.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <f.icon size={16} color="rgba(255,255,255,0.9)" />
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13.5, fontWeight: 500 }}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: "auto", paddingTop: 32 }}>
              © 2026 Jobbots — جميع الحقوق محفوظة
            </div>
          </div>
        </div>

        <div className="login-right">
          <Suspense fallback={<div style={{ width: "100%", maxWidth: 420 }} />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
      <footer style={{
        textAlign: "center", padding: "16px 20px",
        background: "#0a0a0a", color: "rgba(255,255,255,0.25)",
        fontSize: 12, borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        © {new Date().getFullYear()} Jobbots — جميع الحقوق محفوظة
      </footer>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  formBox: { width: "100%", maxWidth: 420 },
  brand: { display: "flex", alignItems: "center", gap: 10, marginBottom: 32 },
  brandName: { color: "var(--text)", fontSize: 16, fontWeight: 800, letterSpacing: "-0.3px" },
  formTitle: { color: "var(--text)", fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.4px" },
  formSub: { color: "var(--text3)", fontSize: 14, margin: "0 0 28px", lineHeight: 1.5 },
  label: { display: "block", color: "var(--text2)", fontSize: 13, fontWeight: 600, marginBottom: 8 },
  inputWrap: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: { position: "absolute", right: 14, pointerEvents: "none", flexShrink: 0 } as React.CSSProperties,
  input: {
    width: "100%", padding: "13px 42px 13px 16px",
    background: "var(--input-bg)", border: "1.5px solid var(--border)",
    borderRadius: 14, color: "var(--text)", fontSize: 15, outline: "none",
    boxSizing: "border-box" as const, transition: "border-color 0.18s",
    WebkitAppearance: "none", fontFamily: "inherit",
  },
  eyeBtn: {
    position: "absolute", left: 14, background: "none", border: "none",
    cursor: "pointer", color: "var(--text4)", display: "flex", alignItems: "center", padding: 2,
  } as React.CSSProperties,
  btn: {
    width: "100%", padding: "14px", marginTop: 4,
    background: "var(--accent)", color: "var(--accent-fg)", border: "none", borderRadius: 14,
    fontSize: 15, fontWeight: 800, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    transition: "opacity 0.18s", WebkitAppearance: "none", letterSpacing: "-0.2px",
  },
  error: {
    background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)",
    borderRadius: 12, padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8,
  },
};
