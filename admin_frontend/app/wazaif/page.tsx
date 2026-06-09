import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { SPECIALIZATIONS } from "./data";

export const metadata: Metadata = {
  title: "وظائف حسب التخصص في السعودية 2026 | Jobbots",
  description: "استعرض أكثر التخصصات الوظيفية طلباً في السعودية 2026. Jobbots يقدّم عنك تلقائياً على وظائف محاسب ومهندس ومبرمج ومسوق رقمي وغيرها.",
  alternates: { canonical: "https://jobbots.org/wazaif" },
  openGraph: {
    title: "وظائف حسب التخصص في السعودية 2026 | Jobbots",
    description: "استعرض أكثر التخصصات الوظيفية طلباً في السعودية 2026.",
    url: "https://jobbots.org/wazaif",
    siteName: "Jobbots",
    locale: "ar_SA",
    type: "website",
  },
};

export default function JobsIndexPage() {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: "https://jobbots.org" },
      { "@type": "ListItem", position: 2, name: "الوظائف", item: "https://jobbots.org/wazaif" },
    ],
  };

  return (
    <div dir="rtl" style={p.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <nav style={p.nav}>
        <div style={p.navInner}>
          <Link href="/" style={p.brand}>
            <Image src="/logo-transparent.png" alt="Jobbots" width={22} height={22} style={{ borderRadius: 5 }} />
            <span style={p.brandName}>Jobbots</span>
          </Link>
          <Link href="/portal/login" style={p.navCta}>دخول المشترك</Link>
        </div>
      </nav>

      <div style={p.hero}>
        <h1 style={p.h1}>وظائف حسب التخصص في السعودية</h1>
        <p style={p.desc}>
          اختر تخصصك وتعرّف على سوق العمل — Jobbots يقدّم عنك تلقائياً على الوظائف المناسبة
        </p>
      </div>

      <div style={p.grid}>
        {SPECIALIZATIONS.map((spec) => {
          const demandColor =
            spec.demand === "مرتفع جداً" ? "#16a34a" :
            spec.demand === "مرتفع" ? "#ca8a04" : "#64748b";
          return (
            <Link key={spec.slug} href={`/wazaif/${spec.slug}`} style={p.card}>
              <div style={p.cardTop}>
                <span style={p.cardTitle}>{spec.nameAr}</span>
                <span style={{ ...p.demandBadge, color: demandColor, borderColor: demandColor + "40", background: demandColor + "10" }}>
                  {spec.demand}
                </span>
              </div>
              <p style={p.cardDesc}>{spec.desc.slice(0, 80)}...</p>
              <div style={p.cardBottom}>
                <span style={p.cardCount}>{spec.jobCount}+ وظيفة</span>
                <span style={p.cardSalary}>{spec.salaryRange}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={p.ctaBanner}>
        <h2 style={p.ctaTitle}>Jobbots يقدّم عنك على كل هذه الوظائف تلقائياً</h2>
        <p style={p.ctaSub}>لا تحتاج تقديم يدوي — البوت يعمل كل 30 دقيقة</p>
        <Link href="/store" style={p.ctaBtn}>اشترك وابدأ الآن</Link>
      </div>

      <footer style={p.footer}>
        <div style={p.footerInner}>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>© 2026 Jobbots</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/daleel" style={p.footLink}>الأدلة</Link>
            <Link href="/store" style={p.footLink}>الأسعار</Link>
            <Link href="/" style={p.footLink}>الرئيسية</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const p: Record<string, React.CSSProperties> = {
  page: { background: "#fff", minHeight: "100vh", fontFamily: "'Thmanyah Sans', 'Tajawal','Segoe UI',Tahoma,sans-serif" },
  nav: { borderBottom: "1px solid #e5e7eb", padding: "0 20px", height: 56, display: "flex", alignItems: "center" },
  navInner: { maxWidth: 1100, margin: "0 auto", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" },
  brand: { display: "flex", alignItems: "center", gap: 8, textDecoration: "none" },
  brandName: { fontWeight: 800, fontSize: 17, color: "#111" },
  navCta: { background: "#111", color: "#fff", padding: "7px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none" },
  hero: { maxWidth: 860, margin: "0 auto", padding: "52px 20px 36px", textAlign: "center" },
  h1: { fontSize: "clamp(24px,5vw,38px)", fontWeight: 900, color: "#0f172a", margin: "0 0 14px" },
  desc: { fontSize: 16, color: "#475569", lineHeight: 1.8, margin: 0 },
  grid: { maxWidth: 1100, margin: "0 auto", padding: "0 20px 60px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 },
  card: { background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 14, padding: "22px 20px", textDecoration: "none", display: "block", transition: "box-shadow 0.2s" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: 800, color: "#0f172a" },
  demandBadge: { fontSize: 11, fontWeight: 600, border: "1px solid", borderRadius: 6, padding: "2px 8px" },
  cardDesc: { fontSize: 13, color: "#64748b", lineHeight: 1.7, margin: "0 0 14px" },
  cardBottom: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardCount: { fontSize: 12, fontWeight: 700, color: "#111" },
  cardSalary: { fontSize: 12, color: "#64748b" },
  ctaBanner: { background: "#0f172a", padding: "52px 20px", textAlign: "center" },
  ctaTitle: { fontSize: "clamp(20px,4vw,28px)", fontWeight: 800, color: "#fff", margin: "0 0 10px" },
  ctaSub: { fontSize: 15, color: "#94a3b8", margin: "0 0 24px" },
  ctaBtn: { display: "inline-block", background: "#fff", color: "#0f172a", padding: "12px 28px", borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: "none" },
  footer: { borderTop: "1px solid #e5e7eb", padding: "24px 20px" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  footLink: { fontSize: 13, color: "#64748b", textDecoration: "none" },
};
