"use client";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useTheme } from "@/contexts/theme-context";
import { portalFetch } from "@/lib/portal-auth";
import {
  Mail, Lock, CheckCircle, XCircle, Loader2,
  Send, Info, Eye, EyeOff,
} from "lucide-react";

interface SmtpStatus {
  smtp_email: string;
  email_connected: boolean;
  last_email_test_at: string | null;
}

export default function EmailPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  const [status, setStatus] = useState<SmtpStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [smtpEmail, setSmtpEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const t = {
    bg: dark ? "#0a0a0a" : "#f4f4f5",
    card: dark ? "#111" : "#fff",
    border: dark ? "#222" : "#e4e4e7",
    text: dark ? "#fff" : "#09090b",
    text2: dark ? "#aaa" : "#52525b",
    text3: dark ? "#666" : "#a1a1aa",
    input: dark ? "#1a1a1a" : "#fafafa",
    inputBorder: dark ? "#2a2a2a" : "#e4e4e7",
    green: "#22c55e",
    red: "#f87171",
    blue: "#3b82f6",
  };

  useEffect(() => {
    portalFetch("/smtp")
      .then(r => r.json())
      .then((d: SmtpStatus) => {
        setStatus(d);
        if (d.smtp_email) setSmtpEmail(d.smtp_email);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await portalFetch("/smtp", {
        method: "POST",
        body: JSON.stringify({ smtp_email: smtpEmail, app_password: appPassword }),
      });
      const d = await r.json();
      if (r.ok) {
        setSaveMsg({ ok: true, text: "تم الحفظ بنجاح ✓" });
        setAppPassword("");
        setStatus(prev => prev ? { ...prev, smtp_email: smtpEmail, email_connected: false } : null);
      } else {
        setSaveMsg({ ok: false, text: d.error || "فشل الحفظ" });
      }
    } catch {
      setSaveMsg({ ok: false, text: "خطأ في الاتصال بالخادم" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const r = await portalFetch("/smtp/test", { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setTestMsg({ ok: true, text: "تم الإرسال بنجاح! راجع بريدك الوارد ✓" });
        setStatus(prev => prev ? { ...prev, email_connected: true, last_email_test_at: new Date().toISOString() } : null);
      } else {
        setTestMsg({ ok: false, text: d.error || "فشل الاختبار" });
      }
    } catch {
      setTestMsg({ ok: false, text: "خطأ في الاتصال بالخادم" });
    } finally {
      setTesting(false);
    }
  }

  const isConnected = status?.email_connected;

  if (loading) {
    return (
      <PortalShell>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
          <Loader2 size={28} color={t.text3} style={{ animation: "spin 1s linear infinite" }} />
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <div style={{ maxWidth: 580, margin: "0 auto", padding: "0 4px" }}>

        {/* ─── العنوان ─── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: t.text, fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>
            ربط البريد الإلكتروني
          </h1>
          <p style={{ color: t.text2, fontSize: 14, margin: 0, lineHeight: 1.7 }}>
            أرسل تقديماتك التلقائية من بريدك الشخصي مباشرةً، بدون أي وسيط.
          </p>
        </div>

        {/* ─── بطاقة الحالة ─── */}
        <div style={{
          background: isConnected ? (dark ? "#0d1f0d" : "#f0fdf4") : (dark ? "#1a0d0d" : "#fff7ed"),
          border: `1px solid ${isConnected ? (dark ? "#1a4a1a" : "#bbf7d0") : (dark ? "#4a1a1a" : "#fed7aa")}`,
          borderRadius: 14, padding: "16px 20px", marginBottom: 24,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          {isConnected
            ? <CheckCircle size={28} color={t.green} strokeWidth={2} />
            : <XCircle size={28} color="#f97316" strokeWidth={2} />}
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: isConnected ? t.green : "#f97316" }}>
              {isConnected ? "البريد مربوط ويعمل ✓" : "البريد غير مربوط"}
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: t.text2 }}>
              {isConnected && status?.last_email_test_at
                ? `آخر اختبار: ${new Date(status.last_email_test_at).toLocaleString("ar-SA")}`
                : isConnected
                ? "تم الربط بنجاح"
                : "أدخل بياناتك واختبر الاتصال لتفعيل التقديم التلقائي"}
            </p>
          </div>
        </div>

        {/* ─── بطاقة التعليمات ─── */}
        <div style={{
          background: dark ? "#0a1020" : "#eff6ff",
          border: `1px solid ${dark ? "#1e3a5f" : "#bfdbfe"}`,
          borderRadius: 14, padding: "14px 18px", marginBottom: 24,
          display: "flex", gap: 12,
        }}>
          <Info size={18} color={t.blue} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: dark ? "#93c5fd" : "#1d4ed8", lineHeight: 1.8 }}>
            <strong>كيف تجيب App Password من Gmail؟</strong>
            <ol style={{ margin: "6px 0 0", padding: "0 18px" }}>
              <li>فعّل التحقق بخطوتين في حسابك أول شي</li>
              <li>
                روح لـ{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "inherit", fontWeight: 700, textDecoration: "underline" }}
                >
                  كلمات مرور التطبيقات
                </a>
                {" "}← الأمان ← myaccount.google.com
              </li>
              <li>أنشئ كلمة مرور جديدة واختر "بريد إلكتروني"</li>
              <li>انسخ الكلمة اللي طولها 16 حرف والصقها هنا</li>
            </ol>
          </div>
        </div>

        {/* ─── النموذج ─── */}
        <div style={{
          background: t.card, border: `1px solid ${t.border}`,
          borderRadius: 16, padding: "24px 24px", marginBottom: 20,
        }}>
          <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700, margin: "0 0 20px" }}>إعدادات البريد</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* البريد الإلكتروني */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 6 }}>
                البريد الإلكتروني
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={16} color={t.text3} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="email"
                  value={smtpEmail}
                  onChange={e => setSmtpEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  dir="ltr"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "11px 40px 11px 14px",
                    background: t.input, border: `1px solid ${t.inputBorder}`,
                    borderRadius: 10, color: t.text, fontSize: 14, outline: "none",
                  }}
                />
              </div>
            </div>

            {/* App Password */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 6 }}>
                كلمة مرور التطبيق (App Password)
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={16} color={t.text3} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={appPassword}
                  onChange={e => setAppPassword(e.target.value)}
                  placeholder={status?.smtp_email ? "••••••••••••••••  (محفوظة — أدخل جديدة للتغيير)" : "xxxx xxxx xxxx xxxx"}
                  dir="ltr"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "11px 40px 11px 40px",
                    background: t.input, border: `1px solid ${t.inputBorder}`,
                    borderRadius: 10, color: t.text, fontSize: 14, outline: "none",
                    fontFamily: "monospace",
                  }}
                />
                <button
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 2,
                  }}
                >
                  {showPassword ? <EyeOff size={16} color={t.text3} /> : <Eye size={16} color={t.text3} />}
                </button>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: t.text3 }}>
                تُشفَّر وتُحفظ بشكل آمن — لا يمكن قراءتها لاحقاً
              </p>
            </div>

            {/* رسالة الحفظ */}
            {saveMsg && (
              <div style={{
                padding: "10px 14px", borderRadius: 10, fontSize: 13,
                background: saveMsg.ok ? (dark ? "#0d1f0d" : "#f0fdf4") : (dark ? "#1f0d0d" : "#fff5f5"),
                color: saveMsg.ok ? t.green : t.red,
                border: `1px solid ${saveMsg.ok ? (dark ? "#1a4a1a" : "#bbf7d0") : (dark ? "#4a1a1a" : "#fecaca")}`,
              }}>
                {saveMsg.text}
              </div>
            )}

            {/* زر الحفظ */}
            <button
              onClick={handleSave}
              disabled={saving || !smtpEmail || !appPassword}
              style={{
                padding: "13px 24px", borderRadius: 12, border: "none",
                background: saving || !smtpEmail || !appPassword ? (dark ? "#222" : "#e4e4e7") : "#09090b",
                color: saving || !smtpEmail || !appPassword ? t.text3 : "#fff",
                fontSize: 14, fontWeight: 700, cursor: saving || !smtpEmail || !appPassword ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.15s",
              }}
            >
              {saving
                ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> جاري الحفظ…</>
                : <><Lock size={16} /> حفظ وتشفير</>}
            </button>
          </div>
        </div>

        {/* ─── اختبار الاتصال ─── */}
        <div style={{
          background: t.card, border: `1px solid ${t.border}`,
          borderRadius: 16, padding: "24px 24px",
        }}>
          <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>اختبار الاتصال</h2>
          <p style={{ color: t.text2, fontSize: 13, margin: "0 0 16px", lineHeight: 1.7 }}>
            سيُرسل إيميل تجريبي إلى بريدك للتأكد من أن الإعداد صحيح. عند النجاح يُفعَّل التقديم التلقائي.
          </p>

          {testMsg && (
            <div style={{
              padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14,
              background: testMsg.ok ? (dark ? "#0d1f0d" : "#f0fdf4") : (dark ? "#1f0d0d" : "#fff5f5"),
              color: testMsg.ok ? t.green : t.red,
              border: `1px solid ${testMsg.ok ? (dark ? "#1a4a1a" : "#bbf7d0") : (dark ? "#4a1a1a" : "#fecaca")}`,
            }}>
              {testMsg.text}
            </div>
          )}

          <button
            onClick={handleTest}
            disabled={testing || !status?.smtp_email}
            style={{
              padding: "13px 24px", borderRadius: 12, border: "none",
              background: testing || !status?.smtp_email ? (dark ? "#222" : "#e4e4e7") : "#2563eb",
              color: testing || !status?.smtp_email ? t.text3 : "#fff",
              fontSize: 14, fontWeight: 700,
              cursor: testing || !status?.smtp_email ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 8,
              transition: "all 0.15s",
            }}
          >
            {testing
              ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> جاري الإرسال…</>
              : <><Send size={16} /> إرسال إيميل تجريبي</>}
          </button>
        </div>

      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </PortalShell>
  );
}
