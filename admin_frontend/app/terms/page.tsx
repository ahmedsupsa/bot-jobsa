import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الشروط والأحكام — Jobbots",
  description: "اقرأ شروط وأحكام استخدام منصة Jobbots للتقديم التلقائي على الوظائف.",
};

export default function TermsPage() {
  return (
    <div style={s.page} dir="rtl">
      {/* NAV */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <Link href="/" style={s.logo}>
            <Image src="/logo.png" alt="Jobbots" width={34} height={34} style={{ borderRadius: 9 }} />
            <span style={s.logoText}>Jobbots</span>
          </Link>
          <Link href="/portal/login" style={s.navBtn}>دخول المشترك</Link>
        </div>
      </nav>

      <main style={s.main}>
        <div style={s.inner}>

          {/* Header */}
          <div style={s.headerWrap}>
            <span style={s.badge}>الشروط والأحكام</span>
            <h1 style={s.title}>شروط الاستخدام</h1>
            <p style={s.lastUpdate}>آخر تحديث: أبريل 2025</p>
          </div>

          {/* Sections */}
          <div style={s.sections}>
            <Section title="القبول بالشروط">
              باستخدامك لمنصة Jobbots، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي من هذه الشروط، يُرجى التوقف عن استخدام المنصة.
            </Section>

            <Section title="وصف الخدمة">
              Jobbots منصة إلكترونية تقدّم خدمة التقديم التلقائي على الوظائف باستخدام الذكاء الاصطناعي. تعمل المنصة على:
              <ul style={s.list}>
                <li>إرسال طلبات التوظيف بالبريد الإلكتروني لأصحاب العمل نيابةً عنك.</li>
                <li>توليد رسائل تغطية مخصصة لكل وظيفة باستخدام الذكاء الاصطناعي.</li>
                <li>مطابقة الوظائف المتاحة مع تفضيلاتك ومهاراتك.</li>
              </ul>
            </Section>

            <Section title="الاشتراك والدفع">
              <ul style={s.list}>
                <li>الاشتراك يُفعّل بكود تفعيل صالح يُمنح عند الاشتراك.</li>
                <li>مدة الاشتراك محددة بعدد الأيام المتفق عليها من تاريخ التفعيل.</li>
                <li>لا يحق استرداد الرسوم بعد تفعيل الاشتراك واستخدام الخدمة إلا في حالات الأعطال التقنية من جانبنا.</li>
                <li>نحتفظ بحق تغيير أسعار الخطط مع إشعار مسبق للمشتركين الحاليين.</li>
              </ul>
            </Section>

            <Section title="التزامات المستخدم">
              بالتسجيل في المنصة، تؤكد وتلتزم بما يلي:
              <ul style={s.list}>
                <li>أن المعلومات المُقدَّمة (السيرة الذاتية والبيانات الشخصية) صحيحة ودقيقة.</li>
                <li>أنك تملك الحق الكامل في استخدام السيرة الذاتية المرفوعة.</li>
                <li>عدم استخدام المنصة لأي أغراض مخالفة للنظام أو المعايير الأخلاقية.</li>
                <li>عدم مشاركة كود التفعيل الخاص بك مع أي شخص آخر.</li>
                <li>أنك فوق سن السابعة عشرة من العمر.</li>
              </ul>
            </Section>

            <Section title="حدود المسؤولية">
              <ul style={s.list}>
                <li>Jobbots وسيط تقني يرسل طلبات التوظيف نيابةً عنك — لا نضمن الحصول على وظيفة أو الرد من أصحاب العمل.</li>
                <li>لسنا مسؤولين عن قرارات التوظيف التي يتخذها أصحاب العمل.</li>
                <li>في حالات الأعطال التقنية، نسعى لإصلاحها بأسرع وقت ممكن ولكن لا نضمن الاستمرارية الكاملة.</li>
                <li>لا نتحمل مسؤولية أي ضرر ناتج عن معلومات خاطئة قدّمها المستخدم.</li>
              </ul>
            </Section>

            <Section title="الملكية الفكرية">
              جميع محتويات المنصة من تصميم وكود وعلامة تجارية هي ملك حصري لـ Jobbots. يُمنع نسخ أو إعادة استخدام أي جزء من المنصة دون إذن كتابي مسبق.
            </Section>

            <Section title="إنهاء الحساب">
              نحتفظ بالحق في إيقاف أو حذف أي حساب في حال:
              <ul style={s.list}>
                <li>مخالفة أي من هذه الشروط.</li>
                <li>استخدام المنصة بطريقة مسيئة أو احتيالية.</li>
                <li>انتهاء مدة الاشتراك دون تجديد.</li>
              </ul>
            </Section>

            <Section title="القانون المطبّق">
              تخضع هذه الشروط لنظام المملكة العربية السعودية. أي نزاع ينشأ عنها يُحسم وفق الأنظمة والتشريعات السعودية المعمول بها.
            </Section>

            <Section title="التواصل" last>
              لأي استفسار بشأن هذه الشروط تواصل معنا عبر:{" "}
              <a href="mailto:support@jobbots.org" style={s.link}>support@jobbots.org</a>
            </Section>
          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <span style={s.footerCopy}>© {new Date().getFullYear()} Jobbots. جميع الحقوق محفوظة.</span>
          <div style={{ display: "flex", gap: 22 }}>
            <Link href="/privacy" style={s.footerLink}>الخصوصية</Link>
            <Link href="/terms" style={s.footerLink}>الشروط</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: "22px 24px",
      marginBottom: last ? 0 : 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 3, height: 20, borderRadius: 2,
          background: "var(--accent)",
          flexShrink: 0,
        }} />
        <h2 style={{ color: "var(--text)", fontSize: 16, fontWeight: 800, margin: 0 }}>{title}</h2>
      </div>
      <div style={{ color: "var(--text2)", fontSize: 14, lineHeight: 2 }}>{children}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", color: "var(--text)", fontFamily: "'Tajawal', system-ui, sans-serif" },

  nav: { borderBottom: "1px solid var(--border)", padding: "0 24px", background: "var(--surface)" },
  navInner: { maxWidth: 1100, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  logoText: { color: "var(--text)", fontSize: 17, fontWeight: 800 },
  navBtn: { background: "var(--accent)", color: "var(--accent-fg)", padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none" },

  main: { flex: 1, padding: "60px 24px 80px" },
  inner: { maxWidth: 760, margin: "0 auto" },

  headerWrap: { marginBottom: 36, textAlign: "center" as const },
  badge: { display: "inline-block", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 100, padding: "4px 14px", fontSize: 12, color: "var(--text3)", marginBottom: 16, fontWeight: 600 },
  title: { fontSize: "clamp(26px, 6vw, 38px)", fontWeight: 900, color: "var(--text)", margin: "0 0 10px" },
  lastUpdate: { color: "var(--text3)", fontSize: 13, margin: 0 },

  sections: {},
  list: { marginTop: 10, paddingRight: 20, display: "flex", flexDirection: "column", gap: 9 } as React.CSSProperties,
  link: { color: "var(--text)", fontWeight: 700 },

  footer: { borderTop: "1px solid var(--border)", padding: "24px", background: "var(--surface)" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 12 },
  footerCopy: { color: "var(--text3)", fontSize: 12.5 },
  footerLink: { color: "var(--text3)", fontSize: 12.5, textDecoration: "none" },
};
