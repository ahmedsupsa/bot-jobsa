"use client";

import Link from "next/link";
import {
  Briefcase, Sparkles, Check, ShoppingCart, X, RefreshCw, Loader2, ShieldCheck,
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
  const baseMonthly = sortedProducts.find(p => p.duration_days === 30)?.price
    || (sortedProducts[0] ? sortedProducts[0].price / (sortedProducts[0].duration_days / 30) : 0);

  return (
    <div style={s.page} dir="rtl">
      {/* NAV */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}><Briefcase size={18} strokeWidth={2} color="#0a0a0a" /></div>
            <span style={s.logoText}>Jobbots</span>
          </Link>
          <Link href="/portal/login" style={s.navBtn}>دخول المشترك</Link>
        </div>
      </nav>

      <main style={s.main}>
        {refCode && (
          <div style={s.refBanner}>
            <Sparkles size={13} color="#a78bfa" />
            <span>تم تطبيق كود الإحالة <strong style={{ color: "#fff" }}>{refCode}</strong></span>
          </div>
        )}

        {loading ? (
          <div style={s.loaderWrap}>
            <Loader2 size={28} color="#666" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : products.length === 0 ? (
          <div style={s.empty}>
            <p style={{ color: "#666", fontSize: 15 }}>لا توجد منتجات متاحة حالياً</p>
          </div>
        ) : (
          <div style={{
            ...s.grid,
            gridTemplateColumns: `repeat(${Math.min(sortedProducts.length, 3)}, minmax(0, 1fr))`,
          }} className="__grid">
            {sortedProducts.map((p) => {
              const months = p.duration_days / 30;
              const equivalent = baseMonthly * months;
              const savings = baseMonthly && equivalent > p.price ? Math.round(((equivalent - p.price) / equivalent) * 100) : 0;

              return (
                <div key={p.id} style={s.card}>
                  <div style={s.cardGlow} />

                  <div style={s.cardHeader}>
                    <h3 style={s.cardName}>{p.name}</h3>
                    {savings > 0 && (
                      <span style={s.savingsBadge}>وفّر {savings}%</span>
                    )}
                  </div>

                  <div style={s.cardPrice}>
                    <span style={s.priceNum}>{p.price}</span>
                    <div style={s.priceMeta}>
                      <span style={s.priceCurr}>ر.س</span>
                      <span style={s.priceDur}>/ {durationLabel(p.duration_days)}</span>
                    </div>
                  </div>

                  {months > 1 && (
                    <div style={s.monthlyEquiv}>
                      ≈ {pricePerMonth(p)} ر.س / الشهر
                    </div>
                  )}

                  {p.description && (
                    <>
                      <div style={s.divider} />
                      <ul style={s.featureList}>
                        {p.description.split("\n").filter(Boolean).map((line, li) => (
                          <li key={li} style={s.featureItem}>
                            <div style={s.checkIcon}>
                              <Check size={11} strokeWidth={3} color="#a78bfa" />
                            </div>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  <button onClick={() => handleBuy(p)} style={s.buyBtn}>
                    <ShoppingCart size={15} />
                    اشترك الآن
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer style={s.footer}>
        <div style={s.footerInner}>
          <span style={{ color: "#666", fontSize: 12.5 }}>© 2025 Jobbots</span>
          <div style={{ display: "flex", gap: 22 }}>
            <Link href="/privacy" style={s.footerLink}>الخصوصية</Link>
            <Link href="/terms" style={s.footerLink}>الشروط</Link>
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
        @media (max-width: 760px) {
          .__grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", color: "#fff", fontFamily: "'Tajawal', system-ui, sans-serif" },

  // NAV
  nav: { borderBottom: "1px solid #1a1a1a", padding: "0 24px" },
  navInner: { maxWidth: 1100, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  logoIcon: { width: 34, height: 34, borderRadius: 9, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 17, fontWeight: 800 },
  navBtn: { background: "linear-gradient(135deg, #a78bfa, #6d28d9)", color: "#fff", padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px rgba(109,40,217,0.3)" },

  // MAIN
  main: { flex: 1, padding: "60px 24px", maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box" },
  refBanner: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 12, padding: "10px 18px", fontSize: 12.5, color: "#c4b5fd", marginBottom: 28, maxWidth: 480, marginLeft: "auto", marginRight: "auto" },
  loaderWrap: { textAlign: "center", padding: "120px 0" },
  empty: { textAlign: "center", padding: "120px 0" },

  // GRID
  grid: { display: "grid", gap: 18, alignItems: "stretch" },

  // CARD
  card: { background: "linear-gradient(180deg, #111 0%, #0a0a0a 100%)", border: "1px solid #1f1f1f", borderRadius: 20, padding: "28px 26px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", transition: "all 0.2s" },
  cardGlow: { position: "absolute", top: -100, right: -100, width: 220, height: 220, background: "radial-gradient(circle, rgba(167,139,250,0.08), transparent 70%)", pointerEvents: "none" },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14, position: "relative", zIndex: 1 },
  cardName: { color: "#e5e7eb", fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: "-0.2px" },
  savingsBadge: { background: "rgba(34,197,94,0.12)", color: "#86efac", border: "1px solid rgba(34,197,94,0.3)", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" },
  cardPrice: { display: "flex", alignItems: "flex-end", gap: 8, position: "relative", zIndex: 1 },
  priceNum: { fontSize: 50, fontWeight: 900, color: "#fff", lineHeight: 0.9, letterSpacing: "-2px" },
  priceMeta: { display: "flex", flexDirection: "column", gap: 2, paddingBottom: 4 },
  priceCurr: { fontSize: 13, color: "#888", fontWeight: 700 },
  priceDur: { fontSize: 11, color: "#666", fontWeight: 500 },
  monthlyEquiv: { fontSize: 12, color: "#888", marginTop: 8, fontWeight: 500, position: "relative", zIndex: 1 },
  divider: { height: 1, background: "#1f1f1f", margin: "20px 0", position: "relative", zIndex: 1 },
  featureList: { listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 11, flex: 1, position: "relative", zIndex: 1 },
  featureItem: { display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#bbb" },
  checkIcon: { width: 18, height: 18, borderRadius: 6, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  buyBtn: { width: "100%", padding: "13px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg, #a78bfa, #6d28d9)", color: "#fff", border: "none", boxShadow: "0 6px 20px rgba(109,40,217,0.35)", marginTop: "auto", position: "relative", zIndex: 1 },

  // FOOTER
  footer: { borderTop: "1px solid #1a1a1a", padding: "24px" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  footerLink: { color: "#666", fontSize: 12.5, textDecoration: "none" },

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
