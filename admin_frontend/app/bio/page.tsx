import Image from "next/image";
import type { Metadata } from "next";
import { ShoppingBag, Check,CreditCard, Building2, Sparkles, Timer, Zap, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "بوت التقديم على الوظائف | 7 ريال فقط بالشهر",
  description: "وفّر وقتك وقدّم على الوظائف تلقائياً بذكاء اصطناعي. اقل من 7 ريال بالشهر.",
};

export default function BioPage() {
  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, maxWidth: 520, margin: "0 auto", padding: "32px 16px", width: "100%" }}>
        
        {/* رأس */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, margin: "0 auto 14px", borderRadius: 16, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(59,130,246,0.3)" }}>
            <Image src="/logo-transparent.png" alt="" width={36} height={36} style={{ display: "block" }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>
            التقديم التلقائي على الوظائف
          </h1>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.7 }}>
            قدّم على مئات الوظائف في السعودية بدون تعب —<br />
            البوت يشتغل عنك 24 ساعة
          </p>
        </div>

        {/* بطاقة السعر */}
        <div style={{ background: "linear-gradient(135deg, #1e3a5f, #1a1a2e)", borderRadius: 20, padding: "28px 24px", marginBottom: 16, border: "1px solid rgba(59,130,246,0.2)", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "rgba(59,130,246,0.08)" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "inline-block", background: "rgba(59,130,246,0.15)", color: "#60a5fa", fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 20, marginBottom: 12 }}>
              🔥 عرض رمضان — لفترة محدودة
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 48, fontWeight: 900, color: "#fff", lineHeight: 1 }}>٩٠</span>
              <span style={{ fontSize: 16, color: "#94a3b8", fontWeight: 600 }}>ريال</span>
            </div>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 6px" }}>
              <span style={{ color: "#4ade80", fontWeight: 700 }}>سنوياً</span> — أقل من <strong style={{ color: "#fff" }}>٧ ريال</strong> بالشهر
            </p>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 20px" }}>
              قيمة اشتراك كامل لمدة سنة — ولا يمديك تدفعها كلها
            </p>

            {/* طرق الدفع */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.05)", padding: "10px 14px", borderRadius: 10 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 13 }}><CreditCard size={16} /> تمارا</span>
                <span style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600 }}>٦ دفعات ١٥ ريال</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.05)", padding: "10px 14px", borderRadius: 10 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 13 }}><Building2 size={16} /> حوالة بنكية</span>
                <span style={{ color: "#4ade80", fontSize: 12, fontWeight: 600 }}>خصم ١٥٪ = ٧٦.٥ ريال</span>
              </div>
            </div>

            <a
              href="https://www.jobbots.org/store"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", padding: "14px 0", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 4px 16px rgba(59,130,246,0.4)" }}
            >
              <ShoppingBag size={18} /> اشترك الآن — اقل من ٧ ريال بالشهر
            </a>
          </div>
        </div>

        {/* مميزات سريعة */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { icon: <Timer size={16} />, text: "تقديم كل ٣٠ دقيقة" },
            { icon: <Sparkles size={16} />, text: "رسالة مخصصة لكل وظيفة" },
            { icon: <Zap size={16} />, text: "شغال ٢٤ ساعة" },
            { icon: <Check size={16} />, text: "لوحة تحكم كاملة" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px" }}>
              <span style={{ color: "#60a5fa", display: "flex" }}>{item.icon}</span>
              <span style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* كيف يشتغل — بشكل سريع */}
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: "20px 18px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 14px", textAlign: "center" }}>
            وش يضبطك بالضبط؟
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { num: "١", text: "ترفع سيرتك الذاتية مرة وحدة" },
              { num: "٢", text: "تحدد مجالك والمناطق اللي تبيها" },
              { num: "٣", text: "تربط إيميلك — والبوت يقدّم عنك كل ٣٠ دقيقة" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(59,130,246,0.15)", color: "#60a5fa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {s.num}
                </div>
                <span style={{ color: "#cbd5e1", fontSize: 13 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* كلام تحفيزي */}
        <div style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))", borderRadius: 16, padding: "20px 18px", marginBottom: 12, textAlign: "center", border: "1px solid rgba(59,130,246,0.1)" }}>
          <p style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.8, margin: 0 }}>
            <strong style={{ color: "#60a5fa" }}>تخيل</strong> بدال ما تقضي ساعات كل يوم في التقديم على وظايف وانت تدور وتكرر نفس المعلومات —
            <strong style={{ color: "#fff" }}> البوت يقدم عنك وأنت نايم أو مشغول أو حتى في المقابلة</strong>.
            فقط ارفع سيرتك مرة وحدة وخل الذكاء الاصطناعي يشتغل.
          </p>
        </div>

        {/* CTA أخير */}
        <div style={{ textAlign: "center", padding: "8px 0 0" }}>
          <a
            href="https://www.jobbots.org/store"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#94a3b8", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
          >
            شوف الباقات والمتجر <ArrowLeft size={14} />
          </a>
        </div>
      </main>
    </div>
  );
}
