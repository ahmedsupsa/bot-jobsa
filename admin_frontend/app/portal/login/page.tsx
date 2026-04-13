"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/portal-auth";

type Step = "code" | "register";

export default function PortalLogin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [codeId, setCodeId] = useState("");
  const [subDays, setSubDays] = useState(30);
  const [form, setForm] = useState({ full_name: "", phone: "", age: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "خطأ"); return; }
      if (data.status === "ok") {
        setToken(data.token);
        router.replace("/portal/dashboard");
      } else if (data.status === "needs_registration") {
        setCodeId(data.code_id);
        setSubDays(data.subscription_days || 30);
        setStep("register");
      }
    } catch {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code_id: codeId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "خطأ"); return; }
      setToken(data.token);
      router.replace("/portal/dashboard");
    } catch {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page} className="portal-root">
      {/* Left decorative panel */}
      <div style={s.leftPanel}>
        <div style={s.leftContent}>
          <div style={s.brandIcon}>💼</div>
          <h1 style={s.brandTitle}>جبسا</h1>
          <p style={s.brandTagline}>التقديم التلقائي على الوظائف بالذكاء الاصطناعي</p>
          <div style={s.features}>
            {[
              { icon: "🤖", text: "تقديم تلقائي كل 30 دقيقة" },
              { icon: "✍️", text: "رسائل تغطية مخصصة بالذكاء الاصطناعي" },
              { icon: "📊", text: "تتبع جميع تقديماتك بسهولة" },
            ].map((f, i) => (
              <div key={i} style={s.featureItem}>
                <span style={s.featureIcon}>{f.icon}</span>
                <span style={s.featureText}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={s.blob1} />
        <div style={s.blob2} />
      </div>

      {/* Right form panel */}
      <div style={s.rightPanel}>
        <div style={s.formCard}>
          {step === "code" ? (
            <>
              <h2 style={s.formTitle}>مرحباً بك 👋</h2>
              <p style={s.formSub}>أدخل كود التفعيل للدخول إلى حسابك</p>
              <form onSubmit={handleCodeSubmit}>
                <label style={s.label}>كود التفعيل</label>
                <input
                  style={s.input}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="أدخل الكود هنا…"
                  autoFocus
                  dir="ltr"
                />
                {error && <div style={s.error}>{error}</div>}
                <button style={s.btn} type="submit" disabled={loading || !code.trim()}>
                  {loading ? "جاري التحقق…" : "دخول ←"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 style={s.formTitle}>أكمل التسجيل ✨</h2>
              <p style={s.formSub}>اشتراك {subDays} يوم — أدخل بياناتك للبدء</p>
              <form onSubmit={handleRegister}>
                {[
                  { key: "full_name", label: "الاسم الكامل", placeholder: "أحمد محمد" },
                  { key: "phone", label: "رقم الجوال", placeholder: "05xxxxxxxx", dir: "ltr" },
                  { key: "age", label: "العمر", placeholder: "25", type: "number" },
                  { key: "city", label: "المدينة", placeholder: "الرياض" },
                ].map(({ key, label, placeholder, dir, type }) => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <label style={s.label}>{label}</label>
                    <input
                      style={s.input}
                      type={type || "text"}
                      dir={dir as any}
                      placeholder={placeholder}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </div>
                ))}
                {error && <div style={s.error}>{error}</div>}
                <button
                  style={s.btn}
                  type="submit"
                  disabled={loading || !form.full_name || !form.phone || !form.city}
                >
                  {loading ? "جاري الإنشاء…" : "إنشاء الحساب ✓"}
                </button>
                <button style={s.btnBack} type="button" onClick={() => { setStep("code"); setError(""); }}>
                  ← رجوع
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const GRAD = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)";

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    direction: "rtl",
    fontFamily: "system-ui, -apple-system, sans-serif",
    background: "#f5f3ff",
  },
  leftPanel: {
    flex: 1,
    background: GRAD,
    padding: "60px 48px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    minWidth: 320,
  },
  leftContent: { position: "relative", zIndex: 2 },
  brandIcon: { fontSize: 56, marginBottom: 16 },
  brandTitle: { color: "#fff", fontSize: 40, fontWeight: 800, margin: "0 0 8px" },
  brandTagline: { color: "rgba(255,255,255,0.85)", fontSize: 16, margin: "0 0 40px", lineHeight: 1.6 },
  features: { display: "flex", flexDirection: "column", gap: 16 },
  featureItem: {
    display: "flex", alignItems: "center", gap: 12,
    background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
    borderRadius: 12, padding: "12px 16px",
  },
  featureIcon: { fontSize: 20 },
  featureText: { color: "#fff", fontSize: 14, fontWeight: 500 },
  blob1: {
    position: "absolute", top: -80, left: -80, width: 300, height: 300,
    borderRadius: "50%", background: "rgba(255,255,255,0.08)", zIndex: 1,
  },
  blob2: {
    position: "absolute", bottom: -60, right: -60, width: 220, height: 220,
    borderRadius: "50%", background: "rgba(255,255,255,0.06)", zIndex: 1,
  },
  rightPanel: {
    width: 460,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 32px",
    background: "#f5f3ff",
    flexShrink: 0,
  },
  formCard: {
    width: "100%",
    background: "#fff",
    borderRadius: 20,
    padding: "40px 36px",
    boxShadow: "0 8px 40px rgba(99,102,241,0.12)",
  },
  formTitle: { color: "#1e1b4b", fontSize: 26, fontWeight: 700, margin: "0 0 6px" },
  formSub: { color: "#7c3aed", fontSize: 14, margin: "0 0 28px" },
  label: { display: "block", color: "#4c1d95", fontSize: 13, fontWeight: 600, marginBottom: 8 },
  input: {
    width: "100%", padding: "13px 16px",
    border: "2px solid #ede9fe", borderRadius: 12,
    fontSize: 15, color: "#1e1b4b", outline: "none",
    background: "#faf9ff", boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  btn: {
    width: "100%", padding: "14px",
    background: GRAD, color: "#fff",
    border: "none", borderRadius: 12, fontSize: 15,
    fontWeight: 700, cursor: "pointer", marginTop: 20,
    boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
  },
  btnBack: {
    width: "100%", padding: "12px",
    background: "transparent", border: "2px solid #ede9fe",
    borderRadius: 12, color: "#7c3aed", fontSize: 14,
    cursor: "pointer", marginTop: 10, fontWeight: 500,
  },
  error: {
    background: "#fef2f2", color: "#dc2626",
    border: "1px solid #fecaca", borderRadius: 10,
    padding: "10px 14px", fontSize: 13, margin: "10px 0",
  },
};
