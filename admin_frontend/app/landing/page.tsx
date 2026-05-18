"use client";

import { Zap, BrainCircuit, Mail, ArrowRight, ShieldCheck, Clock, Send, ShoppingBag, Users, Gift } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function useOfferCountdown() {
  const getState = () => {
    const now = new Date();
    const totalSeconds = now.getMinutes() * 60 + now.getSeconds();
    const pos = totalSeconds % 1800;
    if (pos < 900) {
      return { active: true, secondsLeft: 900 - pos };
    } else {
      return { active: false, secondsLeft: 1800 - pos };
    }
  };

  const [state, setState] = useState<{ active: boolean; secondsLeft: number } | null>(null);

  useEffect(() => {
    setState(getState());
    const t = setInterval(() => setState(getState()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!state) return { active: true, secondsLeft: 900, label: "15:00", mounted: false };
  const m = Math.floor(state.secondsLeft / 60).toString().padStart(2, "0");
  const s = (state.secondsLeft % 60).toString().padStart(2, "0");
  return { ...state, label: `${m}:${s}`, mounted: true };
}

export default function LandingPage() {
  const offer = useOfferCountdown();

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto py-12 px-4">

        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold mb-4">
            <Zap size={14} /> التقديم التلقائي بالذكاء الاصطناعي
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-ink leading-tight mb-6">
            لا تضيّع وقتك في التقديم اليدوي.<br />
            <span className="text-accent">Jobbots يقوم بالعمل الشاق نيابة عنك.</span>
          </h1>
          <p className="text-muted text-lg mb-8 max-w-2xl mx-auto">
            تعبت من التقديم على الوظائف ومحد يرد عليك؟ Jobbots يفك أزمتك؛ يحلل سيرتك، يضبط لك خطاب تغطية احترافي، ويقدم على الوظائف اللي تناسبك تلقائياً وبأسرع وقت!
          </p>

          {/* Offer Timer Box */}
          <div
            style={{
              background: offer.active ? "var(--surface)" : "var(--surface2)",
              border: `1.5px solid ${offer.active ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 18,
              padding: "18px 24px",
              maxWidth: 420,
              margin: "0 auto 28px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              transition: "all 0.4s",
            }}
          >
            {offer.active ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulse 1.5s infinite" }} />
                  <span style={{ color: "var(--text2)", fontSize: 13, fontWeight: 700 }}>عرض التجربة متاح الآن</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 42, fontWeight: 900, color: "var(--text)", letterSpacing: "-2px", fontVariantNumeric: "tabular-nums" }}>
                    {offer.label}
                  </span>
                  <span style={{ color: "var(--text3)", fontSize: 13 }}>دقيقة متبقية</span>
                </div>
                <Link
                  href="/store"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    background: "var(--accent)",
                    color: "var(--accent-fg)",
                    padding: "12px 20px",
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 15,
                    textDecoration: "none",
                  }}
                >
                  جرّب Jobbots لمدة 7 أيام بـ 12 ر.س <ArrowRight size={16} />
                </Link>
                <p style={{ color: "var(--text4)", fontSize: 11, margin: 0 }}>العرض يتجدد كل نصف ساعة</p>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text4)" }} />
                  <span style={{ color: "var(--text3)", fontSize: 13, fontWeight: 700 }}>العرض منتهي مؤقتاً</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text3)" }}>العرض القادم خلال</span>
                  <span style={{ fontSize: 28, fontWeight: 900, color: "var(--text2)", letterSpacing: "-1px", fontVariantNumeric: "tabular-nums" }}>
                    {offer.label}
                  </span>
                </div>
                <Link
                  href="/store"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    background: "var(--surface2)",
                    color: "var(--text2)",
                    border: "1px solid var(--border)",
                    padding: "12px 20px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  تصفح الباقات <ArrowRight size={15} />
                </Link>
              </>
            )}
          </div>

          <a
            href="https://t.me/ahmedsupsa"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-[#229ED9] text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all text-sm"
          >
            <Send size={16} /> استفسر على تيليجرام @ahmedsupsa
          </a>
        </div>

        {/* Benefits Section */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {[
            { icon: Clock, title: "وفر وقتك", desc: "بدال ما تضيع ساعاتك بالتقديم، Jobbots يخلص لك الشغل وأنت مرتاح." },
            { icon: BrainCircuit, title: "ذكاء اصطناعي يفهمك", desc: "خوارزمياتنا تحلل الوظيفة وتكتب لك Cover Letter يخليك تبرز قدام مسؤول التوظيف." },
            { icon: ShieldCheck, title: "شغل احترافي", desc: "التقديم يوصل من إيميلك الشخصي، يعني كأنك أنت اللي مقدم بنفسك." },
          ].map((item, i) => (
            <div key={i} className="bg-panel border border-line p-6 rounded-2xl">
              <div className="h-12 w-12 rounded-xl bg-panel2 flex items-center justify-center text-accent mb-4">
                <item.icon size={24} />
              </div>
              <h3 className="font-bold text-ink mb-2">{item.title}</h3>
              <p className="text-sm text-muted">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* How it Works */}
        <div className="bg-panel border border-line rounded-3xl p-8 md:p-12 mb-10">
          <h2 className="text-2xl font-bold text-ink mb-8 text-center">كيف يبدأ Jobbots العمل؟</h2>
          <div className="space-y-6">
            {[
              { step: "01", title: "ارفع سيرتك الذاتية", desc: "حلل مهاراتك وخبراتك بدقة." },
              { step: "02", title: "نحدد الوظائف المناسبة", desc: "نبحث عن الوظائف اللي تناسب مؤهلاتك وتجيب لك مقابلات." },
              { step: "03", title: "نقدم عنك تلقائياً", desc: "نرسل طلبك مع رسالة تغطية احترافية فوراً." },
            ].map((s, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="text-2xl font-black text-accent/30">{s.step}</div>
                <div>
                  <h4 className="font-bold text-ink">{s.title}</h4>
                  <p className="text-sm text-muted">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Telegram Channel Section */}
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            border: "1px solid #334155",
            borderRadius: 24,
            padding: "32px 32px 28px",
            marginBottom: 40,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: -30, left: -30, width: 160, height: 160, background: "#229ED9", borderRadius: "50%", opacity: 0.07 }} />
          <div style={{ position: "absolute", bottom: -40, right: -20, width: 200, height: 200, background: "#229ED9", borderRadius: "50%", opacity: 0.05 }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#229ED9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Send size={22} color="white" />
              </div>
              <div>
                <div style={{ color: "white", fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>قناة الوظائف على تيليجرام</div>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>@jobbotssa</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Mail size={16} color="#229ED9" />
                  <span style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 700 }}>وظائف يومياً</span>
                </div>
                <p style={{ color: "#64748b", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                  ننشر أفضل الوظائف المتاحة يومياً من مختلف المصادر مباشرة في القناة
                </p>
              </div>
              <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Gift size={16} color="#f59e0b" />
                  <span style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 700 }}>أكواد تفعيل مجانية</span>
                </div>
                <p style={{ color: "#64748b", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                  كل 3 أيام ننشر أكواد تفعيل حصرية للمشتركين في القناة — لا تفوّتها!
                </p>
              </div>
            </div>

            <a
              href="https://t.me/jobbotssa"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#229ED9",
                color: "white",
                padding: "12px 24px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 14,
                textDecoration: "none",
                width: "100%",
                justifyContent: "center",
                boxSizing: "border-box",
              }}
            >
              <Send size={16} />
              انضم لقناة الوظائف الآن
            </a>
          </div>
        </div>

      </div>

      <style suppressHydrationWarning>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @media (max-width: 640px) {
          [style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
