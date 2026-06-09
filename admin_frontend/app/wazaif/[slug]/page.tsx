import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { SPECIALIZATIONS, getSpecBySlug } from "../data";

export async function generateStaticParams() {
  return SPECIALIZATIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const spec = getSpecBySlug(slug);
  if (!spec) return {};
  return {
    title: spec.title + " | Jobbots",
    description: spec.metaDesc,
    alternates: { canonical: `https://jobbots.org/wazaif/${spec.slug}` },
    openGraph: {
      title: spec.title + " | Jobbots",
      description: spec.metaDesc,
      url: `https://jobbots.org/wazaif/${spec.slug}`,
      siteName: "Jobbots",
      locale: "ar_SA",
      type: "website",
    },
  };
}

export default async function SpecPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const spec = getSpecBySlug(slug);
  if (!spec) notFound();

  const demandColor =
    spec.demand === "مرتفع جداً"
      ? "#16a34a"
      : spec.demand === "مرتفع"
      ? "#ca8a04"
      : "#64748b";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: spec.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: "https://jobbots.org" },
      { "@type": "ListItem", position: 2, name: "الوظائف", item: "https://jobbots.org/wazaif" },
      { "@type": "ListItem", position: 3, name: spec.title, item: `https://jobbots.org/wazaif/${spec.slug}` },
    ],
  };

  return (
    <div dir="rtl" style={pg.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      {/* NAV */}
      <nav style={pg.nav}>
        <div style={pg.navInner}>
          <Link href="/" style={pg.brand}>
            <Image src="/logo-transparent.png" alt="Jobbots" width={22} height={22} style={{ borderRadius: 5 }} />
            <span style={pg.brandName}>Jobbots</span>
          </Link>
          <Link href="/portal/login" style={pg.navCta}>دخول المشترك</Link>
        </div>
      </nav>

      {/* BREADCRUMB */}
      <div style={pg.breadcrumb}>
        <div style={pg.breadcrumbInner}>
          <Link href="/" style={pg.bcLink}>الرئيسية</Link>
          <span style={pg.bcSep}>›</span>
          <Link href="/wazaif" style={pg.bcLink}>الوظائف</Link>
          <span style={pg.bcSep}>›</span>
          <span style={pg.bcCurrent}>{spec.nameAr}</span>
        </div>
      </div>

      {/* HERO */}
      <section style={pg.hero}>
        <div style={pg.tag}>{spec.titleEn}</div>
        <h1 style={pg.h1}>{spec.h1}</h1>
        <p style={pg.heroDesc}>{spec.desc}</p>

        <div style={pg.statsRow}>
          <div style={pg.statBox}>
            <div style={pg.statVal}>{spec.jobCount}+</div>
            <div style={pg.statLabel}>وظيفة متاحة</div>
          </div>
          <div style={pg.statBox}>
            <div style={{ ...pg.statVal, color: demandColor }}>{spec.demand}</div>
            <div style={pg.statLabel}>مستوى الطلب</div>
          </div>
          <div style={pg.statBox}>
            <div style={pg.statVal}>{spec.salaryRange}</div>
            <div style={pg.statLabel}>نطاق الراتب</div>
          </div>
        </div>

        <Link href="/portal/login" style={pg.ctaBtn}>
          ابدأ التقديم التلقائي الآن ←
        </Link>
      </section>

      {/* SKILLS */}
      <section style={pg.section}>
        <div style={pg.inner}>
          <h2 style={pg.h2}>المهارات المطلوبة لوظيفة {spec.nameAr}</h2>
          <div style={pg.skillsRow}>
            {spec.skills.map((sk) => (
              <span key={sk} style={pg.skill}>{sk}</span>
            ))}
          </div>
        </div>
      </section>

      {/* WHY JOBBOTS */}
      <section style={{ ...pg.section, background: "var(--surface, #f8f8f8)" }}>
        <div style={pg.inner}>
          <h2 style={pg.h2}>لماذا Jobbots لوظائف {spec.nameAr}؟</h2>
          <p style={pg.body}>{spec.why}</p>
          <div style={pg.howGrid}>
            {[
              { n: "01", t: "ارفع سيرتك الذاتية", d: "Jobbots يستخرج تخصصك ومهاراتك تلقائياً" },
              { n: "02", t: "حدد التخصصات", d: `اختر "${spec.nameAr}" ضمن المجالات المفضّلة` },
              { n: "03", t: "البوت يعمل", d: "كل 30 دقيقة يُقدّم عنك برسالة مخصصة لكل شركة" },
            ].map((s) => (
              <div key={s.n} style={pg.howCard}>
                <div style={pg.howNum}>{s.n}</div>
                <h3 style={pg.howTitle}>{s.t}</h3>
                <p style={pg.howDesc}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={pg.section}>
        <div style={{ ...pg.inner, maxWidth: 720 }}>
          <h2 style={pg.h2}>أسئلة شائعة عن وظائف {spec.nameAr} في السعودية</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {spec.faqs.map((f, i) => (
              <div key={i} style={pg.faqCard}>
                <h3 style={pg.faqQ}>{f.q}</h3>
                <p style={pg.faqA}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={pg.ctaSection}>
        <div style={pg.ctaInner}>
          <h2 style={pg.ctaTitle}>جاهز تبدأ البحث عن وظيفة {spec.nameAr}؟</h2>
          <p style={pg.ctaSub}>Jobbots يقدّم عنك تلقائياً على وظائف {spec.nameAr} كل 30 دقيقة — بدون جهد وبنتائج حقيقية</p>
          <Link href="/store" style={pg.ctaBtn}>اشترك الآن</Link>
        </div>
      </section>

      {/* RELATED */}
      <section style={{ ...pg.section, paddingTop: 32, paddingBottom: 48 }}>
        <div style={pg.inner}>
          <h2 style={{ ...pg.h2, marginBottom: 20 }}>تخصصات مشابهة</h2>
          <div style={pg.relGrid}>
            {SPECIALIZATIONS.filter((s) => s.slug !== spec.slug)
              .slice(0, 4)
              .map((s) => (
                <Link key={s.slug} href={`/wazaif/${s.slug}`} style={pg.relCard}>
                  <div style={pg.relTitle}>{s.nameAr}</div>
                  <div style={pg.relSub}>{s.jobCount}+ وظيفة</div>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={pg.footer}>
        <div style={pg.footerInner}>
          <span style={pg.footCopy}>© 2026 Jobbots. جميع الحقوق محفوظة.</span>
          <div style={pg.footLinks}>
            <Link href="/wazaif" style={pg.footLink}>جميع التخصصات</Link>
            <Link href="/daleel" style={pg.footLink}>الأدلة</Link>
            <Link href="/store" style={pg.footLink}>الأسعار</Link>
            <Link href="/privacy" style={pg.footLink}>الخصوصية</Link>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 640px) {
          .stats-row { flex-direction: column !important; }
          .how-grid { grid-template-columns: 1fr !important; }
          .rel-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

const pg: Record<string, React.CSSProperties> = {
  page: { background: "#fff", minHeight: "100vh", color: "#111", fontFamily: "'Thmanyah Sans', 'Tajawal','Segoe UI',Tahoma,sans-serif" },
  nav: { borderBottom: "1px solid #e5e7eb", padding: "0 20px", height: 56, display: "flex", alignItems: "center" },
  navInner: { maxWidth: 1100, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" },
  brand: { display: "flex", alignItems: "center", gap: 8, textDecoration: "none" },
  brandName: { fontWeight: 800, fontSize: 17, color: "#111" },
  navCta: { background: "#111", color: "#fff", padding: "7px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none" },
  breadcrumb: { borderBottom: "1px solid #f0f0f0", padding: "10px 20px", background: "#fafafa" },
  breadcrumbInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b" },
  bcLink: { color: "#64748b", textDecoration: "none" },
  bcSep: { color: "#cbd5e1" },
  bcCurrent: { color: "#111", fontWeight: 600 },
  hero: { maxWidth: 860, margin: "0 auto", padding: "56px 20px 48px", textAlign: "center" },
  tag: { display: "inline-block", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 100, padding: "4px 14px", fontSize: 12, color: "#475569", marginBottom: 20 },
  h1: { fontSize: "clamp(24px,6vw,44px)", fontWeight: 900, lineHeight: 1.25, margin: "0 0 16px", color: "#111" },
  heroDesc: { fontSize: 16, color: "#475569", lineHeight: 1.85, margin: "0 0 36px", padding: "0 8px" },
  statsRow: { display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap", marginBottom: 36 },
  statBox: { textAlign: "center" },
  statVal: { fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 4 },
  statLabel: { fontSize: 12, color: "#64748b" },
  ctaBtn: { display: "inline-flex", alignItems: "center", background: "#111", color: "#fff", padding: "13px 28px", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none" },
  section: { padding: "52px 20px" },
  inner: { maxWidth: 1100, margin: "0 auto" },
  h2: { fontSize: "clamp(20px,4vw,28px)", fontWeight: 800, color: "#111", margin: "0 0 24px", textAlign: "center" },
  body: { fontSize: 15, color: "#475569", lineHeight: 1.85, textAlign: "center", maxWidth: 700, margin: "0 auto 32px" },
  skillsRow: { display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  skill: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 16px", fontSize: 13, color: "#334155", fontWeight: 500 },
  howGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 28 },
  howCard: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "24px 20px" },
  howNum: { fontSize: 32, fontWeight: 900, color: "#e2e8f0", marginBottom: 10, fontFamily: "monospace" },
  howTitle: { fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 6px" },
  howDesc: { fontSize: 13, color: "#64748b", lineHeight: 1.7, margin: 0 },
  faqCard: { background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 22px" },
  faqQ: { fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 8px" },
  faqA: { fontSize: 13, color: "#475569", lineHeight: 1.8, margin: 0 },
  ctaSection: { padding: "64px 20px", background: "#0f172a", textAlign: "center" },
  ctaInner: { maxWidth: 600, margin: "0 auto" },
  ctaTitle: { fontSize: "clamp(20px,4vw,28px)", fontWeight: 800, color: "#fff", margin: "0 0 12px" },
  ctaSub: { fontSize: 15, color: "#94a3b8", margin: "0 0 28px", lineHeight: 1.7 },
  relGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  relCard: { background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 16px", textDecoration: "none", display: "block" },
  relTitle: { fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 4 },
  relSub: { fontSize: 12, color: "#64748b" },
  footer: { borderTop: "1px solid #e5e7eb", padding: "24px 20px" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  footCopy: { fontSize: 13, color: "#94a3b8" },
  footLinks: { display: "flex", gap: 16, flexWrap: "wrap" },
  footLink: { fontSize: 13, color: "#64748b", textDecoration: "none" },
};
