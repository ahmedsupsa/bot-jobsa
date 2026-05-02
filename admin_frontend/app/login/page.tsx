"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ArrowRight, Loader2, User } from "lucide-react";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(() => {
    const e = searchParams?.get("error");
    if (e === "no_session") return "فشل تسجيل الدخول بـ Google — حاول مرة أخرى";
    if (e === "session_error") return "خطأ في إنشاء الجلسة";
    if (e === "OAuthAccountNotLinked") return "هذا الإيميل غير مصرح له بالدخول";
    if (e === "AccessDenied") return "غير مصرح لك بالدخول";
    return "";
  });

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

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      const res = await fetch("/api/auth/csrf");
      const { csrfToken } = await res.json();
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/auth/signin/google";
      const csrfInput = document.createElement("input");
      csrfInput.type = "hidden"; csrfInput.name = "csrfToken"; csrfInput.value = csrfToken;
      const callbackInput = document.createElement("input");
      callbackInput.type = "hidden"; callbackInput.name = "callbackUrl"; callbackInput.value = "/api/auth/google-complete";
      form.appendChild(csrfInput);
      form.appendChild(callbackInput);
      document.body.appendChild(form);
      form.submit();
    } catch {
      setGoogleLoading(false);
      setError("تعذّر فتح نافذة Google — حاول مجدداً");
    }
  }

  return (
    <div style={s.formBox}>
      <div style={s.formIcon}><Lock size={22} strokeWidth={1.5} color="#0a0a0a" /></div>
      <h2 style={s.formTitle}>تسجيل الدخول</h2>
      <p style={s.formSub}>أدخل بيانات الدخول الخاصة بك</p>

      <button
        style={s.googleBtn}
        onClick={handleGoogleLogin}
        disabled={googleLoading || loading}
        type="button"
      >
        {googleLoading
          ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          : <GoogleIcon />}
        {googleLoading ? "جاري التوجيه…" : "الدخول بحساب Google"}
      </button>

      <div style={s.divider}>
        <div style={s.dividerLine} />
        <span style={s.dividerText}>أو بكلمة المرور</span>
        <div style={s.dividerLine} />
      </div>

      <form onSubmit={handleSubmit}>
        <label style={s.label}>اسم المستخدم <span style={{ color: "#666", fontWeight: 400 }}>(اختياري للمدير العام)</span></label>
        <div style={s.inputWrap}>
          <User size={16} strokeWidth={1.5} color="#555" style={s.inputIcon} />
          <input
            type="text" style={s.input} dir="ltr"
            placeholder="username" value={username} autoComplete="username"
            onChange={e => setUsername(e.target.value)}
          />
        </div>
        <label style={{ ...s.label, marginTop: 14 }}>كلمة المرور</label>
        <div style={s.inputWrap}>
          <Lock size={16} strokeWidth={1.5} color="#555" style={s.inputIcon} />
          <input
            type="password" style={s.input} dir="ltr"
            placeholder="••••••••" value={password} autoComplete="current-password"
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        {error && <div style={s.error}>{error}</div>}
        <button style={s.btn} type="submit" disabled={loading || googleLoading || !password}>
          {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
          {loading ? "جاري التحقق…" : "دخول"}
          {!loading && <ArrowRight size={16} strokeWidth={2} />}
        </button>
      </form>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <div className="login-split">
      <div className="login-right">
        <Suspense fallback={<div style={{ width: "100%", maxWidth: 400 }} />}>
          <LoginForm />
        </Suspense>
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
  formSub: { color: "var(--text3)", fontSize: 14, margin: "0 0 24px" },
  googleBtn: {
    width: "100%", padding: "13px 16px",
    background: "#fff", border: "1.5px solid var(--border)",
    borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    color: "#1a1a1a", transition: "background 0.2s, box-shadow 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  divider: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0" },
  dividerLine: { flex: 1, height: 1, background: "var(--border)" },
  dividerText: { color: "var(--text3)", fontSize: 13, whiteSpace: "nowrap" as const },
  label: { display: "block", color: "var(--text2)", fontSize: 13, fontWeight: 500, marginBottom: 8 },
  inputWrap: { position: "relative", display: "flex", alignItems: "center", marginBottom: 4 },
  inputIcon: { position: "absolute", right: 14, color: "var(--text4)", display: "flex", alignItems: "center" } as React.CSSProperties,
  input: {
    width: "100%", padding: "13px 42px 13px 16px",
    background: "var(--input-bg)", border: "1px solid var(--border)",
    borderRadius: 12, color: "var(--text)", fontSize: 16, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
    WebkitAppearance: "none",
  },
  btn: {
    width: "100%", padding: "14px", marginTop: 20,
    background: "var(--accent)", color: "var(--accent-fg)", border: "none", borderRadius: 12,
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    transition: "opacity 0.2s", WebkitAppearance: "none",
  },
  error: {
    background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)",
    borderRadius: 10, padding: "10px 14px", fontSize: 13, margin: "10px 0",
  },
};
