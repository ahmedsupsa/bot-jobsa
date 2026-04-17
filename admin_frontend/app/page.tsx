"use client";
import Link from "next/link";
import {
  Briefcase, Bot, PenLine, BarChart3, ArrowLeft,
  CheckCircle2, Zap, Shield, Clock
} from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      icon: <Bot size={22} strokeWidth={1.5} />,
      title: "تقديم تلقائي",
      desc: "يقدّم عنك على الوظائف المناسبة كل 30 دقيقة بشكل تلقائي كامل",
    },
    {
      icon: <PenLine size={22} strokeWidth={1.5} />,
      title: "رسائل بالذكاء الاصطناعي",
      desc: "يكتب رسالة تغطية احترافية لكل وظيفة باستخدام Gemini AI",
    },
    {
      icon: <BarChart3 size={22} strokeWidth={1.5} />,
      title: "تتبع التقديمات",
      desc: "شوف كل الوظائف اللي انقدّم عليها في لوحة واحدة واضحة",
    },
    {
      icon: <Shield size={22} strokeWidth={1.5} />,
      title: "خصوصية تامة",
      desc: "بياناتك وسيرتك الذاتية محفوظة بأمان ولا تُشارك مع أي طرف",
    },
  ];

  const steps = [
    { num: "01", title: "احصل على كود التفعيل", desc: "تواصل معنا واحصل على كود للدخول للمنصة" },
    { num: "02", title: "ارفع سيرتك الذاتية", desc: "ارفع CV وحدد مجالات الوظائف اللي تبيها" },
    { num: "03", title: "استرخِ وانتظر النتائج", desc: "المنصة تقدّم عنك تلقائياً وتُرسل لك تقارير يومية" },
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
            <span style={s.logoText}>جبسا</span>
          </div>
          <div style={s.navLinks}>
            <Link href="/portal/login" style={s.navBtn}>
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
          منصة جبسا تقدّم عنك على المئات من الوظائف تلقائياً يومياً<br />
          بينما أنت مرتاح — بدون جهد وبنتائج حقيقية
        </p>
        <div style={s.heroCtas}>
          <Link href="/portal/login" style={s.ctaPrimary}>
            ابدأ الآن
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
          <div style={s.sectionTag}>المميزات</div>
          <h2 style={s.sectionTitle}>كل ما تحتاجه في مكان واحد</h2>
          <div style={s.featureGrid}>
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
          <div style={s.sectionTag}>كيف يعمل</div>
          <h2 style={s.sectionTitle}>ثلاث خطوات فقط</h2>
          <div style={s.stepsGrid}>
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

      {/* ── CTA BANNER ── */}
      <section style={s.ctaBanner}>
        <div style={s.ctaBannerInner}>
          <CheckCircle2 size={40} strokeWidth={1} color="#fff" style={{ opacity: 0.4, marginBottom: 20 }} />
          <h2 style={s.ctaBannerTitle}>جاهز تبدأ رحلة البحث عن وظيفة؟</h2>
          <p style={s.ctaBannerSub}>سجّل دخولك الآن وخلّ جبسا يشتغل عنك</p>
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
            <span style={{ ...s.logoText, fontSize: 16 }}>جبسا</span>
          </div>
          <div style={s.footerLinks}>
            <Link href="/portal/login" style={s.footerLink}>دخول المشترك</Link>
            <span style={{ color: "#333" }}>·</span>
            <Link href="/login" style={s.footerLink}>لوحة الإدارة</Link>
          </div>
          <div style={s.footerCopy}>© 2025 جبسا. جميع الحقوق محفوظة.</div>
        </div>
      </footer>

      <style>{`
        a { text-decoration: none; }
        * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .hero-title { font-size: 36px !important; }
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .hero-ctas { flex-direction: column !important; align-items: stretch !important; }
        }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "'Segoe UI', Tahoma, sans-serif" },

  /* NAV */
  nav: { position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid #1a1a1a", background: "rgba(10,10,10,0.85)", backdropFilter: "blur(12px)" },
  navInner: { maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontWeight: 800, fontSize: 20 },
  navLinks: { display: "flex", gap: 12, alignItems: "center" },
  navBtn: { padding: "8px 18px", borderRadius: 10, border: "1px solid #2a2a2a", color: "#ccc", fontSize: 14, fontWeight: 500, background: "transparent", cursor: "pointer" },

  /* HERO */
  hero: { maxWidth: 860, margin: "0 auto", padding: "100px 24px 80px", textAlign: "center" },
  heroBadge: { display: "inline-flex", alignItems: "center", gap: 6, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 100, padding: "6px 14px", fontSize: 12, color: "#999", marginBottom: 32 },
  heroTitle: { fontSize: 60, fontWeight: 900, lineHeight: 1.15, margin: "0 0 20px", color: "#fff" },
  heroAccent: { color: "#fff", opacity: 0.5 },
  heroSub: { fontSize: 18, color: "#666", lineHeight: 1.8, margin: "0 0 40px" },
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
  heroStats: { display: "flex", justifyContent: "center", gap: 60, borderTop: "1px solid #1a1a1a", paddingTop: 40 },
  heroStat: { textAlign: "center" },
  heroStatVal: { fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 4 },
  heroStatLabel: { fontSize: 13, color: "#555" },

  /* SECTIONS */
  section: { padding: "80px 24px" },
  sectionInner: { maxWidth: 1100, margin: "0 auto" },
  sectionTag: { display: "inline-block", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 100, padding: "4px 14px", fontSize: 12, color: "#888", marginBottom: 16 },
  sectionTitle: { fontSize: 36, fontWeight: 800, color: "#fff", margin: "0 0 48px", textAlign: "center" },

  /* FEATURES */
  featureGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 },
  featureCard: { background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "28px 24px" },
  featureIcon: { width: 44, height: 44, borderRadius: 12, background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 16 },
  featureTitle: { fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 10px" },
  featureDesc: { fontSize: 14, color: "#666", lineHeight: 1.7, margin: 0 },

  /* STEPS */
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 },
  stepCard: { background: "#0a0a0a", border: "1px solid #222", borderRadius: 16, padding: "32px 28px" },
  stepNum: { fontSize: 42, fontWeight: 900, color: "#222", marginBottom: 16, fontFamily: "monospace" },
  stepTitle: { fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 10px" },
  stepDesc: { fontSize: 14, color: "#666", lineHeight: 1.7, margin: 0 },

  /* CTA BANNER */
  ctaBanner: { padding: "80px 24px", background: "#0a0a0a", borderTop: "1px solid #1a1a1a" },
  ctaBannerInner: { maxWidth: 600, margin: "0 auto", textAlign: "center" },
  ctaBannerTitle: { fontSize: 32, fontWeight: 800, color: "#fff", margin: "0 0 12px" },
  ctaBannerSub: { fontSize: 16, color: "#555", margin: "0 0 32px" },
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
