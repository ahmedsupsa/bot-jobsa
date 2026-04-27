"use client";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useTheme } from "@/contexts/theme-context";
import { portalFetch } from "@/lib/portal-auth";
import { Mail, CheckCircle, Loader2, Info } from "lucide-react";

export default function EmailPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const t = {
    bg: dark ? "#0a0a0a" : "#f4f4f5",
    card: dark ? "#111" : "#fff",
    border: dark ? "#222" : "#e4e4e7",
    text: dark ? "#fff" : "#09090b",
    text2: dark ? "#aaa" : "#52525b",
    text3: dark ? "#666" : "#a1a1aa",
    green: "#22c55e",
    blue: "#3b82f6",
  };

  useEffect(() => {
    portalFetch("/me")
      .then(r => r.json())
      .then(d => setEmail(d.email || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 4px" }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: t.text, fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>
            البريد الإلكتروني
          </h1>
          <p style={{ color: t.text2, fontSize: 14, margin: 0, lineHeight: 1.7 }}>
            تُرسَل تقديماتك التلقائية من إيميلك المخصص على منصة Jobbots.
          </p>
        </div>

        {/* بطاقة الإيميل */}
        <div style={{
          background: email ? (dark ? "#0d1f0d" : "#f0fdf4") : (dark ? "#1a1215" : "#fdf4ff"),
          border: `1px solid ${email ? (dark ? "#1a4a1a" : "#bbf7d0") : (dark ? "#3a1a3a" : "#e9d5ff")}`,
          borderRadius: 14, padding: "20px 22px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: email ? (dark ? "#14532d" : "#dcfce7") : (dark ? "#2e1065" : "#ede9fe"),
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {email
              ? <CheckCircle size={22} color={t.green} strokeWidth={2.5} />
              : <Mail size={22} color="#a855f7" strokeWidth={2} />}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: email ? t.green : "#a855f7" }}>
              {email ? "إيميلك المخصص ✓" : "لم يتم تخصيص إيميل بعد"}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: t.text, fontFamily: "monospace", direction: "ltr", textAlign: "right" }}>
              {email ?? "تواصل مع الدعم لتفعيل حسابك"}
            </p>
          </div>
        </div>

        {/* بطاقة معلومات */}
        <div style={{
          background: dark ? "#0a1020" : "#eff6ff",
          border: `1px solid ${dark ? "#1e3a5f" : "#bfdbfe"}`,
          borderRadius: 14, padding: "16px 18px",
          display: "flex", gap: 12,
        }}>
          <Info size={18} color={t.blue} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: dark ? "#93c5fd" : "#1d4ed8", lineHeight: 1.9 }}>
            <strong>كيف يعمل النظام؟</strong>
            <ul style={{ margin: "8px 0 0", padding: "0 18px" }}>
              <li>كل مستخدم يحصل على إيميل خاص به على دومين Jobbots</li>
              <li>التقديمات تُرسَل تلقائياً من هذا الإيميل بدون أي إعداد منك</li>
              <li>الشركات ترى اسمك وإيميلك المخصص كمرسل</li>
              <li>لا تحتاج إلى كلمة مرور Gmail أو أي إعداد إضافي</li>
            </ul>
          </div>
        </div>

      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </PortalShell>
  );
}
