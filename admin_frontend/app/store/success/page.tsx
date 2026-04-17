"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle, Briefcase, Copy, CheckCheck } from "lucide-react";

function SuccessContent() {
  const params = useSearchParams();
  const order_id = params.get("order_id");
  const payment_id = params.get("payment_id");
  const invoice_id = params.get("invoice_id");
  const status = params.get("status");

  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [msg, setMsg] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!order_id) { setState("err"); setMsg("رابط غير صحيح"); return; }

    // Check localStorage first (already verified before)
    const cached = localStorage.getItem(`order_code_${order_id}`);
    if (cached) { setCode(cached); setState("ok"); return; }

    fetch("/api/store/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id, payment_id, invoice_id, status }),
    })
      .then(r => r.json())
      .then(j => {
        if (j.ok) {
          setState("ok");
          if (j.activation_code) {
            setCode(j.activation_code);
            localStorage.setItem(`order_code_${order_id}`, j.activation_code);
          }
        } else {
          setState("err");
          setMsg(j.error || "فشل التحقق من الدفع");
        }
      })
      .catch(() => { setState("err"); setMsg("خطأ في الاتصال بالخادم"); });
  }, [order_id, payment_id, invoice_id, status]);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 48 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Briefcase size={18} strokeWidth={1.5} color="#0a0a0a" />
        </div>
        <span style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>Jobbots</span>
      </Link>

      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 24, padding: "48px 40px", maxWidth: 460, width: "100%", textAlign: "center" }}>
        {state === "loading" && (
          <>
            <Loader2 size={48} color="#555" style={{ margin: "0 auto 20px", animation: "spin 1s linear infinite" }} />
            <p style={{ color: "#888", fontSize: 16 }}>جاري التحقق من الدفع...</p>
          </>
        )}

        {state === "ok" && (
          <>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#052e16", border: "2px solid #16a34a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle2 size={36} color="#4ade80" />
            </div>
            <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 900, margin: "0 0 12px" }}>تم الدفع بنجاح! 🎉</h1>
            <p style={{ color: "#666", fontSize: 15, lineHeight: 1.8, margin: "0 0 28px" }}>
              شكراً لاشتراكك — استخدم كود التفعيل أدناه لتفعيل حسابك في البوابة.
            </p>

            {code ? (
              <div style={{ background: "#0d0d0d", border: "1px dashed #333", borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
                <p style={{ color: "#888", fontSize: 12, margin: "0 0 10px", letterSpacing: 1 }}>كود التفعيل</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <span style={{ color: "#fff", fontSize: 26, fontWeight: 900, letterSpacing: 4, fontFamily: "monospace" }}>{code}</span>
                  <button
                    onClick={handleCopy}
                    style={{ background: copied ? "#052e16" : "#1a1a1a", border: `1px solid ${copied ? "#16a34a" : "#333"}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: copied ? "#4ade80" : "#888", fontSize: 12, transition: "all 0.2s" }}
                  >
                    {copied ? <><CheckCheck size={14} /> تم النسخ</> : <><Copy size={14} /> نسخ</>}
                  </button>
                </div>
                <p style={{ color: "#555", fontSize: 12, margin: "12px 0 0" }}>احتفظ بهذا الكود — ادخله في بوابة المستخدمين لتفعيل اشتراكك</p>
              </div>
            ) : (
              <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 14, padding: "16px", marginBottom: 28 }}>
                <p style={{ color: "#666", fontSize: 14, margin: 0 }}>سيتم إرسال كود التفعيل إليك قريباً عبر البريد الإلكتروني.</p>
              </div>
            )}

            <Link href="/portal/login" style={{ display: "block", background: "#fff", color: "#0a0a0a", padding: "14px", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none", marginBottom: 12 }}>
              دخول البوابة
            </Link>
            <Link href="/" style={{ display: "block", color: "#555", fontSize: 13, textDecoration: "none" }}>
              العودة للرئيسية
            </Link>
          </>
        )}

        {state === "err" && (
          <>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#1c0a0a", border: "2px solid #7f1d1d", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <XCircle size={36} color="#f87171" />
            </div>
            <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 900, margin: "0 0 12px" }}>حدث خطأ</h1>
            <p style={{ color: "#666", fontSize: 15, lineHeight: 1.8, margin: "0 0 32px" }}>
              {msg || "تعذّر التحقق من الدفع، تواصل مع الدعم."}
            </p>
            <a href="mailto:support@jobbots.org" style={{ display: "block", background: "#fff", color: "#0a0a0a", padding: "14px", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              تواصل مع الدعم
            </a>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} color="#555" style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
