"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, Loader2, User } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="login-split">
      {/* Right panel */}
      <div className="login-right">
        <div style={s.formBox}>
          <div style={s.formIcon}><Lock size={22} strokeWidth={1.5} color="#0a0a0a" /></div>
          <h2 style={s.formTitle}>تسجيل الدخول</h2>
          <p style={s.formSub}>أدخل بيانات الدخول الخاصة بك</p>
          <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
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
            <button style={s.btn} type="submit" disabled={loading || !password}>
              {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
              {loading ? "جاري التحقق…" : "دخول"}
              {!loading && <ArrowRight size={16} strokeWidth={2} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  formBox: { width: "100%", maxWidth: 400 },
  formIcon: {
    width: 52, height: 52, borderRadius: 14, background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  formTitle: { color: "#fff", fontSize: 26, fontWeight: 700, margin: "0 0 6px" },
  formSub: { color: "#888", fontSize: 14, margin: 0 },
  label: { display: "block", color: "#aaa", fontSize: 13, fontWeight: 500, marginBottom: 8 },
  inputWrap: { position: "relative", display: "flex", alignItems: "center", marginBottom: 4 },
  inputIcon: { position: "absolute", right: 14, color: "#444", display: "flex", alignItems: "center" } as any,
  input: {
    width: "100%", padding: "13px 42px 13px 16px",
    background: "#141414", border: "1px solid #2a2a2a",
    borderRadius: 12, color: "#fff", fontSize: 16, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
    WebkitAppearance: "none",
  },
  btn: {
    width: "100%", padding: "14px", marginTop: 20,
    background: "#fff", color: "#0a0a0a", border: "none", borderRadius: 12,
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    transition: "opacity 0.2s", WebkitAppearance: "none",
  },
  error: {
    background: "#1a0a0a", color: "#f87171", border: "1px solid #3f1515",
    borderRadius: 10, padding: "10px 14px", fontSize: 13, margin: "10px 0",
  },
};
