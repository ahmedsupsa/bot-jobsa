import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "سياسة الخصوصية — Jobbots",
  description: "سياسة الخصوصية لمنصة Jobbots وكيفية تعاملنا مع بياناتك الشخصية.",
};

export default function PrivacyPage() {
  return (
    <div style={s.page} dir="rtl">
      {/* NAV */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <Link href="/" style={s.logo}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 5, flexShrink: 0 }}>
              <Image src="/logo-transparent.png" alt="Jobbots" width={24} height={24} style={{ display: "block" }} />
            </div>
            <span style={s.logoText}>Jobbots</span>
          </Link>
          <Link href="/portal/login" style={s.navBtn}>دخول المشترك</Link>
        </div>
      </nav>

      <main style={s.main}>
        <div style={s.inner}>

          {/* Header */}
          <div style={s.headerWrap}>
            <span style={s.badge}>سياسة الخصوصية</span>
            <h1 style={s.title}>كيف نحمي بياناتك</h1>
            <p style={s.lastUpdate}>آخر تحديث: أبريل 2025</p>
          </div>

          {/* Sections */}
          <div style={s.sections}>
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
              <strong style={{ color: "var(--text)" }}>لا نبيع بياناتك ولا نشاركها</strong> مع أي طرف ثالث لأغراض تجارية. البيانات تُشارك فقط في الحالات التالية:
              <ul style={s.list}>
                <li>أصحاب العمل: يُرسل فقط اسمك وبريدك وسيرتك الذاتية عند التقديم على وظيفة.</li>
                <li>مزودو الخدمات: نستخدم Supabase لقواعد البيانات وهو ملتزم بمعايير الأمن الصارمة.</li>
                <li>الذكاء الاصطناعي: يُستخدم Gemini AI من Google لكتابة رسائل التغطية وهو ملتزم بسياسات الخصوصية الخاصة به.</li>
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
              للتواصل بشأن هذه الحقوق:{" "}
              <a href="mailto:support@jobbots.org" style={s.link}>support@jobbots.org</a>
            </Section>

            <Section title="ملفات تعريف الارتباط (Cookies)">
              نستخدم ملفات تعريف الارتباط فقط لحفظ جلسة تسجيل دخولك وتفضيلاتك الأساسية. لا نستخدم ملفات تتبع إعلانية.
            </Section>

            <Section title="تحديثات السياسة" last>
              قد نحدّث هذه السياسة من وقت لآخر. سنُعلمك بأي تغييرات جوهرية عبر البريد الإلكتروني المسجّل. الاستمرار في استخدام المنصة بعد التحديث يعني موافقتك على السياسة الجديدة.
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
