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
    { num: "02", title: "ارفع CV وحدد تفضيلاتك", desc: "ارفع سيرتك الذاتية وقول للبوت وش مجالك وأي مناطق تبي تشتغل فيها" },
    { num: "03", title: "استنّى والوظيفة جاية لك", desc: "البوت يقدّم عنك كل 30 دقيقة — وانت تجلس وتنتظر المقابلات تجيك" },
  ];

  const faqs = [
    { q: "كيف يشتغل Jobbots؟", a: "البوت يقرأ سيرتك الذاتية وتفضيلاتك، يدور على الوظائف المناسبة، ويكتب رسالة مخصصة ويرسلها بالإيميل مباشرة لكل شركة — وهذا يصير كل 30 دقيقة تلقائياً." },
    { q: "بياناتي آمنة؟", a: "إي والله، بياناتك مشفّرة ومحفوظة على خوادم آمنة. ما تطلع لأي جهة خارجية أبداً." },
    { q: "على أي وظائف يقدّم؟", a: "يقدّم على الوظائف في المجالات اللي تحددها أنت بالضبط، في المناطق اللي تفضّلها داخل المملكة." },
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
            <span style={{ fontSize: 14, color: "var(--text)", fontWeight: 700, lineHeight: 1 }}>بوت التقديم على الوظائف بالذكاء الاصطناعي</span>
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
          {/* العمود الأول — الشعار والوصف */}
          <div style={s.footerBrand}>
            <div style={s.logo}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 5, flexShrink: 0 }}>
                <Image src="/logo-transparent.png" alt="Jobbots" width={22} height={22} style={{ display: "block" }} />
              </div>
              <span style={{ ...s.logoText, fontSize: 17 }}>Jobbots</span>
            </div>
            <p style={s.footerTagline}>بوت التقديم على الوظائف بالذكاء الاصطناعي — يقدّم عنك تلقائياً كل 30 دقيقة.</p>
            <div style={s.footerSocial}>
              <a href="https://t.me/jobbotssa" target="_blank" rel="noopener noreferrer" style={s.socialBtn} aria-label="Telegram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.9l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.958.659z"/></svg>
              </a>
              <a href="https://twitter.com/jobbotssa" target="_blank" rel="noopener noreferrer" style={s.socialBtn} aria-label="Twitter">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            </div>
          </div>

          {/* أعمدة الروابط */}
          <div style={s.footerCols}>
            <div style={s.footerCol}>
              <p style={s.footerColTitle}>المنتج</p>
              <Link href="/store" style={s.footerColLink}>المتجر</Link>
              <Link href="/wazaif" style={s.footerColLink}>الوظائف</Link>
              <Link href="/daleel" style={s.footerColLink}>الأدلة</Link>
            </div>
            <div style={s.footerCol}>
              <p style={s.footerColTitle}>الحساب</p>
              <Link href="/portal/login" style={s.footerColLink}>دخول المشترك</Link>
              <Link href="/?scroll=pricing" style={s.footerColLink}>الباقات</Link>
            </div>
            <div style={s.footerCol}>
              <p style={s.footerColTitle}>قانوني</p>
              <Link href="/privacy" style={s.footerColLink}>سياسة الخصوصية</Link>
              <Link href="/terms" style={s.footerColLink}>الشروط والأحكام</Link>
            </div>
          </div>
        </div>

        {/* شريط الحقوق */}
        <div style={s.footerBottom}>
          <span style={s.footerCopy}>© 2026 Jobbots. جميع الحقوق محفوظة.</span>
          <span style={s.footerCopy}>صُنع بالسعودية 🇸🇦</span>
        </div>
      </footer>

      <style>{`
        @media (max-width: 480px) {
          .footer-links { flex-wrap: wrap; gap: 8px !important; justify-content: center; }
          .hero-ctas { flex-direction: column; align-items: stretch !important; }
          .hero-ctas a { text-align: center; justify-content: center; }
        }
        @media (max-width: 640px) {
          .footer-inner { flex-direction: column !important; gap: 32px !important; }
          .footer-cols { gap: 24px !important; }
          .footer-bottom { flex-direction: column !important; align-items: flex-start !important; gap: 4px !important; }
        }
        .footer-col-link:hover { color: var(--text) !important; }
        .social-btn:hover { border-color: var(--accent) !important; color: var(--accent) !important; }
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
  page: { background: "var(--bg)", minHeight: "100vh", color: "var(--text)", fontFamily: "'Thmanyah Sans', 'Tajawal', 'Segoe UI', Tahoma, sans-serif" },

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
  footer: { borderTop: "1px solid var(--border)", padding: "60px 20px 28px", background: "var(--surface)" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 48, flexWrap: "wrap" as const, paddingBottom: 48, borderBottom: "1px solid var(--border)" },
  footerBrand: { display: "flex", flexDirection: "column" as const, gap: 16, maxWidth: 280 },
  footerTagline: { fontSize: 13, color: "var(--text3)", lineHeight: 1.8, margin: 0 },
  footerSocial: { display: "flex", gap: 8 },
  socialBtn: { width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", background: "var(--bg)", transition: "all 0.15s" },
  footerCols: { display: "flex", gap: 48, flexWrap: "wrap" as const },
  footerCol: { display: "flex", flexDirection: "column" as const, gap: 10, minWidth: 100 },
  footerColTitle: { fontSize: 12, fontWeight: 700, color: "var(--text)", textTransform: "uppercase" as const, letterSpacing: "0.06em", margin: "0 0 4px" },
  footerColLink: { fontSize: 13, color: "var(--text3)" },
  footerBottom: { maxWidth: 1100, margin: "28px auto 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8 },
  footerCopy: { color: "var(--text4)", fontSize: 12 },
};
