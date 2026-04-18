"use client";

import Link from "next/link";
import { Briefcase, Sparkles, Check, ShoppingCart, X, RefreshCw, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_days: number;
  streampay_product_id?: string;
};

const COLORS = [
  { border: "#2a2a2a", accent: "#888", bg: "#111" },
  { border: "#444", accent: "#fff", bg: "#0f0f0f" },
  { border: "#6d28d922", accent: "#a78bfa", bg: "#0d0b14" },
];

function durationLabel(days: number): string {
  if (days === 30) return "شهر";
  if (days === 90) return "3 أشهر";
  if (days === 180) return "6 أشهر";
  if (days === 365) return "سنة";
  return `${days} يوم`;
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/store/products")
      .then(r => r.json())
      .then(j => { setProducts(j.products || []); setLoading(false); })
      .catch(() => setLoading(false));

    // Capture referral code from URL or localStorage
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

  const handleBuy = (p: Product) => {
    setSelected(p);
    setFormErr("");
  };

  const handleCheckout = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setFormErr("الاسم والبريد الإلكتروني مطلوبان");
      return;
    }
    if (!form.email.includes("@")) {
      setFormErr("بريد إلكتروني غير صحيح");
      return;
    }
    if (!selected) return;
    setSubmitting(true);
    setFormErr("");
    try {
      const r = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selected.id,
          name: form.name.trim(),
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
        <div style={s.header}>
          <div style={s.badge}>
            <Sparkles size={12} />
            <span>اشترك الآن</span>
          </div>
          <h1 style={s.title}>اختر خطتك</h1>
          <p style={s.sub}>
            تقديم تلقائي على الوظائف بالذكاء الاصطناعي — ادفع وابدأ فوراً.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <Loader2 size={32} color="#555" style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} />
            <p style={{ color: "#555", marginTop: 14, fontSize: 14 }}>جاري تحميل الخطط...</p>
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ color: "#555", fontSize: 16 }}>لا توجد خطط متاحة حالياً.</p>
            <a href="mailto:support@jobbots.org" style={{ ...s.contactBtn, marginTop: 20 }}>تواصل معنا</a>
          </div>
        ) : (
          <div style={{ ...s.plansGrid, gridTemplateColumns: `repeat(${Math.min(products.length, 3)}, 1fr)` }}>
            {products.map((p, i) => {
              const c = COLORS[i % COLORS.length];
              const featured = i === 1 || (products.length === 1);
              return (
                <div key={p.id} style={{
                  ...s.planCard,
                  border: featured ? "1px solid #444" : `1px solid ${c.border}`,
                  background: c.bg,
                  position: "relative",
                }}>
                  {featured && products.length > 1 && (
                    <div style={s.planBadge}>الأكثر طلباً</div>
                  )}
                  <div style={{ ...s.planName, color: c.accent }}>{p.name}</div>
                  <div style={s.planPrice}>
                    <span style={s.priceNum}>{p.price}</span>
                    <span style={s.priceCurr}> ر.س</span>
                  </div>
                  <div style={s.planPeriod}>لمدة {durationLabel(p.duration_days)}</div>

                  {p.description && (
                    <>
                      <div style={s.divider} />
                      <ul style={s.featureList}>
                        {p.description.split("\n").filter(Boolean).map((line, li) => (
                          <li key={li} style={s.featureItem}>
                            <Check size={13} strokeWidth={2.5} color={c.accent} />
                            <span style={{ color: "#aaa" }}>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  <button
                    onClick={() => handleBuy(p)}
                    style={{
                      ...s.buyBtn,
                      background: featured ? "#fff" : "transparent",
                      color: featured ? "#0a0a0a" : "#fff",
                      border: featured ? "none" : "1px solid #444",
                      marginTop: "auto",
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

        <div style={s.faqSection}>
          <h2 style={s.faqTitle}>أسئلة شائعة</h2>
          <div style={{ ...s.faqGrid, gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[
              { q: "كيف يعمل التقديم التلقائي؟", a: "كل 30 دقيقة يقوم النظام بالتقديم تلقائياً على الوظائف المتاحة باستخدام سيرتك الذاتية." },
              { q: "ماذا يحدث بعد الدفع؟", a: "يتم تفعيل حسابك فوراً — سجّل الدخول للبوابة وارفع سيرتك الذاتية وحدد تفضيلاتك." },
              { q: "ما طرق الدفع المتاحة؟", a: "ندعم جميع البطاقات البنكية ومدى وApple Pay عبر بوابة StreamPay الآمنة." },
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
          <p style={{ color: "#444", fontSize: 13, margin: 0 }}>© 2025 Jobbots. جميع الحقوق محفوظة.</p>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/privacy" style={{ color: "#555", fontSize: 13, textDecoration: "none" }}>سياسة الخصوصية</Link>
            <Link href="/terms" style={{ color: "#555", fontSize: 13, textDecoration: "none" }}>الشروط والأحكام</Link>
          </div>
        </div>
      </footer>

      {/* Checkout Modal */}
      {selected && (
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setFormErr(""); } }}>
          <div style={s.modal} dir="rtl">
            <div style={s.modalHeader}>
              <div>
                <div style={s.modalTitle}>إتمام الاشتراك</div>
                <div style={s.modalSub}>{selected.name} — {selected.price} ر.س / {durationLabel(selected.duration_days)}</div>
              </div>
              <button onClick={() => { setSelected(null); setFormErr(""); }} style={s.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={s.formFields}>
              <div>
                <label style={s.label}>الاسم الكامل *</label>
                <input
                  style={s.input}
                  placeholder="أحمد محمد"
                  value={form.name}
                  onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
                  disabled={submitting}
                />
              </div>
              <div>
                <label style={s.label}>البريد الإلكتروني *</label>
                <input
                  style={{ ...s.input, direction: "ltr", textAlign: "right" }}
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(s => ({ ...s, email: e.target.value }))}
                  disabled={submitting}
                />
              </div>
              <div>
                <label style={s.label}>رقم الجوال (اختياري)</label>
                <input
                  style={{ ...s.input, direction: "ltr", textAlign: "right" }}
                  type="tel"
                  placeholder="+966501234567"
                  value={form.phone}
                  onChange={e => setForm(s => ({ ...s, phone: e.target.value }))}
                  disabled={submitting}
                />
              </div>
            </div>

            {formErr && (
              <div style={s.errBox}>{formErr}</div>
            )}

            <button
              onClick={handleCheckout}
              disabled={submitting}
              style={{ ...s.checkoutBtn, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> : <ShoppingCart size={16} />}
              {submitting ? "جاري التحويل للدفع..." : `ادفع ${selected.price} ر.س`}
            </button>

            <p style={s.secureNote}>
              🔒 الدفع آمن عبر StreamPay — نقبل مدى، Visa، Mastercard وApple Pay
            </p>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
  badge: { display: "inline-flex", alignItems: "center", gap: 6, background: "#0a1a0a", border: "1px solid #16a34a33", borderRadius: 100, padding: "5px 14px", fontSize: 12, color: "#4ade80", marginBottom: 16 },
  title: { fontSize: 46, fontWeight: 900, color: "#fff", margin: "0 0 14px" },
  sub: { fontSize: 16, color: "#555", lineHeight: 1.8, margin: "0 0 28px" },
  contactBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "#0a0a0a", padding: "14px 28px", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none" },
  plansGrid: { maxWidth: 1000, margin: "0 auto 80px", display: "grid", gap: 20 },
  planCard: { borderRadius: 20, padding: "32px 28px", display: "flex", flexDirection: "column", gap: 0 },
  planBadge: { position: "absolute", top: -12, right: 24, background: "#fff", color: "#0a0a0a", borderRadius: 100, padding: "3px 12px", fontSize: 11, fontWeight: 700 },
  planName: { fontSize: 20, fontWeight: 800, marginBottom: 12 },
  planPrice: { display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 },
  priceNum: { fontSize: 48, fontWeight: 900, color: "#fff", lineHeight: 1 },
  priceCurr: { fontSize: 16, color: "#666", fontWeight: 600 },
  planPeriod: { fontSize: 13, color: "#555", marginBottom: 20 },
  divider: { height: 1, background: "#1f1f1f", margin: "16px 0" },
  featureList: { listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 12 },
  featureItem: { display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13 },
  buyBtn: { width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  faqSection: { maxWidth: 860, margin: "0 auto" },
  faqTitle: { color: "#fff", fontSize: 24, fontWeight: 800, textAlign: "center", margin: "0 0 28px" },
  faqGrid: { display: "grid", gap: 16 },
  faqCard: { background: "#111", border: "1px solid #1f1f1f", borderRadius: 14, padding: "22px" },
  faqQ: { color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 10px" },
  faqA: { color: "#666", fontSize: 13, lineHeight: 1.8, margin: 0 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 },
  modal: { background: "#111", border: "1px solid #2a2a2a", borderRadius: 20, padding: "28px", width: "100%", maxWidth: 440, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: 800, marginBottom: 4 },
  modalSub: { color: "#666", fontSize: 13 },
  closeBtn: { background: "transparent", border: "1px solid #2a2a2a", borderRadius: 8, padding: 6, cursor: "pointer", color: "#666", display: "flex", lineHeight: 1 },
  formFields: { display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 },
  label: { display: "block", color: "#777", fontSize: 12, marginBottom: 6 },
  input: { width: "100%", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" },
  errBox: { background: "#1a0000", border: "1px solid #7f1d1d", borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13, marginBottom: 14 },
  checkoutBtn: { width: "100%", background: "#fff", color: "#0a0a0a", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  secureNote: { textAlign: "center", color: "#555", fontSize: 12, margin: 0 },
};
