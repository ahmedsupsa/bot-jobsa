import Link from "next/link";
import { Briefcase } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "سياسة الخصوصية — Jobbots",
  description: "سياسة الخصوصية لمنصة Jobbots وكيفية تعاملنا مع بياناتك الشخصية.",
};

export default function PrivacyPage() {
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
          <div style={s.badge}>سياسة الخصوصية</div>
          <h1 style={s.title}>كيف نحمي بياناتك</h1>
          <p style={s.lastUpdate}>آخر تحديث: أبريل 2025</p>

          <div style={s.content}>
            <Section title="مقدمة">
              تلتزم منصة Jobbots بحماية خصوصية مستخدميها والحفاظ على سرية معلوماتهم الشخصية. تشرح هذه السياسة كيفية جمع بياناتك واستخدامها وحمايتها.
            </Section>

            <Section title="البيانات التي نجمعها">
              <ul style={s.list}>
                <li>المعلومات الشخصية: الاسم، رقم الجوال، المدينة، العمر.</li>
                <li>بيانات الاتصال: البريد الإلكتروني المستخدم للتقديم على الوظائف.</li>
                <li>السيرة الذاتية: ملف PDF أو صورة ترفعها لاستخدامه في التقديم.</li>
                <li>تفضيلات الوظائف: المجالات والمناطق التي تفضّل العمل بها.</li>
                <li>سجل التقديمات: قائمة الوظائف التي قدّم النظام عليها باسمك.</li>
              </ul>
            </Section>

            <Section title="كيف نستخدم بياناتك">
              <ul style={s.list}>
                <li>إنشاء وإدارة حسابك على المنصة.</li>
                <li>التقديم التلقائي على الوظائف المناسبة لك.</li>
                <li>توليد رسائل تغطية احترافية مخصصة بالذكاء الاصطناعي.</li>
                <li>تزويدك بتقارير وإشعارات حول التقديمات المُرسلة.</li>
                <li>تحسين خدماتنا وجودة التطابق الوظيفي.</li>
              </ul>
            </Section>

            <Section title="مشاركة البيانات مع أطراف ثالثة">
              <strong style={{ color: "#fff" }}>لا نبيع بياناتك ولا نشاركها</strong> مع أي طرف ثالث لأغراض تجارية. البيانات تُشارك فقط في الحالات التالية:
              <ul style={s.list}>
                <li>أصحاب العمل: يُرسل فقط اسمك وبريدك وسيرتك الذاتية عند التقديم على وظيفة.</li>
                <li>مزودو الخدمات: نستخدم Supabase لقواعد البيانات و Resend لإرسال البريد، وهم ملتزمون بمعايير الأمن الصارمة.</li>
                <li>الذكاء الاصطناعي: يُستخدم Gemini AI لكتابة رسائل التغطية من Google وهو ملتزم بسياسات الخصوصية الخاصة به.</li>
              </ul>
            </Section>

            <Section title="حماية البيانات">
              <ul style={s.list}>
                <li>تُخزّن جميع البيانات على خوادم مشفّرة (SSL/TLS).</li>
                <li>الوصول إلى البيانات محدود للمشرفين المصرّح لهم فقط.</li>
                <li>لا يتم الاحتفاظ ببيانات بطاقات الدفع — جميع المعاملات المالية عبر بوابات دفع آمنة.</li>
              </ul>
            </Section>

            <Section title="حقوقك">
              يحق لك في أي وقت:
              <ul style={s.list}>
                <li>الاطلاع على البيانات المحفوظة عنك.</li>
                <li>طلب تعديل أو تصحيح بياناتك.</li>
                <li>طلب حذف حسابك وجميع بياناتك نهائياً.</li>
                <li>الاعتراض على استخدام بياناتك لأغراض معينة.</li>
              </ul>
              للتواصل بشأن هذه الحقوق: <a href="mailto:support@jobbots.org" style={s.link}>support@jobbots.org</a>
            </Section>

            <Section title="ملفات تعريف الارتباط (Cookies)">
              نستخدم ملفات تعريف الارتباط فقط لحفظ جلسة تسجيل دخولك وتفضيلاتك الأساسية. لا نستخدم ملفات تتبع إعلانية.
            </Section>

            <Section title="تحديثات السياسة">
              قد نحدّث هذه السياسة من وقت لآخر. سنُعلمك بأي تغييرات جوهرية عبر البريد الإلكتروني المسجّل. الاستمرار في استخدام المنصة بعد التحديث يعني موافقتك على السياسة الجديدة.
            </Section>
          </div>
        </div>
      </main>

      <Footer />
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

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #1a1a1a", padding: "32px 24px" }} dir="rtl">
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <p style={{ color: "#444", fontSize: 13, margin: 0 }}>© {new Date().getFullYear()} Jobbots. جميع الحقوق محفوظة.</p>
        <div style={{ display: "flex", gap: 20 }}>
          <Link href="/privacy" style={{ color: "#555", fontSize: 13, textDecoration: "none" }}>سياسة الخصوصية</Link>
          <Link href="/terms" style={{ color: "#555", fontSize: 13, textDecoration: "none" }}>الشروط والأحكام</Link>
        </div>
      </div>
    </footer>
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
  title: { fontSize: 38, fontWeight: 900, color: "#fff", margin: "0 0 10px" },
  lastUpdate: { color: "#444", fontSize: 13, margin: "0 0 48px" },
  content: {},
  list: { marginTop: 10, paddingRight: 20, display: "flex", flexDirection: "column", gap: 8 } as React.CSSProperties,
  link: { color: "#fff", fontWeight: 600 },
};
