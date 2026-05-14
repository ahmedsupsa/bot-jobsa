import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  Bot, PenLine, BarChart3, ArrowLeft,
  CheckCircle2, Zap, Shield, Clock, TrendingUp
} from "lucide-react";

export const metadata: Metadata = {
  title: "Jobbots — خل البوت يقدم عنك على الوظائف بالذكاء الاصطناعي",
  description: "تعبت من التقديم اليدوي؟ Jobbots يقدّم عنك تلقائياً على الوظائف في السعودية كل 30 دقيقة. وفّر وقتك وزد فرصك.",
  alternates: { canonical: "https://jobbots.org" },
};

export default function LandingPage() {
  const features = [
    {
      icon: <Bot size={22} strokeWidth={1.5} />,
      title: "يقدّم عنك وانت نايم",
      desc: "كل 30 دقيقة البوت يدور على الوظائف المناسبة ويقدّم عنك تلقائياً — ما تحتاج تسوي شي",
    },
    {
      icon: <PenLine size={22} strokeWidth={1.5} />,
      title: "رسالة مخصصة لكل وظيفة",
      desc: "ما يرسل نفس الرسالة للكل — الذكاء الاصطناعي يكتب رسالة تغطية تناسب كل وظيفة بشكل منفصل",
    },
    {
      icon: <BarChart3 size={22} strokeWidth={1.5} />,
      title: "شوف وين وصلت",
      desc: "لوحة تحكم تعرض كل الوظائف اللي قدّم عليها البوت باسمك — تاريخها والحالة بالتفصيل",
    },
    {
      icon: <Shield size={22} strokeWidth={1.5} />,
      title: "بياناتك عندك",
      desc: "CV وبياناتك الشخصية محفوظة بأمان ومشفّرة — ما تطلع لأي جهة ثانية أبد",
    },
    {
      icon: <TrendingUp size={22} strokeWidth={1.5} />,
      title: "زد فرصك أكثر",
      desc: "اللي يقدّم على وظائف أكثر يحصل على مقابلات أكثر — خل البوت يشتغل عنك بدل ما تجلس تقدّم يدوي",
    },
    {
      icon: <Clock size={22} strokeWidth={1.5} />,
      title: "وقتك لأهم الأشياء",
      desc: "بدل ما تقضي ساعات وأنت تبحث وتقدّم، ركّز على تحضير مقابلاتك وJobbots يتكفل بالباقي",
    },
  ];

  const steps = [
    { num: "01", title: "اشترك واحصل على كود التفعيل", desc: "تواصل معنا واختار الباقة المناسبة — تحصل على كود تفعيل فوري تدخل فيه المنصة" },
    { num: "02", title: "ارفع CV وحدد تفضيلاتك", desc: "ارفع سيرتك الذاتية وقول للبوت وش مجالك وأنهي مناطق تبي تشتغل فيها" },
    { num: "03", title: "استنّى والوظيفة جاية لك", desc: "البوت يقدّم عنك كل 30 دقيقة — وانت تجلس وتنتظر المقابلات تجيك" },
  ];

  const faqs = [
    { q: "كيف يشتغل Jobbots؟", a: "البوت يقرأ سيرتك الذاتية وتفضيلاتك، يدور على الوظائف المناسبة، ويكتب رسالة مخصصة ويرسلها بالإيميل مباشرة لكل شركة — وهذا يصير كل 30 دقيقة تلقائياً." },
    { q: "بياناتي آمنة؟", a: "إي والله، بياناتك مشفّرة ومحفوظة على خوادم آمنة. ما تطلع لأي جهة خارجية أبداً." },
    { q: "على أنهي وظائف يقدّم؟", a: "يقدّم على الوظائف في المجالات اللي تحددها أنت بالضبط، في المناطق اللي تفضّلها داخل المملكة." },
    { q: "إيش أحتاج أجهّز؟", a: "بس تحتاج كود التفعيل، ترفع CV، وتربط إيميلك. بعدها البوت يشتغل لوحده." },
  ];

  const jsonLdOrganization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Jobbots",
    url: "https://jobbots.org",
    logo: "https://jobbots.org/logo.png",
    description: "منصة Jobbots تقدّم عنك على الوظائف تلقائياً بالذكاء الاصطناعي في المملكة العربية السعودية",
    foundingLocation: { "@type": "Place", addressCountry: "SA" },
    sameAs: [],
  };

  const jsonLdFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  const jsonLdWebsite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Jobbots",
    url: "https://jobbots.org",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://jobbots.org/store?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div style={s.page} dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }} />
      {/* ── NAV ── */}
      <nav style={s.nav} className="nav-blur">
        <div style={s.navInner}>
          <div style={s.logo}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 5, flexShrink: 0 }}>
              <Image src="/logo-transparent.png" alt="Jobbots" width={24} height={24} style={{ display: "block" }} />
            </div>
            <span style={s.logoText}>Jobbots</span>
          </div>
          <div style={s.navLinks} className="landing-nav-links">
            <Link href="/store" style={{ ...s.navBtn, background: "transparent", color: "var(--text2)", border: "1px solid var(--border2)" }} className="nav-secondary">
              المتجر
            </Link>
            <Link href="/portal/login" style={{ ...s.navBtn, background: "var(--accent)", color: "var(--accent-fg)", border: "none", fontWeight: 700 }}>
              دخول المشترك
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={s.hero}>
        <div style={s.heroBadge}>
          <Zap size={13} strokeWidth={2} />
          <span>مدعوم بالذكاء الاصطناعي</span>
        </div>
        <h1 style={s.heroTitle}>
          تعبت من التقديم؟<br />
          <span style={s.heroAccent}>خل البوت يشتغل عنك</span>
        </h1>
        <p style={s.heroSub} className="hero-sub">
          Jobbots يقدّم عنك على الوظائف تلقائياً كل 30 دقيقة بالذكاء الاصطناعي —{" "}
          وانت مرتاح وبدون ما تحرك إصبع
        </p>
        <div style={s.heroCtas}>
          <Link href="/portal/login" style={s.ctaPrimary}>
            ابدأ الحين
            <ArrowLeft size={17} strokeWidth={2} />
          </Link>
          <Link href="/portal/login" style={s.ctaSecondary}>
            عندك كود تفعيل؟ دخّله هنا
          </Link>
        </div>
        <div style={s.heroStats} className="hero-stats">
          {[
            { val: "تلقائي", label: "تقديم بلا جهد" },
            { val: "AI", label: "رسائل مخصصة لكل وظيفة" },
            { val: "30 د", label: "كل دورة تلقائية" },
          ].map((st, i) => (
            <div key={i} style={s.heroStat}>
              <div style={s.heroStatVal}>{st.val}</div>
              <div style={s.heroStatLabel}>{st.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={s.section}>
        <div style={s.sectionInner}>
          <div style={s.sectionTag}>ليش Jobbots؟</div>
          <h2 style={s.sectionTitle}>كل اللي تحتاجه عشان توصل للوظيفة</h2>
          <p style={s.sectionDesc}>
            مصمّم خصيصاً لسوق العمل السعودي — يشتغل عنك وانت مرتاح
          </p>
          <div style={s.featureGrid} className="features-grid">
            {features.map((f, i) => (
              <div key={i} style={s.featureCard}>
                <div style={s.featureIcon}>{f.icon}</div>
                <h3 style={s.featureTitle}>{f.title}</h3>
                <p style={s.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPANIES GRID ── */}
      <section style={s.companiesSection}>
        <div style={s.sectionInner}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div style={{ ...s.sectionTag, marginBottom: 14 }}>شركات يقدّم عليها البوت</div>
            <h2 style={s.sectionTitle}>يقدّم عنك على كبرى الشركات</h2>
            <p style={s.sectionDesc}>
              البوت يراقب الوظائف الجديدة باستمرار ويقدّم عنك على الشركات اللي تناسبك
            </p>
          </div>

          <div style={s.companiesGrid} className="companies-grid">
            {[
              { src: "/companies/the-rig.png",  name: "The Rig" },
              { src: "/companies/lifera.png",   name: "Lifera" },
              { src: "/companies/scai.png",     name: "SCAI" },
              { src: "/companies/src.png",      name: "SRC" },
              { src: "/companies/bidaya.png",   name: "Bidaya Finance" },
              { src: "/companies/salic.png",    name: "SALIC" },
              { src: "/companies/nupco.png",    name: "Nupco" },
              { src: "/companies/thc.png",      name: "THC" },
            ].map((c, i) => (
              <div key={i} style={s.companyCard} className="__company-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.src} alt={c.name} style={s.companyLogo} />
                <span style={s.companyName}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ ...s.section, background: "var(--surface)" }}>
        <div style={s.sectionInner}>
          <div style={s.sectionTag}>كيف تبدأ؟</div>
          <h2 style={s.sectionTitle}>3 خطوات وبس — وبعدها البوت يشتغل</h2>
          <p style={s.sectionDesc}>
            ما تحتاج خبرة ولا وقت — الإعداد يخلص في دقائق
          </p>
          <div style={s.stepsGrid} className="steps-grid">
            {steps.map((st, i) => (
              <div key={i} style={s.stepCard}>
                <div style={s.stepNum}>{st.num}</div>
                <h3 style={s.stepTitle}>{st.title}</h3>
                <p style={s.stepDesc}>{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={s.section}>
        <div style={{ ...s.sectionInner, maxWidth: 760 }}>
          <div style={s.sectionTag}>أسئلة شائعة</div>
          <h2 style={s.sectionTitle}>عندك سؤال؟ الجواب هنا</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {faqs.map((faq, i) => (
              <div key={i} style={s.faqCard}>
                <h3 style={s.faqQ}>{faq.q}</h3>
                <p style={s.faqA}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={s.ctaBanner}>
        <div style={s.ctaBannerInner}>
          <CheckCircle2 size={40} strokeWidth={1} color="var(--text)" style={{ marginBottom: 20 }} />
          <h2 style={s.ctaBannerTitle}>لا تجلس تقدّم يدوي وانت تقدر تنام</h2>
          <p style={s.ctaBannerSub}>
            اشترك الحين وخلّ Jobbots يشتغل عنك — البوت ما يتعب ولا يمل
          </p>
          <Link href="/portal/login" style={s.ctaBannerBtn}>
            ابدأ الحين
            <ArrowLeft size={17} strokeWidth={2} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={s.logo}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 4, flexShrink: 0 }}>
              <Image src="/logo-transparent.png" alt="Jobbots" width={20} height={20} style={{ display: "block" }} />
            </div>
            <span style={{ ...s.logoText, fontSize: 16 }}>Jobbots</span>
          </div>
          <div style={s.footerLinks}>
            <Link href="/store" style={s.footerLink}>المتجر</Link>
            <span style={{ color: "var(--text4)" }}>·</span>
            <Link href="/wazaif" style={s.footerLink}>الوظائف</Link>
            <span style={{ color: "var(--text4)" }}>·</span>
            <Link href="/daleel" style={s.footerLink}>الأدلة</Link>
            <span style={{ color: "var(--text4)" }}>·</span>
            <Link href="/privacy" style={s.footerLink}>سياسة الخصوصية</Link>
            <span style={{ color: "var(--text4)" }}>·</span>
            <Link href="/terms" style={s.footerLink}>الشروط والأحكام</Link>
            <span style={{ color: "var(--text4)" }}>·</span>
            <Link href="/portal/login" style={s.footerLink}>دخول المشترك</Link>
          </div>
          <div style={s.footerCopy}>© 2026 Jobbots. جميع الحقوق محفوظة.</div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 480px) {
          .footer-links { flex-wrap: wrap; gap: 8px !important; justify-content: center; }
          .hero-ctas { flex-direction: column; align-items: stretch !important; }
          .hero-ctas a { text-align: center; justify-content: center; }
        }
        .__company-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .__company-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.10);
        }
        @media (max-width: 768px) {
          .companies-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: "var(--bg)", minHeight: "100vh", color: "var(--text)", fontFamily: "'Tajawal', 'Segoe UI', Tahoma, sans-serif" },

  /* NAV */
  nav: {
    position: "sticky", top: 0, zIndex: 50,
    borderBottom: "1px solid var(--border)",
    background: "var(--nav-bg)",
    WebkitBackdropFilter: "blur(12px)",
    backdropFilter: "blur(12px)",
  },
  navInner: { maxWidth: 1100, margin: "0 auto", padding: "0 20px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoIcon: { width: 34, height: 34, borderRadius: 9, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  logoText: { color: "var(--text)", fontWeight: 800, fontSize: 18, letterSpacing: "-0.5px" },
  navLinks: { display: "flex", gap: 10, alignItems: "center" },
  navBtn: { padding: "8px 16px", borderRadius: 10, border: "1px solid var(--border2)", color: "var(--text2)", fontSize: 13, fontWeight: 500, background: "transparent", cursor: "pointer", whiteSpace: "nowrap" },

  /* HERO */
  hero: { maxWidth: 860, margin: "0 auto", padding: "80px 20px 60px", textAlign: "center" },
  heroBadge: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 100, padding: "6px 14px", fontSize: 13, color: "var(--text3)", marginBottom: 28 },
  heroTitle: { fontSize: "clamp(30px, 7vw, 58px)", fontWeight: 900, lineHeight: 1.2, margin: "0 0 18px", color: "var(--text)" },
  heroAccent: { color: "var(--text2)" },
  heroSub: { fontSize: "clamp(15px, 3vw, 18px)", color: "var(--text2)", lineHeight: 1.9, margin: "0 0 36px", padding: "0 8px" },
  heroCtas: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 52 },
  ctaPrimary: {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "var(--accent)", color: "var(--accent-fg)", padding: "13px 26px",
    borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer",
    whiteSpace: "nowrap",
  },
  ctaSecondary: {
    display: "inline-flex", alignItems: "center",
    border: "1px solid var(--border2)", color: "var(--text2)", padding: "13px 22px",
    borderRadius: 12, fontSize: 13, cursor: "pointer",
    whiteSpace: "nowrap",
  },
  heroStats: { display: "flex", justifyContent: "center", gap: 40, borderTop: "1px solid var(--border)", paddingTop: 36, flexWrap: "wrap" },
  heroStat: { textAlign: "center" },
  heroStatVal: { fontSize: 26, fontWeight: 800, color: "var(--text)", marginBottom: 4 },
  heroStatLabel: { fontSize: 12, color: "var(--text3)" },

  /* SECTIONS */
  section: { padding: "72px 20px" },
  sectionInner: { maxWidth: 1100, margin: "0 auto" },
  sectionTag: { display: "inline-block", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 100, padding: "4px 14px", fontSize: 12, color: "var(--text2)", marginBottom: 16 },
  sectionTitle: { fontSize: "clamp(22px, 5vw, 34px)", fontWeight: 800, color: "var(--text)", margin: "0 0 12px", textAlign: "center" },
  sectionDesc: { fontSize: 15, color: "var(--text2)", textAlign: "center", margin: "0 0 44px", lineHeight: 1.7, padding: "0 16px" },

  /* FEATURES */
  featureGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 },
  featureCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px 20px" },
  featureIcon: { width: 42, height: 42, borderRadius: 12, background: "var(--surface2)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", marginBottom: 14 },
  featureTitle: { fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" },
  featureDesc: { fontSize: 13, color: "var(--text2)", lineHeight: 1.8, margin: 0 },

  /* STEPS */
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 },
  stepCard: { background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: 16, padding: "28px 24px" },
  stepNum: { fontSize: 38, fontWeight: 900, color: "var(--text4)", marginBottom: 14, fontFamily: "monospace" },
  stepTitle: { fontSize: 17, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" },
  stepDesc: { fontSize: 13, color: "var(--text2)", lineHeight: 1.8, margin: 0 },

  /* FAQ */
  faqCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "22px 24px" },
  faqQ: { fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 10px" },
  faqA: { fontSize: 13, color: "var(--text2)", lineHeight: 1.8, margin: 0 },

  /* CTA BANNER */
  ctaBanner: { padding: "72px 20px", background: "var(--bg)", borderTop: "1px solid var(--border)" },
  ctaBannerInner: { maxWidth: 600, margin: "0 auto", textAlign: "center" },
  ctaBannerTitle: { fontSize: "clamp(20px, 5vw, 30px)", fontWeight: 800, color: "var(--text)", margin: "0 0 12px" },
  ctaBannerSub: { fontSize: 15, color: "var(--text2)", margin: "0 0 28px", lineHeight: 1.7 },
  ctaBannerBtn: {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "var(--accent)", color: "var(--accent-fg)", padding: "14px 32px",
    borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: "pointer",
  },

  /* COMPANIES GRID */
  companiesSection: { padding: "72px 20px", background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" },
  companiesGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 },
  companyCard: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
    padding: "28px 20px 20px",
    gap: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    cursor: "default",
  },
  companyLogo: { maxWidth: "100%", maxHeight: 60, width: "auto", height: "auto", objectFit: "contain" as const, display: "block" },
  companyName: { fontSize: 12, fontWeight: 600, color: "var(--text3)", textAlign: "center" as const },

  /* FOOTER */
  footer: { borderTop: "1px solid var(--border)", padding: "28px 20px" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 },
  footerLinks: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  footerLink: { color: "var(--text2)", fontSize: 13 },
  footerCopy: { color: "var(--text3)", fontSize: 13 },
};
