import Image from "next/image";
import type { Metadata } from "next";
import { ShoppingBag, CreditCard, Building2, Timer, Sparkles, Zap, Check, ArrowLeft, Star, Bot } from "lucide-react";

export const metadata: Metadata = {
  title: "بوت التقديم على الوظائف | 7 ريال فقط بالشهر",
  description: "وفّر وقتك وقدّم على الوظائف تلقائياً بذكاء اصطناعي. اقل من 7 ريال بالشهر.",
};

export default function BioPage() {
  const yr = new Date().getFullYear();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, maxWidth: 520, margin: "0 auto", padding: "32px 16px", width: "100%" }}>

        {/* رأس */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, margin: "0 auto 14px", borderRadius: 16, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Image src="/logo-transparent.png" alt="" width={36} height={36} style={{ display: "block" }} />
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 6px" }}>
            التقديم التلقائي على الوظائف
          </h1>
          <p style={{ fontSize: 13, color: "var(--text3)", margin: 0, lineHeight: 1.7 }}>
            قدّم على مئات الوظائف في السعودية بدون تعب —<br />
            البوت يشتغل عنك 24 ساعة
          </p>
        </div>

        {/* بطاقة السعر */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "28px 24px", marginBottom: 16, textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--text2)", fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 100, marginBottom: 12 }}>
            🔥 عرض لفترة محدودة
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: "var(--text)", lineHeight: 1, fontFamily: "var(--font-display)" }}>٩٠</span>
            <span style={{ fontSize: 16, color: "var(--text3)", fontWeight: 600 }}>ريال</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text3)", margin: "0 0 6px" }}>
            <span style={{ color: "var(--text)", fontWeight: 700 }}>سنوياً</span> — أقل من <strong style={{ color: "var(--text)" }}>٧ ريال</strong> بالشهر
          </p>
          <p style={{ fontSize: 12, color: "var(--text4)", margin: "0 0 20px" }}>
            قيمة اشتراك كامل لمدة سنة — ولا يمديك تدفعها كلها
          </p>

          {/* طرق الدفع */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: 10 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text2)", fontSize: 13 }}><CreditCard size={16} /> تمارا</span>
              <span style={{ color: "var(--text)", fontSize: 12, fontWeight: 600 }}>٦ دفعات ١٥ ريال</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: 10 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text2)", fontSize: 13 }}><Building2 size={16} /> حوالة بنكية</span>
              <span style={{ color: "var(--text)", fontSize: 12, fontWeight: 600 }}>خصم ١٥٪ = ٧٦.٥ ريال</span>
            </div>
          </div>

          <a
            href="https://www.jobbots.org/store"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "var(--accent)", color: "var(--accent-fg)", padding: "14px 0", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none" }}
          >
            <ShoppingBag size={18} /> اشترك الآن — اقل من ٧ ريال بالشهر
          </a>
        </div>

        {/* مميزات سريعة */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { icon: <Timer size={16} />, text: "تقديم كل ٣٠ دقيقة" },
            { icon: <Sparkles size={16} />, text: "رسالة مخصصة لكل وظيفة" },
            { icon: <Zap size={16} />, text: "شغال ٢٤ ساعة" },
            { icon: <Check size={16} />, text: "لوحة تحكم كاملة" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
              <span style={{ color: "var(--text)", display: "flex" }}>{item.icon}</span>
              <span style={{ color: "var(--text2)", fontSize: 12, fontWeight: 600 }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* كيف يشتغل */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 18px", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 14px", textAlign: "center" }}>
            وش يضبطك بالضبط؟
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { num: "١", text: "ترفع سيرتك الذاتية مرة وحدة" },
              { num: "٢", text: "تحدد مجالك والمناطق اللي تبيها" },
              { num: "٣", text: "تربط إيميلك — والبوت يقدّم عنك كل ٣٠ دقيقة" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {s.num}
                </div>
                <span style={{ color: "var(--text2)", fontSize: 13 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* كلام تحفيزي */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 18px", marginBottom: 12, textAlign: "center" }}>
          <p style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.8, margin: 0 }}>
            <strong style={{ color: "var(--text)" }}>تخيل</strong> بدال ما تقضي ساعات كل يوم في التقديم على وظايف وانت تدور وتكرر نفس المعلومات —
            <strong style={{ color: "var(--text)" }}> البوت يقدم عنك وأنت نايم أو مشغول أو حتى في المقابلة</strong>.
            فقط ارفع سيرتك مرة وحدة وخل الذكاء الاصطناعي يشتغل.
          </p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", padding: "8px 0 0" }}>
          <a
            href="https://www.jobbots.org/store"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text3)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
          >
            شوف الباقات والمتجر <ArrowLeft size={14} />
          </a>
        </div>

        {/* بسيط */}
        <div style={{ textAlign: "center", marginTop: 32, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11, color: "var(--text4)", margin: 0 }}>© {yr} — جميع الحقوق محفوظة</p>
        </div>
      </main>
    </div>
  );
}
