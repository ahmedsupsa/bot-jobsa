"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, Briefcase, Key, Users, BriefcaseBusiness, Megaphone, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
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
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "كلمة المرور غير صحيحة"); return; }
      router.replace("/admin");
    } catch { setError("خطأ في الاتصال بالخادم"); }
    finally { setLoading(false); }
  }

  const features = [
    { icon: <Key size={18} strokeWidth={1.5} />, text: "إدارة أكواد التفعيل" },
    { icon: <Users size={18} strokeWidth={1.5} />, text: "متابعة المستخدمين" },
    { icon: <BriefcaseBusiness size={18} strokeWidth={1.5} />, text: "إدارة الوظائف" },
    { icon: <Megaphone size={18} strokeWidth={1.5} />, text: "نشر الإعلانات" },
  ];

  return (
    <div className="login-split">
      {/* Left panel */}
      <div className="login-left">
        <div style={s.brand}>
          <div style={s.brandLogo}><Briefcase size={28} strokeWidth={1.5} color="#0a0a0a" /></div>
          <h1 style={s.brandName}>Jobbots</h1>
        </div>
        <p style={s.brandTagline}>لوحة تحكم الإدارة<br />أدِر المنصة بكل سهولة</p>
        <div style={s.featureList}>
          {features.map((f, i) => (
            <div key={i} style={s.featureRow}>
              <div style={s.featureIconWrap}>{f.icon}</div>
              <span style={s.featureText}>{f.text}</span>
            </div>
          ))}
        </div>
        <div style={s.grid} />
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div style={s.formBox}>
          <div style={s.formIcon}><Lock size={22} strokeWidth={1.5} color="#0a0a0a" /></div>
          <h2 style={s.formTitle}>تسجيل الدخول</h2>
          <p style={s.formSub}>أدخل كلمة مرور الأدمن</p>
          <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
            <label style={s.label}>كلمة المرور</label>
            <div style={s.inputWrap}>
              <Lock size={16} strokeWidth={1.5} color="#555" style={s.inputIcon} />
              <input
                type="password" style={s.input} dir="ltr"
                placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} autoFocus
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
  brand: { display: "flex", alignItems: "center", gap: 14, marginBottom: 24, position: "relative", zIndex: 1 },
  brandLogo: {
    width: 52, height: 52, borderRadius: 14, background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  brandName: { color: "#fff", fontSize: 32, fontWeight: 800, margin: 0 },
  brandTagline: { color: "#888", fontSize: 16, lineHeight: 1.7, margin: "0 0 40px", position: "relative", zIndex: 1 },
  featureList: { display: "flex", flexDirection: "column", gap: 14, position: "relative", zIndex: 1 },
  featureRow: {
    display: "flex", alignItems: "center", gap: 14,
    background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: "14px 18px",
  },
  featureIconWrap: {
    width: 36, height: 36, borderRadius: 10, background: "#222",
    display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0,
  },
  featureText: { color: "#ccc", fontSize: 14, fontWeight: 500 },
  grid: {
    position: "absolute", bottom: 0, left: 0, right: 0, top: 0,
    backgroundImage: "radial-gradient(circle, #222 1px, transparent 1px)",
    backgroundSize: "28px 28px", opacity: 0.25, zIndex: 0, pointerEvents: "none",
  },
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
