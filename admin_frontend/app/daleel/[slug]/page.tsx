import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES, getGuideBySlug } from "../data";

export async function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return {};
  return {
    title: guide.title + " | Jobbots",
    description: guide.metaDesc,
    alternates: { canonical: `https://jobbots.org/daleel/${guide.slug}` },
    openGraph: {
      title: guide.title + " | Jobbots",
      description: guide.metaDesc,
      url: `https://jobbots.org/daleel/${guide.slug}`,
      siteName: "Jobbots",
      locale: "ar_SA",
      type: "article",
    },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.metaDesc,
    inLanguage: "ar",
    publisher: {
      "@type": "Organization",
      name: "Jobbots",
      url: "https://jobbots.org",
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://jobbots.org/daleel/${guide.slug}` },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: "https://jobbots.org" },
      { "@type": "ListItem", position: 2, name: "الأدلة", item: "https://jobbots.org/daleel" },
      { "@type": "ListItem", position: 3, name: guide.title, item: `https://jobbots.org/daleel/${guide.slug}` },
    ],
  };

  return (
    <div dir="rtl" style={gd.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      {/* NAV */}
      <nav style={gd.nav}>
        <div style={gd.navInner}>
          <Link href="/" style={gd.brand}>
            <span style={gd.brandDot}>J</span>
            <span style={gd.brandName}>Jobbots</span>
          </Link>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/daleel" style={gd.navLink}>الأدلة</Link>
            <Link href="/portal/login" style={gd.navCta}>دخول المشترك</Link>
          </div>
        </div>
      </nav>

      {/* BREADCRUMB */}
      <div style={gd.breadcrumb}>
        <div style={gd.breadcrumbInner}>
          <Link href="/" style={gd.bcLink}>الرئيسية</Link>
          <span style={gd.bcSep}>›</span>
          <Link href="/daleel" style={gd.bcLink}>الأدلة</Link>
          <span style={gd.bcSep}>›</span>
          <span style={gd.bcCurrent}>{guide.title}</span>
        </div>
      </div>

      {/* ARTICLE */}
      <main style={gd.main}>
        <div style={gd.article}>
          <div style={gd.meta}>
            <span style={gd.metaTag}>دليل عملي</span>
            <span style={gd.metaTime}>⏱ {guide.readTime} للقراءة</span>
          </div>
          <h1 style={gd.h1}>{guide.h1}</h1>
          <p style={gd.intro}>{guide.intro}</p>

          {guide.sections.map((sec, i) => (
            <div key={i} style={gd.section}>
              <h2 style={gd.h2}>{sec.heading}</h2>
              <p style={gd.body}>{sec.content}</p>
            </div>
          ))}

          {/* CTA BOX */}
          <div style={gd.ctaBox}>
            <div style={gd.ctaBoxIcon}>🚀</div>
            <h3 style={gd.ctaBoxTitle}>{guide.cta}</h3>
            <p style={gd.ctaBoxDesc}>
              Jobbots يقدّم عنك تلقائياً على مئات الوظائف كل يوم بالذكاء الاصطناعي — بدون جهد يدوي
            </p>
            <Link href="/store" style={gd.ctaBoxBtn}>اشترك وابدأ الآن</Link>
          </div>
        </div>

        {/* SIDEBAR */}
        <aside style={gd.sidebar}>
          <div style={gd.sideCard}>
            <h3 style={gd.sideTitle}>أدلة أخرى</h3>
            {GUIDES.filter((g) => g.slug !== guide.slug)
              .slice(0, 5)
              .map((g) => (
                <Link key={g.slug} href={`/daleel/${g.slug}`} style={gd.sideLink}>
                  {g.title}
                </Link>
              ))}
          </div>
          <div style={gd.sideCard}>
            <h3 style={gd.sideTitle}>تخصصات وظيفية</h3>
            {[
              { slug: "accountant", name: "محاسب" },
              { slug: "engineer", name: "مهندس" },
              { slug: "programmer", name: "مبرمج" },
              { slug: "digital-marketer", name: "مسوق رقمي" },
              { slug: "hr-manager", name: "موارد بشرية" },
            ].map((s) => (
              <Link key={s.slug} href={`/wazaif/${s.slug}`} style={gd.sideLink}>
                وظائف {s.name}
              </Link>
            ))}
          </div>
        </aside>
      </main>

      {/* FOOTER */}
      <footer style={gd.footer}>
        <div style={gd.footerInner}>
          <span style={gd.footCopy}>© 2026 Jobbots</span>
          <div style={gd.footLinks}>
            <Link href="/daleel" style={gd.footLink}>الأدلة</Link>
            <Link href="/wazaif" style={gd.footLink}>التخصصات</Link>
            <Link href="/store" style={gd.footLink}>الأسعار</Link>
            <Link href="/privacy" style={gd.footLink}>الخصوصية</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const gd: Record<string, React.CSSProperties> = {
  page: { background: "#fff", minHeight: "100vh", color: "#111", fontFamily: "'Thmanyah Sans', 'Tajawal','Segoe UI',Tahoma,sans-serif" },
  nav: { borderBottom: "1px solid #e5e7eb", padding: "0 20px", height: 56, display: "flex", alignItems: "center" },
  navInner: { maxWidth: 1200, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" },
  brand: { display: "flex", alignItems: "center", gap: 8, textDecoration: "none" },
  brandDot: { width: 28, height: 28, borderRadius: 7, background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 },
  brandName: { fontWeight: 800, fontSize: 17, color: "#111" },
  navLink: { color: "#64748b", fontSize: 13, textDecoration: "none" },
  navCta: { background: "#111", color: "#fff", padding: "7px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none" },
  breadcrumb: { borderBottom: "1px solid #f0f0f0", padding: "10px 20px", background: "#fafafa" },
  breadcrumbInner: { maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b", flexWrap: "wrap" },
  bcLink: { color: "#64748b", textDecoration: "none" },
  bcSep: { color: "#cbd5e1" },
  bcCurrent: { color: "#111", fontWeight: 600 },
  main: { maxWidth: 1200, margin: "0 auto", padding: "40px 20px 60px", display: "grid", gridTemplateColumns: "1fr 300px", gap: 40, alignItems: "start" },
  article: { minWidth: 0 },
  meta: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 },
  metaTag: { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600 },
  metaTime: { fontSize: 13, color: "#64748b" },
  h1: { fontSize: "clamp(22px,5vw,36px)", fontWeight: 900, lineHeight: 1.3, margin: "0 0 20px", color: "#0f172a" },
  intro: { fontSize: 16, color: "#475569", lineHeight: 1.9, margin: "0 0 32px", padding: "16px 20px", background: "#f8fafc", borderRadius: 12, borderRight: "4px solid #3b82f6" },
  section: { marginBottom: 32 },
  h2: { fontSize: "clamp(16px,3vw,20px)", fontWeight: 800, color: "#0f172a", margin: "0 0 12px" },
  body: { fontSize: 15, color: "#334155", lineHeight: 1.9, margin: 0, whiteSpace: "pre-line" },
  ctaBox: { background: "linear-gradient(135deg,#0f172a,#1e293b)", borderRadius: 16, padding: "32px 28px", textAlign: "center", marginTop: 40 },
  ctaBoxIcon: { fontSize: 36, marginBottom: 12 },
  ctaBoxTitle: { fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 10px" },
  ctaBoxDesc: { fontSize: 14, color: "#94a3b8", lineHeight: 1.7, margin: "0 0 22px" },
  ctaBoxBtn: { display: "inline-block", background: "#fff", color: "#0f172a", padding: "11px 26px", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none" },
  sidebar: { display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 80 },
  sideCard: { background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 18px" },
  sideTitle: { fontSize: 14, fontWeight: 800, color: "#111", margin: "0 0 14px", paddingBottom: 10, borderBottom: "1px solid #e5e7eb" },
  sideLink: { display: "block", fontSize: 13, color: "#475569", textDecoration: "none", padding: "7px 0", borderBottom: "1px solid #f1f5f9", lineHeight: 1.5 },
  footer: { borderTop: "1px solid #e5e7eb", padding: "24px 20px" },
  footerInner: { maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  footCopy: { fontSize: 13, color: "#94a3b8" },
  footLinks: { display: "flex", gap: 16, flexWrap: "wrap" },
  footLink: { fontSize: 13, color: "#64748b", textDecoration: "none" },
};
