import Image from "next/image";
import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { ShoppingBag, CheckCircle, Clock, Bot, BarChart3, Shield, TrendingUp, Sparkles, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "بوت التقديم على الوظائف بالذكاء الاصطناعي — روابط سريعة",
  description: "وفّر وقتك وخل الذكاء الاصطناعي يقدّم عنك على الوظائف في السعودية تلقائياً كل 30 دقيقة.",
};

export default function BioPage() {
  const features = [
    { icon: <Bot size={22} strokeWidth={1.5} />, title: "يقدّم عنك وانت نايم", desc: "كل 30 دقيقة البوت يدور على الوظائف ويقدّم عنك تلقائياً" },
    { icon: <Sparkles size={22} strokeWidth={1.5} />, title: "رسالة مخصصة لكل وظيفة", desc: "ذكاء اصطناعي يكتب رسالة تغطية تناسب كل وظيفة بشكل منفصل" },
    { icon: <BarChart3 size={22} strokeWidth={1.5} />, title: "لوحة تحكم كاملة", desc: "شوف كل الوظائف اللي قدّم عليها البوت باسمك و حالتها بالتفصيل" },
    { icon: <Shield size={22} strokeWidth={1.5} />, title: "بياناتك آمنة ومشفّرة", desc: "CV وبياناتك الشخصية محفوظة بأمان — ما تطلع لأي جهة ثانية" },
    { icon: <TrendingUp size={22} strokeWidth={1.5} />, title: "زد فرصك أضعاف", desc: "اللي يقدّم على وظائف أكثر يحصل على مقابلات أكثر — البوت يشتغل عنك" },
    { icon: <Clock size={22} strokeWidth={1.5} />, title: "وقتك لأهم الأشياء", desc: "ركّز على تحضير مقابلاتك والبوت يتكفل بالباقي" },
  ];

  const steps = [
    { num: "٠١", title: "اشترك واحصل على كود التفعيل", desc: "تواصل معنا واختار الباقة المناسبة — تحصل على كود تفعيل فوري" },
    { num: "٠٢", title: "ارفع CV وحدد تفضيلاتك", desc: "قول للبوت وش مجالك وأي منطقة تبي تشتغل فيها" },
    { num: "٠٣", title: "استنّى والوظيفة جاية لك", desc: "البوت يقدّم عنك كل 30 دقيقة — وانت تجلس وتنتظر المقابلات تجيك" },
  ];

  return (
    <div dir="rtl" className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <main className="flex-1">
        {/* HERO */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "52px 20px 40px", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, margin: "0 auto 20px", borderRadius: 16, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Image src="/logo-transparent.png" alt="شعار" width={40} height={40} style={{ display: "block" }} />
          </div>
          <h1 style={{ fontSize: "clamp(26px,6vw,40px)", fontWeight: 900, color: "var(--text)", margin: "0 0 12px", lineHeight: 1.2 }}>
            التقديم التلقائي على الوظائف{" "}
            <span style={{ color: "var(--accent)", display: "block" }}>بالذكاء الاصطناعي</span>
          </h1>
          <p style={{ fontSize: 16, color: "var(--text2)", margin: "0 auto 28px", lineHeight: 1.7, maxWidth: 580 }}>
            تعبت من التقديم اليدوي؟ خلّ البوت يقدّم عنك على الوظائف في السعودية تلقائياً كل 30 دقيقة — رسالة مخصصة لكل وظيفة.
          </p>

          {/* أزرار CTA */}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <a
              href="https://www.jobbots.org/store"
              style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--accent)", color: "var(--accent-fg)", padding: "14px 32px", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none" }}
            >
              <ShoppingBag size={18} /> اشترك وابدأ التقديم
            </a>
            <a
              href="https://www.jobbots.org/store"
              style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", color: "var(--text2)", padding: "14px 28px", borderRadius: 12, fontWeight: 600, fontSize: 15, textDecoration: "none", border: "1px solid var(--border2)" }}
            >
              شوف الباقات
            </a>
          </div>
        </section>

        {/* المميزات */}
        <section style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px 60px" }}>
          <h2 style={{ fontSize: "clamp(20px,4vw,28px)", fontWeight: 800, color: "var(--text)", textAlign: "center", margin: "0 0 32px" }}>
            ليش تختار البوت؟
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {features.map((f, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent)/10", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: "var(--text2)", margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* كيف يشتغل */}
        <section style={{ background: "var(--surface)", padding: "52px 20px 60px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <h2 style={{ fontSize: "clamp(20px,4vw,28px)", fontWeight: 800, color: "var(--text)", textAlign: "center", margin: "0 0 36px" }}>
              كيف يشتغل؟
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", background: "var(--bg)", padding: "18px 20px", borderRadius: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent)", color: "var(--accent-fg)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    {s.num}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>{s.title}</h3>
                    <p style={{ fontSize: 13, color: "var(--text2)", margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* دليل اجتماعي */}
        <section style={{ maxWidth: 700, margin: "0 auto", padding: "36px 20px 40px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--accent)" }}>+500</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>تقديم يومي</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--accent)" }}>30</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>دقيقة لكل دورة</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--accent)" }}>٪100</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>تلقائي بالكامل</div>
            </div>
          </div>
        </section>

        {/* CTA أخير */}
        <section style={{ background: "var(--text)", padding: "48px 20px", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(20px,4vw,26px)", fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
            جرب البوت الآن
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", margin: "0 0 24px" }}>
            اشترك وخلّ البوت يشتغل عنك — ما بتندم
          </p>
          <a
            href="https://www.jobbots.org/store"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "var(--text)", padding: "12px 28px", borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: "none" }}
          >
            <Zap size={18} /> ابدأ الآن
          </a>
        </section>
      </main>

      <Footer />
    </div>
  );
}
