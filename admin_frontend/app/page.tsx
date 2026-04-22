"use client";
import Link from "next/link";
import Image from "next/image";
import {
  Bot, PenLine, BarChart3, ArrowLeft,
  CheckCircle2, Zap, Shield, Clock, TrendingUp
} from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      icon: <Bot size={22} strokeWidth={1.5} />,
      title: "تقديم تلقائي",
      desc: "يقدّم عنك على الوظائف المناسبة كل 30 دقيقة بشكل تلقائي كامل دون أي تدخل منك",
    },
    {
      icon: <PenLine size={22} strokeWidth={1.5} />,
      title: "رسائل بالذكاء الاصطناعي",
      desc: "يكتب رسالة تغطية احترافية ومخصصة لكل وظيفة باستخدام Gemini AI",
    },
    {
      icon: <BarChart3 size={22} strokeWidth={1.5} />,
      title: "تتبع التقديمات",
      desc: "تابع كل الوظائف اللي انقدّم عليها في لوحة تحكم واضحة وسهلة",
    },
    {
      icon: <Shield size={22} strokeWidth={1.5} />,
      title: "خصوصية تامة",
      desc: "بياناتك وسيرتك الذاتية محفوظة بأمان تام ولا تُشارك مع أي طرف ثالث",
    },
    {
      icon: <TrendingUp size={22} strokeWidth={1.5} />,
      title: "زيادة فرص التوظيف",
      desc: "كلما زاد عدد التقديمات، زادت فرصك في الحصول على المقابلة ووظيفتك المثالية",
    },
    {
      icon: <Clock size={22} strokeWidth={1.5} />,
      title: "توفير الوقت",
      desc: "بدل ما تقضي ساعات تقدّم يدوياً، Jobbots يتكفل بكل شيء عنك تلقائياً",
    },
  ];

  const steps = [
    { num: "01", title: "احصل على كود التفعيل", desc: "تواصل معنا واشترك للحصول على كود تفعيل الدخول إلى المنصة" },
    { num: "02", title: "ارفع سيرتك الذاتية", desc: "ارفع ملف CV وحدد مجالات الوظائف والمناطق التي تفضّلها" },
    { num: "03", title: "استرخِ وانتظر النتائج", desc: "Jobbots يقدّم عنك تلقائياً ويُرسل لك تقارير بالوظائف التي قدّم عليها" },
  ];

  const faqs = [
    { q: "كيف يعمل Jobbots؟", a: "Jobbots يقرأ سيرتك الذاتية وتفضيلاتك، ثم يبحث عن الوظائف المناسبة ويقدّم عنك تلقائياً كل 30 دقيقة باستخدام الذكاء الاصطناعي." },
    { q: "هل بياناتي آمنة؟", a: "نعم، بياناتك مشفّرة ومحفوظة على خوادم آمنة ولا تُشارك مع أي جهة خارجية." },
    { q: "ما هي الوظائف التي يقدّم عليها؟", a: "يقدّم على الوظائف في المجالات التي تحددها أنت، في المناطق التي تفضّلها داخل المملكة العربية السعودية." },
  ];

  return (
    <div style={s.page} dir="rtl">
      {/* ── NAV ── */}
      <nav style={s.nav} className="nav-blur">
        <div style={s.navInner}>
          <div style={s.logo}>
            <Image src="/logo.png" alt="Jobbots" width={34} height={34} style={{ borderRadius: 9 }} />
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
          قدّم على الوظائف<br />
          <span style={s.heroAccent}>تلقائياً وبذكاء</span>
        </h1>
        <p style={s.heroSub} className="hero-sub">
          Jobbots يقدّم عنك على المئات من الوظائف يومياً بالذكاء الاصطناعي.{" "}
          وفّر وقتك وزد فرصك — بدون جهد وبنتائج حقيقية
        </p>
        <div style={s.heroCtas}>
          <Link href="/portal/login" style={s.ctaPrimary}>
            ابدأ الآن مجاناً
            <ArrowLeft size={17} strokeWidth={2} />
          </Link>
          <Link href="/portal/login" style={s.ctaSecondary}>
            لديك كود تفعيل؟ ادخل هنا
          </Link>
        </div>
        <div style={s.heroStats} className="hero-stats">
          {[
            { val: "+500", label: "وظيفة يومياً" },
            { val: "AI", label: "رسائل ذكية" },
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
          <div style={s.sectionTag}>مميزات المنصة</div>
          <h2 style={s.sectionTitle}>كل ما تحتاجه للحصول على وظيفتك</h2>
          <p style={s.sectionDesc}>
            منصة Jobbots مصممة لتوفير وقتك وزيادة فرصك في سوق العمل السعودي
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

      {/* ── HOW IT WORKS ── */}
      <section style={{ ...s.section, background: "var(--surface)" }}>
        <div style={s.sectionInner}>
          <div style={s.sectionTag}>طريقة العمل</div>
          <h2 style={s.sectionTitle}>ابدأ التقديم التلقائي في 3 خطوات</h2>
          <p style={s.sectionDesc}>
            إعداد بسيط وسريع، وبعدها Jobbots يتكفل بكل شيء
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
          <div style={s.sectionTag}>الأسئلة الشائعة</div>
          <h2 style={s.sectionTitle}>أسئلة يسألها المستخدمون</h2>
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
          <CheckCircle2 size={40} strokeWidth={1} color="var(--text)" style={{ opacity: 0.4, marginBottom: 20 }} />
          <h2 style={s.ctaBannerTitle}>جاهز تبدأ رحلة البحث عن وظيفة؟</h2>
          <p style={s.ctaBannerSub}>
            سجّل دخولك الآن وخلّ Jobbots يشتغل عنك ويقدّم على الوظائف بدلاً منك
          </p>
          <Link href="/portal/login" style={s.ctaBannerBtn}>
            ابدأ الآن
            <ArrowLeft size={17} strokeWidth={2} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={s.logo}>
            <Image src="/logo.png" alt="Jobbots" width={28} height={28} style={{ borderRadius: 7 }} />
            <span style={{ ...s.logoText, fontSize: 16 }}>Jobbots</span>
          </div>
          <div style={s.footerLinks}>
            <Link href="/store" style={s.footerLink}>المتجر</Link>
            <span style={{ color: "var(--text4)" }}>·</span>
            <Link href="/privacy" style={s.footerLink}>سياسة الخصوصية</Link>
            <span style={{ color: "var(--text4)" }}>·</span>
            <Link href="/terms" style={s.footerLink}>الشروط والأحكام</Link>
            <span style={{ color: "var(--text4)" }}>·</span>
            <Link href="/portal/login" style={s.footerLink}>دخول المشترك</Link>
          </div>
          <div style={s.footerCopy}>© 2025 Jobbots. جميع الحقوق محفوظة.</div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 480px) {
          .footer-links { flex-wrap: wrap; gap: 8px !important; justify-content: center; }
          .hero-ctas { flex-direction: column; align-items: stretch !important; }
          .hero-ctas a { text-align: center; justify-content: center; }
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

  /* FOOTER */
  footer: { borderTop: "1px solid var(--border)", padding: "28px 20px" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 },
  footerLinks: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  footerLink: { color: "var(--text2)", fontSize: 13 },
  footerCopy: { color: "var(--text3)", fontSize: 13 },
};
