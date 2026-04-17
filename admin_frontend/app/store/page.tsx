import Link from "next/link";
import { Briefcase, Zap, Star, Sparkles, Check, Lock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "المتجر — Jobbots",
  description: "خطط اشتراك Jobbots — التقديم التلقائي على الوظائف بالذكاء الاصطناعي.",
};

const plans = [
  {
    name: "أساسي",
    nameEn: "Basic",
    price: "قريباً",
    period: "",
    icon: <Zap size={22} strokeWidth={1.5} />,
    color: "#888",
    border: "#2a2a2a",
    bg: "#111",
    features: [
      "تقديم تلقائي حتى 5 وظائف يومياً",
      "رسائل تغطية بالذكاء الاصطناعي",
      "رفع السيرة الذاتية",
      "تتبع التقديمات",
      "دعم عبر البريد الإلكتروني",
    ],
    disabled: true,
  },
  {
    name: "احترافي",
    nameEn: "Pro",
    price: "قريباً",
    period: "",
    icon: <Star size={22} strokeWidth={1.5} />,
    color: "#fff",
    border: "#fff",
    bg: "#0f0f0f",
    badge: "الأكثر طلباً",
    features: [
      "تقديم تلقائي حتى 10 وظائف يومياً",
      "رسائل تغطية متقدمة بالذكاء الاصطناعي",
      "أولوية في مطابقة الوظائف",
      "تقارير أسبوعية للتقديمات",
      "دعم أولوية",
      "إيميل تقديم مخصص",
    ],
    disabled: true,
    featured: true,
  },
  {
    name: "بريميوم",
    nameEn: "Premium",
    price: "قريباً",
    period: "",
    icon: <Sparkles size={22} strokeWidth={1.5} />,
    color: "#a78bfa",
    border: "#6d28d922",
    bg: "#0d0b14",
    features: [
      "تقديم تلقائي غير محدود",
      "تخصيص كامل لرسائل التغطية",
      "أولوية قصوى في المطابقة",
      "تقارير يومية تفصيلية",
      "مدير حساب مخصص",
      "جميع مميزات خطة احترافي",
    ],
    disabled: true,
  },
];

export default function StorePage() {
  return (
    <div style={s.page} dir="rtl">
      <nav style={s.nav}>
        <div style={s.navInner}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}><Briefcase size={18} strokeWidth={1.5} color="#0a0a0a" /></div>
            <span style={s.logoText}>Jobbots</span>
          </Link>
          <Link href="/portal/login" style={s.navBtn}>دخول المشترك</Link>
        </div>
      </nav>

      <main style={s.main}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.comingSoonBadge}>
            <Sparkles size={12} />
            <span>قريباً</span>
          </div>
          <h1 style={s.title}>اختر خطتك</h1>
          <p style={s.sub}>
            نعمل على تجهيز خطط الاشتراك — ستكون متاحة قريباً.<br />
            حالياً يمكنك الحصول على كود تفعيل بالتواصل معنا مباشرة.
          </p>
          <a href="mailto:support@jobbots.org" style={s.contactBtn}>
            تواصل معنا للاشتراك
          </a>
        </div>

        {/* Plans */}
        <div style={s.plansGrid}>
          {plans.map((plan) => (
            <div key={plan.nameEn} style={{
              ...s.planCard,
              border: plan.featured ? "1px solid #444" : `1px solid ${plan.border}`,
              background: plan.bg,
              position: "relative",
              opacity: 0.7,
            }}>
              {plan.badge && (
                <div style={s.planBadge}>{plan.badge}</div>
              )}

              {/* Lock overlay */}
              <div style={s.lockOverlay}>
                <div style={s.lockIcon}><Lock size={20} strokeWidth={1.5} color="#555" /></div>
                <span style={{ color: "#555", fontSize: 13, fontWeight: 600 }}>قريباً</span>
              </div>

              <div style={{ ...s.planIconWrap, color: plan.color, filter: "grayscale(0.5)" }}>
                {plan.icon}
              </div>
              <div style={s.planName}>{plan.name}</div>
              <div style={s.planPrice}>قريباً</div>

              <div style={s.divider} />

              <ul style={s.featureList}>
                {plan.features.map((f, i) => (
                  <li key={i} style={s.featureItem}>
                    <Check size={13} strokeWidth={2.5} color="#444" />
                    <span style={{ color: "#666" }}>{f}</span>
                  </li>
                ))}
              </ul>

              <button style={s.disabledBtn} disabled>
                قريباً
              </button>
            </div>
          ))}
        </div>

        {/* FAQ teaser */}
        <div style={s.faqSection}>
          <h2 style={s.faqTitle}>أسئلة شائعة</h2>
          <div style={s.faqGrid}>
            {[
              { q: "كيف أحصل على اشتراك الآن؟", a: "حالياً عن طريق التواصل معنا مباشرة على support@jobbots.org للحصول على كود تفعيل." },
              { q: "هل هناك تجربة مجانية؟", a: "نعمل على توفير فترة تجربة مجانية مع إطلاق المتجر رسمياً قريباً." },
              { q: "ما طرق الدفع المتاحة؟", a: "سندعم الدفع ببطاقات Visa/Mastercard ومدى وApple Pay عند الإطلاق." },
            ].map((item, i) => (
              <div key={i} style={s.faqCard}>
                <h3 style={s.faqQ}>{item.q}</h3>
                <p style={s.faqA}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer style={{ borderTop: "1px solid #1a1a1a", padding: "32px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <p style={{ color: "#444", fontSize: 13, margin: 0 }}>© {new Date().getFullYear()} Jobbots. جميع الحقوق محفوظة.</p>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/privacy" style={{ color: "#555", fontSize: 13, textDecoration: "none" }}>سياسة الخصوصية</Link>
            <Link href="/terms" style={{ color: "#555", fontSize: 13, textDecoration: "none" }}>الشروط والأحكام</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column" },
  nav: { borderBottom: "1px solid #1a1a1a", padding: "0 24px" },
  navInner: { maxWidth: 1100, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  logoIcon: { width: 34, height: 34, borderRadius: 9, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 17, fontWeight: 800 },
  navBtn: { background: "#fff", color: "#0a0a0a", padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none" },
  main: { flex: 1, padding: "70px 24px" },
  header: { textAlign: "center", maxWidth: 560, margin: "0 auto 64px" },
  comingSoonBadge: {
    display: "inline-flex", alignItems: "center", gap: 6,
    background: "#1a1200", border: "1px solid #f59e0b33", borderRadius: 100,
    padding: "5px 14px", fontSize: 12, color: "#f59e0b", marginBottom: 16,
  },
  title: { fontSize: 46, fontWeight: 900, color: "#fff", margin: "0 0 14px" },
  sub: { fontSize: 16, color: "#555", lineHeight: 1.8, margin: "0 0 28px" },
  contactBtn: {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "#fff", color: "#0a0a0a", padding: "14px 28px",
    borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none",
  },
  plansGrid: { maxWidth: 1000, margin: "0 auto 80px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 },
  planCard: { borderRadius: 20, padding: "32px 28px", display: "flex", flexDirection: "column", gap: 0 },
  planBadge: {
    position: "absolute", top: -12, right: 24,
    background: "#fff", color: "#0a0a0a", borderRadius: 100,
    padding: "3px 12px", fontSize: 11, fontWeight: 700,
  },
  lockOverlay: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 6, marginBottom: 20,
  },
  lockIcon: {
    width: 40, height: 40, borderRadius: 12, background: "#1a1a1a",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  planIconWrap: { display: "none" },
  planName: { color: "#888", fontSize: 18, fontWeight: 700, textAlign: "center", marginBottom: 6 },
  planPrice: { color: "#555", fontSize: 15, fontWeight: 600, textAlign: "center", marginBottom: 20 },
  divider: { height: 1, background: "#1f1f1f", margin: "16px 0" },
  featureList: { listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 12 },
  featureItem: { display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13 },
  disabledBtn: {
    width: "100%", padding: "13px", borderRadius: 12,
    background: "#1a1a1a", border: "1px solid #2a2a2a",
    color: "#444", fontSize: 14, fontWeight: 700, cursor: "not-allowed",
    marginTop: "auto",
  },
  faqSection: { maxWidth: 860, margin: "0 auto" },
  faqTitle: { color: "#fff", fontSize: 24, fontWeight: 800, textAlign: "center", margin: "0 0 28px" },
  faqGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 },
  faqCard: { background: "#111", border: "1px solid #1f1f1f", borderRadius: 14, padding: "22px" },
  faqQ: { color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 10px" },
  faqA: { color: "#666", fontSize: 13, lineHeight: 1.8, margin: 0 },
};
