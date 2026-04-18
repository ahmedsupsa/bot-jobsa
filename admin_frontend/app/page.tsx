"use client";
import Link from "next/link";
import {
  Briefcase, Bot, PenLine, BarChart3, ArrowLeft,
  CheckCircle2, Zap, Shield, Clock, Star, TrendingUp
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
      <nav style={s.nav}>
        <div style={s.navInner}>
          <div style={s.logo}>
            <div style={s.logoIcon}>
              <Briefcase size={20} strokeWidth={1.5} color="#0a0a0a" />
            </div>
            <span style={s.logoText}>Jobbots</span>
          </div>
          <div style={s.navLinks}>
            <Link href="/store" style={{ ...s.navBtn, background: "transparent", color: "#aaa", border: "1px solid #2a2a2a" }}>
              المتجر
            </Link>
            <Link href="/portal/login" style={{ ...s.navBtn, background: "#fff", color: "#0a0a0a", border: "none", fontWeight: 700 }}>
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
        <p style={s.heroSub}>
          Jobbots يقدّم عنك على المئات من الوظائف يومياً بالذكاء الاصطناعي<br />
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
        <div style={s.heroStats}>
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
      <section style={{ ...s.section, background: "#111" }}>
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
          <CheckCircle2 size={40} strokeWidth={1} color="#fff" style={{ opacity: 0.4, marginBottom: 20 }} />
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
            <div style={s.logoIcon}>
              <Briefcase size={16} strokeWidth={1.5} color="#0a0a0a" />
            </div>
            <span style={{ ...s.logoText, fontSize: 16 }}>Jobbots</span>
          </div>
          <div style={s.footerLinks}>
            <Link href="/store" style={s.footerLink}>المتجر</Link>
            <span style={{ color: "#333" }}>·</span>
            <Link href="/privacy" style={s.footerLink}>سياسة الخصوصية</Link>
            <span style={{ color: "#333" }}>·</span>
            <Link href="/terms" style={s.footerLink}>الشروط والأحكام</Link>
            <span style={{ color: "#333" }}>·</span>
            <Link href="/portal/login" style={s.footerLink}>دخول المشترك</Link>
          </div>
          <div style={s.footerCopy}>© 2025 Jobbots. جميع الحقوق محفوظة.</div>
        </div>
      </footer>

      <style>{`
        * { box-sizing: border-box; }
        a { text-decoration: none; }
        body { font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif !important; }
        @media (max-width: 900px) {
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
        }
        @media (max-width: 600px) {
          .features-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "'Tajawal', 'Segoe UI', Tahoma, sans-serif" },

  /* NAV */
  nav: { position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid #1a1a1a", background: "rgba(10,10,10,0.9)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" },
  navInner: { maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontWeight: 800, fontSize: 20, letterSpacing: "-0.5px" },
  navLinks: { display: "flex", gap: 12, alignItems: "center" },
  navBtn: { padding: "8px 18px", borderRadius: 10, border: "1px solid #2a2a2a", color: "#ccc", fontSize: 14, fontWeight: 500, background: "transparent", cursor: "pointer" },

  /* HERO */
  hero: { maxWidth: 860, margin: "0 auto", padding: "100px 24px 80px", textAlign: "center" },
  heroBadge: { display: "inline-flex", alignItems: "center", gap: 6, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 100, padding: "6px 14px", fontSize: 13, color: "#999", marginBottom: 32 },
  heroTitle: { fontSize: "clamp(34px, 7vw, 60px)", fontWeight: 900, lineHeight: 1.2, margin: "0 0 20px", color: "#fff" },
  heroAccent: { color: "#fff", opacity: 0.45 },
  heroSub: { fontSize: 18, color: "#666", lineHeight: 1.9, margin: "0 0 40px" },
  heroCtas: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 60 },
  ctaPrimary: {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "#fff", color: "#0a0a0a", padding: "14px 28px",
    borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer",
  },
  ctaSecondary: {
    display: "inline-flex", alignItems: "center",
    border: "1px solid #2a2a2a", color: "#888", padding: "14px 24px",
    borderRadius: 12, fontSize: 14, cursor: "pointer",
  },
  heroStats: { display: "flex", justifyContent: "center", gap: 40, borderTop: "1px solid #1a1a1a", paddingTop: 40, flexWrap: "wrap" },
  heroStat: { textAlign: "center" },
  heroStatVal: { fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 4 },
  heroStatLabel: { fontSize: 13, color: "#555" },

  /* SECTIONS */
  section: { padding: "80px 24px" },
  sectionInner: { maxWidth: 1100, margin: "0 auto" },
  sectionTag: { display: "inline-block", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 100, padding: "4px 14px", fontSize: 12, color: "#888", marginBottom: 16 },
  sectionTitle: { fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 800, color: "#fff", margin: "0 0 12px", textAlign: "center" },
  sectionDesc: { fontSize: 16, color: "#555", textAlign: "center", margin: "0 0 48px", lineHeight: 1.7 },

  /* FEATURES */
  featureGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 },
  featureCard: { background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "28px 24px" },
  featureIcon: { width: 44, height: 44, borderRadius: 12, background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 16 },
  featureTitle: { fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 10px" },
  featureDesc: { fontSize: 14, color: "#666", lineHeight: 1.8, margin: 0 },

  /* STEPS */
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 },
  stepCard: { background: "#0a0a0a", border: "1px solid #222", borderRadius: 16, padding: "32px 28px" },
  stepNum: { fontSize: 42, fontWeight: 900, color: "#222", marginBottom: 16, fontFamily: "monospace" },
  stepTitle: { fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 10px" },
  stepDesc: { fontSize: 14, color: "#666", lineHeight: 1.8, margin: 0 },

  /* FAQ */
  faqCard: { background: "#111", border: "1px solid #1f1f1f", borderRadius: 14, padding: "24px 28px" },
  faqQ: { fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 10px" },
  faqA: { fontSize: 14, color: "#666", lineHeight: 1.8, margin: 0 },

  /* CTA BANNER */
  ctaBanner: { padding: "80px 24px", background: "#0a0a0a", borderTop: "1px solid #1a1a1a" },
  ctaBannerInner: { maxWidth: 600, margin: "0 auto", textAlign: "center" },
  ctaBannerTitle: { fontSize: "clamp(22px, 5vw, 32px)", fontWeight: 800, color: "#fff", margin: "0 0 12px" },
  ctaBannerSub: { fontSize: 16, color: "#555", margin: "0 0 32px", lineHeight: 1.7 },
  ctaBannerBtn: {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "#fff", color: "#0a0a0a", padding: "16px 36px",
    borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: "pointer",
  },

  /* FOOTER */
  footer: { borderTop: "1px solid #1a1a1a", padding: "32px 24px" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 },
  footerLinks: { display: "flex", gap: 12, alignItems: "center" },
  footerLink: { color: "#555", fontSize: 13 },
  footerCopy: { color: "#333", fontSize: 13 },
};
