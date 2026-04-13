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
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>💼</span>
          <h1 style={styles.logoText}>جبسا</h1>
          <p style={styles.logoSub}>بوابة المستخدمين</p>
        </div>

        {step === "code" ? (
          <form onSubmit={handleCodeSubmit}>
            <p style={styles.label}>أدخل كود التفعيل</p>
            <input
              style={styles.input}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="مثال: ABC-12345"
              autoFocus
              dir="ltr"
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.btn} type="submit" disabled={loading || !code.trim()}>
              {loading ? "جاري التحقق…" : "متابعة ←"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <p style={styles.label}>أكمل بيانات التسجيل</p>
            <p style={styles.subLabel}>اشتراك {subDays} يوم</p>
            {[
              { key: "full_name", label: "الاسم الكامل", placeholder: "أحمد محمد العمري" },
              { key: "phone", label: "رقم الجوال", placeholder: "05xxxxxxxx", dir: "ltr" },
              { key: "age", label: "العمر", placeholder: "25", type: "number" },
              { key: "city", label: "المدينة", placeholder: "الرياض" },
            ].map(({ key, label, placeholder, dir, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={styles.fieldLabel}>{label}</label>
                <input
                  style={styles.input}
                  type={type || "text"}
                  dir={dir as any}
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            {error && <p style={styles.error}>{error}</p>}
            <button
              style={styles.btn}
              type="submit"
              disabled={loading || !form.full_name || !form.phone || !form.city}
            >
              {loading ? "جاري التسجيل…" : "إنشاء الحساب ✓"}
            </button>
            <button
              style={styles.btnBack}
              type="button"
              onClick={() => { setStep("code"); setError(""); }}
            >
              ← رجوع
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#060b18",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "system-ui, -apple-system, sans-serif",
    direction: "rtl",
  },
  card: {
    background: "#0d1628",
    border: "1px solid #1a2d52",
    borderRadius: 16,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
  logo: { textAlign: "center", marginBottom: 32 },
  logoIcon: { fontSize: 48 },
  logoText: { color: "#fff", fontSize: 28, fontWeight: 700, margin: "8px 0 4px" },
  logoSub: { color: "#7a9cc5", fontSize: 14, margin: 0 },
  label: { color: "#c0d4f0", fontSize: 16, marginBottom: 16, fontWeight: 600 },
  subLabel: { color: "#4f8ef7", fontSize: 13, marginBottom: 20, marginTop: -10 },
  fieldLabel: { color: "#8aa8cc", fontSize: 13, display: "block", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "12px 14px",
    background: "#111e38",
    border: "1px solid #1a2d52",
    borderRadius: 10,
    color: "#e8f0ff",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 4,
  },
  btn: {
    width: "100%",
    padding: "13px",
    background: "#4f8ef7",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 16,
    transition: "opacity 0.2s",
  },
  btnBack: {
    width: "100%",
    padding: "11px",
    background: "transparent",
    color: "#7a9cc5",
    border: "1px solid #1a2d52",
    borderRadius: 10,
    fontSize: 14,
    cursor: "pointer",
    marginTop: 10,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    margin: "8px 0",
    padding: "10px 14px",
    background: "rgba(248,113,113,0.1)",
    borderRadius: 8,
  },
};
