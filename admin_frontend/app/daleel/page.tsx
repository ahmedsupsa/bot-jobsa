import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES } from "./data";

export const metadata: Metadata = {
  title: "أدلة البحث عن وظيفة في السعودية 2026 | Jobbots",
  description: "أدلة عملية شاملة للباحثين عن عمل في السعودية 2026. نصائح من سوق العمل السعودي، كيف تكتب CV احترافي، كيف تجتاز المقابلة، وكيف تستخدم التقديم التلقائي.",
  alternates: { canonical: "https://jobbots.org/daleel" },
  openGraph: {
    title: "أدلة البحث عن وظيفة في السعودية 2026 | Jobbots",
    description: "أدلة عملية للباحثين عن عمل في السعودية — نصائح حقيقية من سوق العمل.",
    url: "https://jobbots.org/daleel",
    siteName: "Jobbots",
    locale: "ar_SA",
    type: "website",
  },
};

export default function GuidesIndexPage() {
  return (
    <div dir="rtl" style={p.page}>
      <nav style={p.nav}>
        <div style={p.navInner}>
          <Link href="/" style={p.brand}>
            <span style={p.brandDot}>J</span>
            <span style={p.brandName}>Jobbots</span>
          </Link>
          <Link href="/portal/login" style={p.navCta}>دخول المشترك</Link>
        </div>
      </nav>

      <div style={p.hero}>
        <h1 style={p.h1}>أدلة البحث عن وظيفة في السعودية</h1>
        <p style={p.desc}>
          دليل عملي لكل باحث عن عمل في السعودية — من كتابة CV احترافي حتى اجتياز المقابلة والحصول على وظيفة
        </p>
      </div>

      <div style={p.grid}>
        {GUIDES.map((guide) => (
          <Link key={guide.slug} href={`/daleel/${guide.slug}`} style={p.card}>
            <div style={p.cardMeta}>
              <span style={p.cardTag}>دليل</span>
              <span style={p.cardTime}>⏱ {guide.readTime}</span>
            </div>
            <h2 style={p.cardTitle}>{guide.title}</h2>
            <p style={p.cardDesc}>{guide.metaDesc}</p>
            <span style={p.readMore}>اقرأ الدليل ←</span>
          </Link>
        ))}
      </div>

      <div style={p.ctaBanner}>
        <h2 style={p.ctaTitle}>وفّر الوقت — Jobbots يقدّم عنك تلقائياً</h2>
        <p style={p.ctaSub}>بدلاً من ساعات يومية في التقديم اليدوي، البوت يتكفل بكل شيء</p>
        <Link href="/store" style={p.ctaBtn}>اشترك وابدأ الآن</Link>
      </div>

      <footer style={p.footer}>
        <div style={p.footerInner}>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>© 2026 Jobbots</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/wazaif" style={p.footLink}>التخصصات</Link>
            <Link href="/store" style={p.footLink}>الأسعار</Link>
            <Link href="/" style={p.footLink}>الرئيسية</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const p: Record<string, React.CSSProperties> = {
  page: { background: "#fff", minHeight: "100vh", fontFamily: "'Tajawal','Segoe UI',Tahoma,sans-serif" },
  nav: { borderBottom: "1px solid #e5e7eb", padding: "0 20px", height: 56, display: "flex", alignItems: "center" },
  navInner: { maxWidth: 1100, margin: "0 auto", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" },
  brand: { display: "flex", alignItems: "center", gap: 8, textDecoration: "none" },
  brandDot: { width: 28, height: 28, borderRadius: 7, background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 },
  brandName: { fontWeight: 800, fontSize: 17, color: "#111" },
  navCta: { background: "#111", color: "#fff", padding: "7px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none" },
  hero: { maxWidth: 860, margin: "0 auto", padding: "52px 20px 36px", textAlign: "center" },
  h1: { fontSize: "clamp(24px,5vw,38px)", fontWeight: 900, color: "#0f172a", margin: "0 0 14px" },
  desc: { fontSize: 16, color: "#475569", lineHeight: 1.8, margin: 0 },
  grid: { maxWidth: 1100, margin: "0 auto", padding: "0 20px 60px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 },
  card: { background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 16, padding: "24px 22px", textDecoration: "none", display: "flex", flexDirection: "column", gap: 10 },
  cardMeta: { display: "flex", alignItems: "center", gap: 10 },
  cardTag: { background: "#eff6ff", color: "#2563eb", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 },
  cardTime: { fontSize: 12, color: "#94a3b8" },
  cardTitle: { fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.4 },
  cardDesc: { fontSize: 13, color: "#64748b", lineHeight: 1.7, margin: 0 },
  readMore: { fontSize: 13, color: "#2563eb", fontWeight: 600, marginTop: 4 },
  ctaBanner: { background: "#0f172a", padding: "52px 20px", textAlign: "center" },
  ctaTitle: { fontSize: "clamp(20px,4vw,28px)", fontWeight: 800, color: "#fff", margin: "0 0 10px" },
  ctaSub: { fontSize: 15, color: "#94a3b8", margin: "0 0 24px" },
  ctaBtn: { display: "inline-block", background: "#fff", color: "#0f172a", padding: "12px 28px", borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: "none" },
  footer: { borderTop: "1px solid #e5e7eb", padding: "24px 20px" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  footLink: { fontSize: 13, color: "#64748b", textDecoration: "none" },
};
