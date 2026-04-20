"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import Image from "next/image";
import { setToken } from "@/lib/portal-auth";

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const order_id = params.get("order_id");
  const payment_id = params.get("payment_id");
  const invoice_id = params.get("invoice_id");
  const status = params.get("status");

  const [state, setState] = useState<"loading" | "new_account" | "existing" | "err">("loading");
  const [msg, setMsg] = useState("");
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    if (!order_id) { setState("err"); setMsg("رابط غير صحيح"); return; }

    // Check localStorage cache
    const cached = localStorage.getItem(`order_result_${order_id}`);
    if (cached) {
      try {
        const r = JSON.parse(cached);
        if (r.token) setToken(r.token);
        setState(r.account_created ? "new_account" : "existing");
        return;
      } catch {}
    }

    fetch("/api/store/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id, payment_id, invoice_id, status }),
    })
      .then(r => r.json())
      .then(j => {
        if (j.ok) {
          if (j.token) setToken(j.token);
          const result = { account_created: j.account_created, token: j.token };
          localStorage.setItem(`order_result_${order_id}`, JSON.stringify(result));
          setState(j.account_created ? "new_account" : "existing");
        } else {
          setState("err");
          setMsg(j.error || "فشل التحقق من الدفع");
        }
      })
      .catch(() => { setState("err"); setMsg("خطأ في الاتصال بالخادم"); });
  }, [order_id, payment_id, invoice_id, status]);

  const handleEnter = () => {
    setEntering(true);
    router.replace("/portal/dashboard");
  };

  return (
    <div dir="rtl" style={s.page}>
      <Link href="/" style={s.logo}>
        <Image src="/logo.png" alt="Jobbots" width={36} height={36} style={{ borderRadius: 10 }} />
        <span style={s.logoText}>Jobbots</span>
      </Link>

      <div style={s.card}>
        {state === "loading" && (
          <div style={s.center}>
            <Loader2 size={48} color="#555" style={{ animation: "spin 1s linear infinite", marginBottom: 20 }} />
            <p style={s.subText}>جاري التحقق من الدفع وإعداد حسابك...</p>
          </div>
        )}

        {state === "new_account" && (
          <>
            <div style={s.iconWrap}>
              <CheckCircle2 size={38} color="#4ade80" />
            </div>
            <h1 style={s.title}>تم إنشاء حسابك بنجاح! 🎉</h1>
            <p style={s.desc}>
              اشتراكك فعّال — حسابك جاهز الآن. اضغط على الزر أدناه لتدخل بوابتك وتبدأ رحلتك مع Jobbots.
            </p>

            <div style={s.infoBox}>
              <div style={s.infoRow}>
                <span style={s.infoIcon}>✅</span>
                <span style={s.infoText}>الحساب مُفعَّل ومرتبط بالاشتراك</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoIcon}>🤖</span>
                <span style={s.infoText}>ارفع سيرتك الذاتية وسيبدأ النظام بالتقديم تلقائياً</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoIcon}>📩</span>
                <span style={s.infoText}>ستصلك إشعارات عند كل تقديم ناجح</span>
              </div>
            </div>

            <button onClick={handleEnter} disabled={entering} style={s.enterBtn}>
              {entering
                ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> جاري الدخول...</>
                : <><span>دخول البوابة</span> <ArrowLeft size={16} /></>}
            </button>
          </>
        )}

        {state === "existing" && (
          <>
            <div style={s.iconWrap}>
              <CheckCircle2 size={38} color="#4ade80" />
            </div>
            <h1 style={s.title}>تم الدفع بنجاح! 🎉</h1>
            <p style={s.desc}>
              تم تجديد اشتراكك — حسابك الحالي مُحدَّث تلقائياً. اضغط أدناه للدخول.
            </p>

            <div style={s.infoBox}>
              <div style={s.infoRow}>
                <span style={s.infoIcon}>🔄</span>
                <span style={s.infoText}>تم تمديد اشتراكك بنجاح</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoIcon}>🚀</span>
                <span style={s.infoText}>النظام سيستمر بالتقديم التلقائي</span>
              </div>
            </div>

            <button onClick={handleEnter} disabled={entering} style={s.enterBtn}>
              {entering
                ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> جاري الدخول...</>
                : <><span>دخول البوابة</span> <ArrowLeft size={16} /></>}
            </button>
          </>
        )}

        {state === "err" && (
          <>
            <div style={{ ...s.iconWrap, background: "#1c0a0a", border: "2px solid #7f1d1d" }}>
              <XCircle size={38} color="#f87171" />
            </div>
            <h1 style={s.title}>حدث خطأ</h1>
            <p style={s.desc}>{msg || "تعذّر التحقق من الدفع، تواصل مع الدعم."}</p>
            <a href="mailto:support@jobbots.org" style={s.supportBtn}>
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

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0a",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    fontFamily: "'Tajawal', system-ui, sans-serif",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
    marginBottom: 40,
  },
  logoIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  logoText: { color: "#fff", fontSize: 18, fontWeight: 800 },
  card: {
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: 24,
    padding: "44px 40px",
    maxWidth: 460,
    width: "100%",
    textAlign: "center",
  },
  center: { display: "flex", flexDirection: "column", alignItems: "center" },
  iconWrap: {
    width: 72, height: 72, borderRadius: "50%",
    background: "#052e16",
    border: "2px solid #16a34a",
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 20px",
  },
  title: { color: "#fff", fontSize: 24, fontWeight: 900, margin: "0 0 12px" },
  desc: { color: "#888", fontSize: 14.5, lineHeight: 1.8, margin: "0 0 24px" },
  subText: { color: "#666", fontSize: 15 },
  infoBox: {
    background: "#0a0a0a",
    border: "1px solid #1f1f1f",
    borderRadius: 14,
    padding: "16px 18px",
    marginBottom: 24,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    textAlign: "right",
  },
  infoRow: { display: "flex", alignItems: "center", gap: 10 },
  infoIcon: { fontSize: 16, flexShrink: 0 },
  infoText: { color: "#bbb", fontSize: 13.5 },
  enterBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #a78bfa, #6d28d9)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 8px 24px rgba(109,40,217,0.4)",
  },
  supportBtn: {
    display: "block",
    background: "#fff",
    color: "#0a0a0a",
    padding: "14px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 15,
    textDecoration: "none",
  },
};
