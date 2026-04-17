"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { XCircle, Briefcase, Loader2 } from "lucide-react";

function FailureContent() {
  const params = useSearchParams();
  const msg = params.get("message") || "تم إلغاء عملية الدفع أو رفضها.";

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 48 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Briefcase size={18} strokeWidth={1.5} color="#0a0a0a" />
        </div>
        <span style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>Jobbots</span>
      </Link>

      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 24, padding: "48px 40px", maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#1c0a0a", border: "2px solid #7f1d1d", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <XCircle size={36} color="#f87171" />
        </div>
        <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 900, margin: "0 0 12px" }}>لم يتم الدفع</h1>
        <p style={{ color: "#666", fontSize: 15, lineHeight: 1.8, margin: "0 0 32px" }}>
          {msg}
        </p>
        <Link href="/store" style={{ display: "block", background: "#fff", color: "#0a0a0a", padding: "14px", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none", marginBottom: 12 }}>
          المحاولة مجدداً
        </Link>
        <a href="mailto:support@jobbots.org" style={{ display: "block", color: "#555", fontSize: 13, textDecoration: "none" }}>
          تواصل مع الدعم
        </a>
      </div>
    </div>
  );
}

export default function FailurePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} color="#555" />
      </div>
    }>
      <FailureContent />
    </Suspense>
  );
}
