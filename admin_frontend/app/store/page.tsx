"use client";

import Link from "next/link";
import {
  Briefcase, Sparkles, Check, ShoppingCart, X, RefreshCw, Loader2,
  Zap, Brain, Mail, Clock, ShieldCheck, TrendingUp, Star, ArrowLeft,
  Rocket, Target, Award, ChevronDown, Users, FileText, BellRing,
} from "lucide-react";
import { useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_days: number;
  streampay_product_id?: string;
};

function durationLabel(days: number): string {
  if (days === 30) return "شهر";
  if (days === 90) return "3 أشهر";
  if (days === 180) return "6 أشهر";
  if (days === 365) return "سنة كاملة";
  return `${days} يوم`;
}

function pricePerMonth(p: Product): string {
  const months = p.duration_days / 30;
  return (p.price / months).toFixed(0);
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [refCode, setRefCode] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    fetch("/api/store/products")
      .then(r => r.json())
      .then(j => { setProducts(j.products || []); setLoading(false); })
      .catch(() => setLoading(false));

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        const clean = ref.trim().toUpperCase();
        localStorage.setItem("jobbots_ref", clean);
        setRefCode(clean);
      } else {
        const stored = localStorage.getItem("jobbots_ref");
        if (stored) setRefCode(stored);
      }
    }
  }, []);

  const handleBuy = (p: Product) => { setSelected(p); setFormErr(""); };

  const handleCheckout = async () => {
    if (!form.name.trim() || !form.email.trim()) { setFormErr("الاسم والبريد الإلكتروني مطلوبان"); return; }
    if (!form.email.includes("@")) { setFormErr("بريد إلكتروني غير صحيح"); return; }
    if (!selected) return;
    setSubmitting(true); setFormErr("");
    try {
      const r = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selected.id, name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          ref_code: refCode || undefined,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل إنشاء رابط الدفع");
      window.location.href = j.url;
    } catch (e) {
      setFormErr(String(e).replace("Error: ", ""));
      setSubmitting(false);
    }
  };

  const sortedProducts = [...products].sort((a, b) => a.duration_days - b.duration_days);
  const baseMonthly = sortedProducts.find(p => p.duration_days === 30)?.price || (sortedProducts[0] ? sortedProducts[0].price / (sortedProducts[0].duration_days / 30) : 0);

  const faqs = [
    { q: "كيف يشتغل التقديم التلقائي؟", a: "بمجرد ما تكمل بياناتك وترفع سيرتك الذاتية، النظام يفحص الوظائف الجديدة كل 30 دقيقة ويقدّم باسمك تلقائياً على اللي تطابق تخصصك ومواصفاتك — تلقائي 100% بدون أي تدخل منك." },
    { q: "ماذا يحدث بعد الدفع مباشرة؟", a: "يتفعّل اشتراكك في ثوانٍ. تستلم بريد فيه كود التفعيل، تسجّل دخول البوابة، ترفع سيرتك وتحدد تفضيلاتك (المدينة، التخصص، الراتب) — وخلاص النظام يبدأ يشتغل لك." },
    { q: "هل تقدّم على وظائف وهمية؟", a: "أبداً. كل الوظائف يتم نشرها يدوياً بعد التحقق منها من قبل فريقنا. ما نقبل إلا الوظائف الحقيقية من شركات معروفة." },
    { q: "ما طرق الدفع المتاحة؟", a: "ندعم مدى، فيزا، ماستركارد، Apple Pay وSTC Pay عبر بوابة StreamPay الآمنة المعتمدة من البنك المركزي السعودي." },
    { q: "هل يقدّم باسمي وبإيميلي؟", a: "نعم! ننشئ لك إيميل احترافي خاص (مثلاً ahmed@jobs.jobbots.org) ونرسل منه باسمك مع سيرتك الذاتية، فالشركات تشوفك أنت — مو روبوت." },
    { q: "هل أقدر ألغي اشتراكي؟", a: "نعم، تقدر تلغي وتحذف حسابك من إعدادات حسابك في أي وقت. الاشتراك ينتهي في تاريخ التجديد ولا يتم تجديده تلقائياً." },
  ];

  const features = [
    { icon: Brain, title: "ذكاء اصطناعي متقدّم", desc: "يحلل كل وظيفة ويصيغ رسالة تقديم مخصصة لها بالاعتماد على سيرتك الذاتية" },
    { icon: Clock, title: "يشتغل 24/7", desc: "كل 30 دقيقة يتحقق من الوظائف الجديدة ويقدّم نيابة عنك حتى وأنت نايم" },
    { icon: Mail, title: "إيميل احترافي خاص", desc: "ننشئ لك عنوان إيميل خاص باسمك ترسل منه الطلبات — تظهر احترافي للشركات" },
    { icon: ShieldCheck, title: "وظائف موثّقة", desc: "كل وظيفة يتم فحصها يدوياً قبل النشر — لا وهمي ولا احتيال" },
  ];

  const steps = [
    { n: "1", icon: Rocket, title: "اختر خطتك وادفع", desc: "خطط بأسعار تبدأ من 99 ريال شهرياً" },
    { n: "2", icon: FileText, title: "ارفع سيرتك وحدد تفضيلاتك", desc: "المدينة، التخصص، الراتب، نوع الدوام" },
    { n: "3", icon: BellRing, title: "اجلس واستنى المقابلات", desc: "النظام يقدم لك تلقائياً وتوصلك ردود الشركات على بريدك" },
  ];

  return (
    <div style={s.page} dir="rtl">
      {/* NAV */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}><Briefcase size={18} strokeWidth={2} color="#0a0a0a" /></div>
            <span style={s.logoText}>Jobbots</span>
          </Link>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="#pricing" style={s.navLink}>الأسعار</a>
            <a href="#how" style={s.navLink}>كيف يعمل</a>
            <a href="#faq" style={s.navLink}>الأسئلة</a>
            <Link href="/portal/login" style={s.navBtn}>دخول المشترك</Link>
          </div>
        </div>
      </nav>

      <main style={{ flex: 1 }}>
        {/* HERO */}
        <section style={s.hero}>
          <div style={s.heroGlow} />
          <div style={s.heroGlow2} />
          <div style={s.heroContent}>
            {refCode && (
              <div style={s.refBanner}>
                <Sparkles size={13} color="#a78bfa" />
                <span>تم تطبيق كود الإحالة <strong style={{ color: "#fff" }}>{refCode}</strong></span>
              </div>
            )}
            <div style={s.heroBadge}>
              <span style={s.dot} />
              <span>أكثر من 500 مشترك سعودي يستخدمون النظام</span>
            </div>
            <h1 style={s.heroTitle}>
              نظام يقدّم لك على الوظائف
              <br />
              <span style={s.heroTitleAccent}>وأنت نايم.</span>
            </h1>
            <p style={s.heroSub}>
              ارفع سيرتك مرة وحدة، النظام يقدّم باسمك على كل وظيفة جديدة في السعودية كل 30 دقيقة — تلقائي 100% بالذكاء الاصطناعي.
            </p>
            <div style={s.heroCtas}>
              <a href="#pricing" style={s.heroCtaPrimary}>
                <Rocket size={16} /> ابدأ الآن
              </a>
              <a href="#how" style={s.heroCtaSecondary}>
                شاهد كيف يعمل <ArrowLeft size={14} />
              </a>
            </div>
            <div style={s.heroStats}>
              {[
                { num: "10,000+", lbl: "تقديم تم بنجاح" },
                { num: "500+", lbl: "مشترك نشط" },
                { num: "30 د", lbl: "دورة تقديم تلقائي" },
                { num: "24/7", lbl: "بدون توقف" },
              ].map((st, i) => (
                <div key={i} style={s.heroStat}>
                  <div style={s.heroStatNum}>{st.num}</div>
                  <div style={s.heroStatLbl}>{st.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section style={s.featSection}>
          <div style={s.sectionHeader}>
            <div style={s.sectionTag}>المميزات</div>
            <h2 style={s.sectionTitle}>ليش جوبوتس؟</h2>
            <p style={s.sectionSub}>لأن البحث عن وظيفة مرهق — وأنت تستحق نظام يشتغل عنك</p>
          </div>
          <div style={s.featGrid}>
            {features.map((f, i) => (
              <div key={i} style={s.featCard}>
                <div style={s.featIcon}>
                  <f.icon size={20} strokeWidth={1.8} color="#a78bfa" />
                </div>
                <h3 style={s.featTitle}>{f.title}</h3>
                <p style={s.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" style={s.howSection}>
          <div style={s.sectionHeader}>
            <div style={s.sectionTag}>3 خطوات بس</div>
            <h2 style={s.sectionTitle}>ابدأ خلال دقيقتين</h2>
            <p style={s.sectionSub}>من التسجيل إلى أول مقابلة — كله بدون أي خبرة تقنية</p>
          </div>
          <div style={s.stepsGrid}>
            {steps.map((st, i) => (
              <div key={i} style={s.stepCard}>
                <div style={s.stepNum}>{st.n}</div>
                <div style={s.stepIconWrap}>
                  <st.icon size={24} strokeWidth={1.7} color="#a78bfa" />
                </div>
                <h3 style={s.stepTitle}>{st.title}</h3>
                <p style={s.stepDesc}>{st.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" style={s.priceSection}>
          <div style={s.sectionHeader}>
            <div style={s.sectionTag}>الأسعار</div>
            <h2 style={s.sectionTitle}>اختر الخطة المناسبة لك</h2>
            <p style={s.sectionSub}>كلما كانت مدتك أطول، كلما توفر أكثر — بدون أي رسوم خفية</p>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <Loader2 size={32} color="#666" style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} />
              <p style={{ color: "#666", marginTop: 14, fontSize: 14 }}>جاري تحميل الخطط...</p>
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <p style={{ color: "#666", fontSize: 16 }}>لا توجد خطط متاحة حالياً.</p>
              <a href="mailto:support@jobbots.org" style={{ ...s.heroCtaPrimary, marginTop: 20, display: "inline-flex" }}>تواصل معنا</a>
            </div>
          ) : (
            <div style={{
              ...s.plansGrid,
              gridTemplateColumns: `repeat(${Math.min(sortedProducts.length, 3)}, minmax(0, 1fr))`,
            }}>
              {sortedProducts.map((p, i) => {
                const isFeatured = sortedProducts.length === 1 ? true : (i === Math.floor(sortedProducts.length / 2));
                const months = p.duration_days / 30;
                const equivalent = baseMonthly * months;
                const savings = baseMonthly && equivalent > p.price ? Math.round(((equivalent - p.price) / equivalent) * 100) : 0;

                return (
                  <div key={p.id} style={{
                    ...s.planCard,
                    background: isFeatured ? "linear-gradient(180deg, #1a0d2e 0%, #0d0a1a 100%)" : "#0d0d0d",
                    border: isFeatured ? "1px solid #a78bfa" : "1px solid #1f1f1f",
                    boxShadow: isFeatured ? "0 0 60px rgba(167,139,250,0.15), 0 0 0 1px rgba(167,139,250,0.3)" : "none",
                    transform: isFeatured ? "scale(1.02)" : "scale(1)",
                  }}>
                    {isFeatured && (
                      <div style={s.popularBadge}>
                        <Star size={11} fill="#0a0a0a" color="#0a0a0a" />
                        الأكثر طلباً
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{
                        ...s.planName,
                        color: isFeatured ? "#c4b5fd" : "#888",
                      }}>{p.name}</span>
                      {savings > 0 && (
                        <span style={s.savingsBadge}>وفر {savings}%</span>
                      )}
                    </div>

                    <div style={s.planPrice}>
                      <span style={s.priceNum}>{p.price}</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={s.priceCurr}>ر.س</span>
                        <span style={s.priceForPeriod}>/ {durationLabel(p.duration_days)}</span>
                      </div>
                    </div>

                    {months > 1 && (
                      <div style={s.monthlyEquiv}>
                        ≈ {pricePerMonth(p)} ر.س / الشهر
                      </div>
                    )}

                    <div style={s.divider} />

                    <ul style={s.featureList}>
                      {(p.description ? p.description.split("\n").filter(Boolean) : [
                        "تقديم تلقائي على كل الوظائف",
                        "إيميل احترافي خاص باسمك",
                        "تحديث تلقائي كل 30 دقيقة",
                        "دعم فني على مدار الساعة",
                      ]).map((line, li) => (
                        <li key={li} style={s.featureItem}>
                          <div style={{ ...s.checkIcon, background: isFeatured ? "#a78bfa22" : "#1a1a1a" }}>
                            <Check size={11} strokeWidth={3} color={isFeatured ? "#c4b5fd" : "#888"} />
                          </div>
                          <span style={{ color: "#bbb" }}>{line}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleBuy(p)}
                      style={{
                        ...s.buyBtn,
                        background: isFeatured ? "linear-gradient(135deg, #a78bfa, #6d28d9)" : "#1a1a1a",
                        color: "#fff",
                        border: isFeatured ? "none" : "1px solid #2a2a2a",
                        boxShadow: isFeatured ? "0 8px 24px rgba(109,40,217,0.4)" : "none",
                      }}
                    >
                      <ShoppingCart size={15} />
                      اشترك الآن
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Trust line under pricing */}
          <div style={s.trustRow}>
            <div style={s.trustItem}><ShieldCheck size={15} color="#22c55e" /> دفع آمن SSL</div>
            <div style={s.trustItem}><Award size={15} color="#3b82f6" /> StreamPay معتمد</div>
            <div style={s.trustItem}><Zap size={15} color="#f59e0b" /> تفعيل فوري</div>
            <div style={s.trustItem}><Users size={15} color="#a78bfa" /> دعم 24/7</div>
          </div>
        </section>

        {/* TESTIMONIAL/SOCIAL PROOF */}
        <section style={s.testSection}>
          <div style={s.testCard}>
            <div style={s.testStars}>
              {[1, 2, 3, 4, 5].map(i => <Star key={i} size={18} fill="#fbbf24" color="#fbbf24" />)}
            </div>
            <p style={s.testQuote}>
              "كنت أقدّم على وظيفة وحدة باليوم بصعوبة، الحين النظام يقدّم لي على 50+ وظيفة يومياً وأنا نايم. وصلتني 3 مقابلات في أول أسبوع!"
            </p>
            <div style={s.testAuthor}>
              <div style={s.testAvatar}>أم</div>
              <div>
                <div style={s.testName}>أحمد م.</div>
                <div style={s.testRole}>مهندس برمجيات • الرياض</div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" style={s.faqSection}>
          <div style={s.sectionHeader}>
            <div style={s.sectionTag}>الأسئلة الشائعة</div>
            <h2 style={s.sectionTitle}>كل اللي تحتاج تعرفه</h2>
          </div>
          <div style={s.faqList}>
            {faqs.map((item, i) => (
              <div key={i} style={{
                ...s.faqCard,
                borderColor: openFaq === i ? "#a78bfa44" : "#1f1f1f",
                background: openFaq === i ? "#0f0a1a" : "#0d0d0d",
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={s.faqQBtn}
                >
                  <span style={{ flex: 1, textAlign: "right" }}>{item.q}</span>
                  <ChevronDown size={18} color={openFaq === i ? "#a78bfa" : "#666"} style={{
                    transition: "transform 0.2s",
                    transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)",
                  }} />
                </button>
                {openFaq === i && (
                  <div style={s.faqAWrap}>
                    <p style={s.faqA}>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section style={s.finalCta}>
          <div style={s.finalCtaInner}>
            <Sparkles size={32} color="#a78bfa" />
            <h2 style={s.finalCtaTitle}>جاهز تشتغل بدون عناء البحث؟</h2>
            <p style={s.finalCtaSub}>انضم لـ 500+ مشترك بدأوا رحلتهم الوظيفية مع جوبوتس</p>
            <a href="#pricing" style={s.heroCtaPrimary}>
              <Rocket size={16} /> ابدأ الآن
            </a>
          </div>
        </section>
      </main>

      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={s.logoIconSmall}><Briefcase size={14} color="#0a0a0a" /></div>
            <span style={{ color: "#888", fontSize: 13 }}>© 2025 Jobbots. جميع الحقوق محفوظة.</span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <Link href="/privacy" style={s.footerLink}>سياسة الخصوصية</Link>
            <Link href="/terms" style={s.footerLink}>الشروط والأحكام</Link>
            <a href="mailto:support@jobbots.org" style={s.footerLink}>تواصل معنا</a>
          </div>
        </div>
      </footer>

      {/* Checkout Modal */}
      {selected && (
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setFormErr(""); } }}>
          <div style={s.modal} dir="rtl">
            <div style={s.modalGlow} />
            <div style={s.modalHeader}>
              <div>
                <div style={s.modalTitle}>إتمام الاشتراك</div>
                <div style={s.modalSub}>{selected.name} • {selected.price} ر.س</div>
              </div>
              <button onClick={() => { setSelected(null); setFormErr(""); }} style={s.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={s.summaryBox}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#888", fontSize: 13 }}>المدة</span>
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{durationLabel(selected.duration_days)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888", fontSize: 13 }}>المبلغ الإجمالي</span>
                <span style={{ color: "#a78bfa", fontSize: 16, fontWeight: 800 }}>{selected.price} ر.س</span>
              </div>
            </div>

            <div style={s.formFields}>
              <div>
                <label style={s.label}>الاسم الكامل *</label>
                <input style={s.input} placeholder="أحمد محمد"
                  value={form.name}
                  onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
                  disabled={submitting}
                />
              </div>
              <div>
                <label style={s.label}>البريد الإلكتروني *</label>
                <input style={{ ...s.input, direction: "ltr", textAlign: "right" }}
                  type="email" placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(s => ({ ...s, email: e.target.value }))}
                  disabled={submitting}
                />
              </div>
              <div>
                <label style={s.label}>رقم الجوال (اختياري)</label>
                <input style={{ ...s.input, direction: "ltr", textAlign: "right" }}
                  type="tel" placeholder="+966501234567"
                  value={form.phone}
                  onChange={e => setForm(s => ({ ...s, phone: e.target.value }))}
                  disabled={submitting}
                />
              </div>
            </div>

            {formErr && <div style={s.errBox}>{formErr}</div>}

            <button onClick={handleCheckout} disabled={submitting} style={{ ...s.checkoutBtn, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> : <ShieldCheck size={16} />}
              {submitting ? "جاري التحويل للدفع..." : `ادفع ${selected.price} ر.س بأمان`}
            </button>

            <p style={s.secureNote}>
              🔒 الدفع آمن عبر StreamPay — مدى • Visa • Mastercard • Apple Pay
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        @media (max-width: 768px) {
          .__plans { grid-template-columns: 1fr !important; }
          .__steps { grid-template-columns: 1fr !important; }
          .__feat { grid-template-columns: 1fr 1fr !important; }
          .__navlinks { display: none !important; }
        }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", color: "#fff", fontFamily: "'Tajawal', system-ui, sans-serif" },

  // NAV
  nav: { borderBottom: "1px solid #1a1a1a", padding: "0 24px", position: "sticky", top: 0, background: "rgba(10,10,10,0.85)", backdropFilter: "blur(12px)", zIndex: 50 },
  navInner: { maxWidth: 1200, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  logoIcon: { width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #fff, #e5e7eb)", display: "flex", alignItems: "center", justifyContent: "center" },
  logoIconSmall: { width: 26, height: 26, borderRadius: 7, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 17, fontWeight: 800 },
  navLink: { color: "#888", fontSize: 13, padding: "8px 14px", textDecoration: "none", fontWeight: 500 },
  navBtn: { background: "linear-gradient(135deg, #a78bfa, #6d28d9)", color: "#fff", padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px rgba(109,40,217,0.3)" },

  // HERO
  hero: { position: "relative", padding: "100px 24px 80px", overflow: "hidden" },
  heroGlow: { position: "absolute", top: -200, right: -100, width: 500, height: 500, background: "radial-gradient(circle, rgba(167,139,250,0.25), transparent 70%)", filter: "blur(60px)", pointerEvents: "none" },
  heroGlow2: { position: "absolute", bottom: -200, left: -100, width: 500, height: 500, background: "radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)", filter: "blur(60px)", pointerEvents: "none" },
  heroContent: { maxWidth: 920, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 },
  refBanner: { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 100, padding: "6px 14px", fontSize: 12, color: "#c4b5fd", marginBottom: 14 },
  heroBadge: { display: "inline-flex", alignItems: "center", gap: 8, background: "#0d1f0d", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 100, padding: "7px 16px", fontSize: 12.5, color: "#86efac", marginBottom: 24 },
  dot: { width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s ease-in-out infinite", boxShadow: "0 0 12px #22c55e" },
  heroTitle: { fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900, color: "#fff", margin: "0 0 22px", lineHeight: 1.1, letterSpacing: "-1px" },
  heroTitleAccent: { background: "linear-gradient(135deg, #c4b5fd, #a78bfa, #6d28d9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" },
  heroSub: { fontSize: 17, color: "#888", lineHeight: 1.8, margin: "0 auto 36px", maxWidth: 620 },
  heroCtas: { display: "flex", gap: 12, justifyContent: "center", marginBottom: 56, flexWrap: "wrap" },
  heroCtaPrimary: { display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #a78bfa, #6d28d9)", color: "#fff", padding: "14px 28px", borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: "none", boxShadow: "0 12px 32px rgba(109,40,217,0.4)", transition: "transform 0.2s" },
  heroCtaSecondary: { display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", color: "#fff", padding: "14px 24px", borderRadius: 12, fontSize: 15, fontWeight: 600, textDecoration: "none", border: "1px solid #2a2a2a" },
  heroStats: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, maxWidth: 700, margin: "0 auto", padding: "28px 32px", background: "rgba(255,255,255,0.02)", border: "1px solid #1a1a1a", borderRadius: 18 },
  heroStat: { textAlign: "center" },
  heroStatNum: { fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 6, background: "linear-gradient(135deg, #fff, #999)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  heroStatLbl: { fontSize: 11.5, color: "#666" },

  // SECTIONS
  sectionHeader: { textAlign: "center", maxWidth: 600, margin: "0 auto 48px" },
  sectionTag: { display: "inline-block", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", color: "#c4b5fd", padding: "5px 14px", borderRadius: 100, fontSize: 11.5, fontWeight: 700, marginBottom: 14, letterSpacing: "0.5px" },
  sectionTitle: { fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: "#fff", margin: "0 0 12px", letterSpacing: "-0.5px" },
  sectionSub: { fontSize: 15, color: "#888", lineHeight: 1.7, margin: 0 },

  // FEATURES
  featSection: { padding: "80px 24px", maxWidth: 1200, margin: "0 auto" },
  featGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 },
  featCard: { background: "linear-gradient(180deg, #111 0%, #0a0a0a 100%)", border: "1px solid #1f1f1f", borderRadius: 16, padding: "26px 22px", transition: "transform 0.2s" },
  featIcon: { width: 44, height: 44, borderRadius: 12, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  featTitle: { color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 8px" },
  featDesc: { color: "#777", fontSize: 13, lineHeight: 1.7, margin: 0 },

  // STEPS
  howSection: { padding: "80px 24px", maxWidth: 1100, margin: "0 auto" },
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 },
  stepCard: { background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 18, padding: "32px 28px", position: "relative", overflow: "hidden" },
  stepNum: { position: "absolute", top: 18, left: 24, fontSize: 60, fontWeight: 900, color: "#1a1a1a", lineHeight: 1 },
  stepIconWrap: { width: 56, height: 56, borderRadius: 14, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, position: "relative", zIndex: 1 },
  stepTitle: { color: "#fff", fontSize: 17, fontWeight: 700, margin: "0 0 8px" },
  stepDesc: { color: "#888", fontSize: 13.5, lineHeight: 1.7, margin: 0 },

  // PRICING
  priceSection: { padding: "80px 24px 60px", maxWidth: 1100, margin: "0 auto" },
  plansGrid: { display: "grid", gap: 18, alignItems: "stretch" },
  planCard: { borderRadius: 22, padding: "32px 28px", display: "flex", flexDirection: "column", position: "relative", transition: "all 0.2s" },
  popularBadge: { position: "absolute", top: -12, right: 20, background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#0a0a0a", borderRadius: 100, padding: "5px 12px", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", gap: 4, boxShadow: "0 4px 14px rgba(251,191,36,0.4)" },
  planName: { fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" },
  savingsBadge: { background: "rgba(34,197,94,0.15)", color: "#86efac", border: "1px solid rgba(34,197,94,0.3)", padding: "2px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 700 },
  planPrice: { display: "flex", alignItems: "flex-end", gap: 6, marginTop: 14 },
  priceNum: { fontSize: 56, fontWeight: 900, color: "#fff", lineHeight: 0.9, letterSpacing: "-2px" },
  priceCurr: { fontSize: 13, color: "#888", fontWeight: 700 },
  priceForPeriod: { fontSize: 11, color: "#666", fontWeight: 500 },
  monthlyEquiv: { fontSize: 12, color: "#888", marginTop: 8, fontWeight: 500 },
  divider: { height: 1, background: "#1f1f1f", margin: "20px 0" },
  featureList: { listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 11, flex: 1 },
  featureItem: { display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 },
  checkIcon: { width: 18, height: 18, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  buyBtn: { width: "100%", padding: "14px", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "transform 0.15s" },
  trustRow: { display: "flex", justifyContent: "center", gap: 28, flexWrap: "wrap", marginTop: 32, paddingTop: 32, borderTop: "1px solid #1a1a1a" },
  trustItem: { display: "flex", alignItems: "center", gap: 6, color: "#aaa", fontSize: 12.5, fontWeight: 500 },

  // TESTIMONIAL
  testSection: { padding: "60px 24px", maxWidth: 800, margin: "0 auto" },
  testCard: { background: "linear-gradient(135deg, #1a0d2e 0%, #0d0a1a 100%)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 24, padding: "36px 32px", textAlign: "center" },
  testStars: { display: "flex", justifyContent: "center", gap: 4, marginBottom: 18 },
  testQuote: { fontSize: 18, color: "#e5e7eb", lineHeight: 1.8, fontWeight: 500, margin: "0 0 24px", fontStyle: "italic" },
  testAuthor: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12 },
  testAvatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #a78bfa, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 },
  testName: { color: "#fff", fontSize: 14, fontWeight: 700, textAlign: "right" },
  testRole: { color: "#888", fontSize: 12, textAlign: "right" },

  // FAQ
  faqSection: { padding: "80px 24px", maxWidth: 760, margin: "0 auto" },
  faqList: { display: "flex", flexDirection: "column", gap: 10 },
  faqCard: { borderRadius: 14, border: "1px solid #1f1f1f", overflow: "hidden", transition: "all 0.2s" },
  faqQBtn: { width: "100%", display: "flex", alignItems: "center", gap: 12, background: "transparent", border: "none", padding: "18px 22px", color: "#fff", fontSize: 14.5, fontWeight: 600, cursor: "pointer", textAlign: "right" as any },
  faqAWrap: { padding: "0 22px 18px" },
  faqA: { color: "#999", fontSize: 13.5, lineHeight: 1.85, margin: 0 },

  // FINAL CTA
  finalCta: { padding: "80px 24px", maxWidth: 800, margin: "0 auto" },
  finalCtaInner: { textAlign: "center", background: "linear-gradient(135deg, #1a0d2e 0%, #0d0a1a 100%)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 28, padding: "50px 32px" },
  finalCtaTitle: { fontSize: 28, fontWeight: 900, color: "#fff", margin: "16px 0 10px" },
  finalCtaSub: { fontSize: 15, color: "#aaa", lineHeight: 1.7, margin: "0 0 28px" },

  // FOOTER
  footer: { borderTop: "1px solid #1a1a1a", padding: "32px 24px", marginTop: "auto" },
  footerInner: { maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 },
  footerLink: { color: "#666", fontSize: 13, textDecoration: "none" },

  // MODAL
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 },
  modal: { background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 22, padding: "28px", width: "100%", maxWidth: 460, boxShadow: "0 24px 80px rgba(0,0,0,0.8)", position: "relative", overflow: "hidden" },
  modalGlow: { position: "absolute", top: -50, right: -50, width: 200, height: 200, background: "radial-gradient(circle, rgba(167,139,250,0.15), transparent 70%)", pointerEvents: "none" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, position: "relative" },
  modalTitle: { color: "#fff", fontSize: 19, fontWeight: 800, marginBottom: 4 },
  modalSub: { color: "#888", fontSize: 13 },
  closeBtn: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 7, cursor: "pointer", color: "#888", display: "flex", lineHeight: 1 },
  summaryBox: { background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 12, padding: "14px 16px", marginBottom: 20 },
  formFields: { display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 },
  label: { display: "block", color: "#888", fontSize: 12, marginBottom: 6, fontWeight: 500 },
  input: { width: "100%", background: "#070707", border: "1px solid #2a2a2a", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" },
  errBox: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 14 },
  checkoutBtn: { width: "100%", background: "linear-gradient(135deg, #a78bfa, #6d28d9)", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12, boxShadow: "0 8px 24px rgba(109,40,217,0.4)" },
  secureNote: { textAlign: "center", color: "#666", fontSize: 11.5, margin: 0 },
};
