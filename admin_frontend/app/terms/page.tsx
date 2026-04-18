import Link from "next/link";
import { Briefcase } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الشروط والأحكام — Jobbots",
  description: "اقرأ شروط وأحكام استخدام منصة Jobbots للتقديم التلقائي على الوظائف.",
};

export default function TermsPage() {
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
        <div style={s.inner}>
          <div style={s.badge}>الشروط والأحكام</div>
          <h1 style={s.title}>شروط الاستخدام</h1>
          <p style={s.lastUpdate}>آخر تحديث: أبريل 2025</p>

          <div style={s.content}>
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

            <Section title="التواصل">
              لأي استفسار بشأن هذه الشروط تواصل معنا عبر: <a href="mailto:support@jobbots.org" style={s.link}>support@jobbots.org</a>
            </Section>
          </div>
        </div>
      </main>

      <footer style={{ borderTop: "1px solid #1a1a1a", padding: "32px 24px" }} dir="rtl">
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: "0 0 14px", borderRight: "3px solid #fff", paddingRight: 12 }}>{title}</h2>
      <div style={{ color: "#888", fontSize: 15, lineHeight: 2 }}>{children}</div>
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
  main: { flex: 1, padding: "60px 24px" },
  inner: { maxWidth: 760, margin: "0 auto" },
  badge: { display: "inline-block", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 100, padding: "4px 14px", fontSize: 12, color: "#888", marginBottom: 16 },
  title: { fontSize: "clamp(26px, 6vw, 38px)", fontWeight: 900, color: "#fff", margin: "0 0 10px" },
  lastUpdate: { color: "#444", fontSize: 13, margin: "0 0 48px" },
  content: {},
  list: { marginTop: 10, paddingRight: 20, display: "flex", flexDirection: "column", gap: 8 } as React.CSSProperties,
  link: { color: "#fff", fontWeight: 600 },
};
