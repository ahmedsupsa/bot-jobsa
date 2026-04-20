"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Sparkles, Check, ShoppingCart, X, RefreshCw, Loader2, ShieldCheck,
  Copy, CheckCheck, Building2, Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_days: number;
};

type BankAccount = {
  id: string;
  type: "bank" | "wallet";
  name: string;
  account_number?: string | null;
  iban?: string | null;
  phone?: string | null;
};

function BankField({ label, value, id, copiedId, onCopy }: {
  label: string; value: string; id: string;
  copiedId: string | null; onCopy: (v: string, id: string) => void;
}) {
  const copied = copiedId === id;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d0d0d", border: "1px solid #222", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ color: "#666", fontSize: 11 }}>{label}</span>
        <span style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 600, letterSpacing: "0.2px", direction: "ltr" }}>{value}</span>
      </div>
      <button
        onClick={() => onCopy(value, id)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: copied ? "#a78bfa" : "#555", transition: "color 0.2s" }}
        title="نسخ"
      >
        {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

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
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [formErr, setFormErr] = useState("");
  const [refCode, setRefCode] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "bank_details">("form");
  const [bankData, setBankData] = useState<{
    accounts: BankAccount[];
    amount: number;
    original_amount: number;
    has_discount: boolean;
    order_id: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  useEffect(() => {
    fetch(`/api/store/products?t=${Date.now()}`, { cache: "no-store" })
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

  const handleBuy = (p: Product) => { setSelected(p); setFormErr(""); setStep("form"); setBankData(null); };

  const closeModal = () => {
    setSelected(null); setFormErr(""); setStep("form"); setBankData(null);
    setReceiptFile(null); setUploadDone(false); setUploadErr("");
  };

  const handleReceiptUpload = async () => {
    if (!receiptFile || !bankData?.order_id) return;
    setUploading(true); setUploadErr("");
    try {
      const fd = new FormData();
      fd.append("file", receiptFile);
      fd.append("order_id", bankData.order_id);
      const r = await fetch("/api/store/upload-receipt", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الرفع");
      setUploadDone(true);
      setReceiptFile(null);
    } catch (e) {
      setUploadErr(String(e).replace("Error: ", ""));
    }
    setUploading(false);
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleCheckout = async (gateway: "tamara" | "streampay" | "bank_transfer") => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) { setFormErr("جميع الحقول مطلوبة"); return; }
    if (!form.email.includes("@")) { setFormErr("بريد إلكتروني غير صحيح"); return; }
    if (form.phone.trim().length < 9) { setFormErr("رقم الجوال غير صحيح"); return; }
    if (!selected) return;
    setSubmitting(gateway); setFormErr("");
    try {
      const r = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selected.id, name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          ref_code: refCode || undefined,
          gateway,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل إنشاء رابط الدفع");

      if (gateway === "bank_transfer") {
        setBankData({
          accounts: j.accounts || [],
          amount: j.amount,
          original_amount: j.original_amount,
          has_discount: j.has_discount,
          order_id: j.order_id,
        });
        setStep("bank_details");
        setSubmitting(null);
        return;
      }

      window.location.href = j.url;
    } catch (e) {
      setFormErr(String(e).replace("Error: ", ""));
      setSubmitting(null);
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
            <Image src="/logo.png" alt="Jobbots" width={34} height={34} style={{ borderRadius: 9 }} />
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
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={s.modal} dir="rtl" className="__modal">
            <div style={s.modalGlow} />

            {/* Header */}
            <div style={s.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={s.modalIconWrap}>
                  <ShoppingCart size={15} color="#a78bfa" />
                </div>
                <div>
                  <div style={s.modalTitle}>إتمام الاشتراك</div>
                  <div style={s.modalSub}>{selected.name}</div>
                </div>
              </div>
              <button onClick={closeModal} style={s.closeBtn}>
                <X size={16} />
              </button>
            </div>

            {/* Price strip */}
            <div style={s.priceStrip}>
              <span style={s.stripLabel}>المبلغ الإجمالي</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={s.stripAmount}>{selected.price}</span>
                <span style={s.stripCurr}>ر.س</span>
                <span style={s.stripDur}>/ {durationLabel(selected.duration_days)}</span>
              </div>
            </div>

            {/* Form — two columns on desktop */}
            <div style={s.formGrid} className="__formgrid">
              <div style={s.formCol}>
                <label style={s.label}>الاسم الكامل *</label>
                <input style={s.input} placeholder="أحمد محمد"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!!submitting}
                />
              </div>
              <div style={s.formCol}>
                <label style={s.label}>رقم الجوال *</label>
                <input style={{ ...s.input, direction: "ltr", textAlign: "right" }}
                  type="tel" placeholder="+966501234567"
                  value={form.phone}
                  onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!!submitting}
                />
              </div>
              <div style={{ ...s.formCol, gridColumn: "1 / -1" }}>
                <label style={s.label}>البريد الإلكتروني *</label>
                <input style={{ ...s.input, direction: "ltr", textAlign: "right" }}
                  type="email" placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!!submitting}
                />
              </div>
            </div>

            {formErr && <div style={s.errBox}>{formErr}</div>}

            {/* Payment gateway label */}
            <div style={s.gatewayLabel}>
              <span style={s.gatewayLine} />
              <span style={s.gatewayText}>اختر بوابة الدفع</span>
              <span style={s.gatewayLine} />
            </div>

            {step === "form" && (
              <>
                {/* Payment buttons — grid */}
                <div style={s.payBtns} className="__paybtns">
                  <button
                    onClick={() => handleCheckout("tamara")}
                    disabled={!!submitting}
                    style={{ ...s.payBtn, ...s.payBtnTamara, opacity: submitting ? 0.65 : 1 }}
                  >
                    {submitting === "tamara"
                      ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                      : <ShieldCheck size={14} />}
                    <span>{submitting === "tamara" ? "جاري..." : "Tamara"}</span>
                  </button>

                  <button
                    onClick={() => handleCheckout("streampay")}
                    disabled={!!submitting}
                    style={{ ...s.payBtn, ...s.payBtnStream, opacity: submitting ? 0.65 : 1 }}
                  >
                    {submitting === "streampay"
                      ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                      : <ShieldCheck size={14} />}
                    <span>{submitting === "streampay" ? "جاري..." : "StreamPay"}</span>
                  </button>

                  <button
                    onClick={() => handleCheckout("bank_transfer")}
                    disabled={!!submitting}
                    style={{ ...s.payBtn, ...s.payBtnBank, gridColumn: "1 / -1", opacity: submitting ? 0.65 : 1, position: "relative" }}
                  >
                    {submitting === "bank_transfer"
                      ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                      : <Building2 size={14} />}
                    <span>{submitting === "bank_transfer" ? "جاري..." : "تحويل بنكي"}</span>
                    {selected && Number(selected.price) > 40 && (
                      <span style={s.discountBadge}>خصم 15%</span>
                    )}
                  </button>
                </div>
                <p style={s.secureNote}>🔒 مدى • Visa • Mastercard • Apple Pay</p>
              </>
            )}

            {step === "bank_details" && bankData && (
              <div style={{ marginTop: 4 }}>
                {/* Amount summary */}
                <div style={s.bankAmountBox}>
                  {bankData.has_discount && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#aaa" }}>السعر الأصلي</span>
                      <span style={{ color: "#888", textDecoration: "line-through" }}>{bankData.original_amount} ر.س</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#aaa", fontSize: 13 }}>
                      {bankData.has_discount ? "بعد الخصم 15%" : "المبلغ المطلوب"}
                    </span>
                    <span style={{ color: "#fff", fontSize: 22, fontWeight: 900 }}>{bankData.amount} ر.س</span>
                  </div>
                  <p style={{ color: "#aaa", fontSize: 12, margin: "8px 0 0", lineHeight: 1.7 }}>
                    بعد إتمام التحويل، أرسل إيصال الدفع إلى الدعم وسيتم تفعيل حسابك خلال 24 ساعة.
                  </p>
                </div>

                {/* Bank accounts list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                  {bankData.accounts.map(acc => (
                    <div key={acc.id} style={s.bankCard}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={s.bankIcon}>
                          {acc.type === "bank" ? <Building2 size={14} color="#a78bfa" /> : <Wallet size={14} color="#a78bfa" />}
                        </div>
                        <span style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 14 }}>{acc.name}</span>
                        <span style={s.bankTypeTag}>{acc.type === "bank" ? "بنك" : "محفظة"}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {acc.account_number && (
                          <BankField label="رقم الحساب" value={acc.account_number} id={`acct-${acc.id}`} copiedId={copiedId} onCopy={copyText} />
                        )}
                        {acc.iban && (
                          <BankField label="الآيبان" value={acc.iban} id={`iban-${acc.id}`} copiedId={copiedId} onCopy={copyText} />
                        )}
                        {acc.phone && (
                          <BankField label="رقم الجوال" value={acc.phone} id={`phone-${acc.id}`} copiedId={copiedId} onCopy={copyText} />
                        )}
                      </div>
                    </div>
                  ))}
                  {bankData.accounts.length === 0 && (
                    <p style={{ color: "#888", textAlign: "center", fontSize: 13, padding: "16px 0" }}>
                      لا توجد حسابات بنكية متاحة حالياً. تواصل مع الدعم.
                    </p>
                  )}
                </div>

                {/* Receipt upload section */}
                <div style={s.receiptBox}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={s.receiptIcon}>
                      <ShieldCheck size={14} color="#a78bfa" />
                    </div>
                    <span style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700 }}>رفع إيصال التحويل</span>
                    <span style={{ color: "#f87171", fontSize: 12, fontWeight: 700 }}>*</span>
                    <span style={{ color: "#555", fontSize: 11, marginRight: 2 }}>(إلزامي)</span>
                  </div>
                  <p style={{ color: "#777", fontSize: 12, lineHeight: 1.7, margin: "0 0 12px" }}>
                    يرجى رفع صورة إيصال التحويل لإتمام طلبك وتفعيل حسابك.
                  </p>

                  {uploadDone ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={s.uploadSuccess}>
                        <CheckCheck size={16} color="#86efac" />
                        <span>تم رفع الإيصال بنجاح!</span>
                      </div>
                      <div style={{ background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 10, padding: "12px 14px", color: "#aaa", fontSize: 12.5, lineHeight: 1.8 }}>
                        ✅ تم استلام طلبك وإيصال التحويل.<br />
                        سيتم مراجعته وتفعيل حسابك وإرسال كود التفعيل على بريدك الإلكتروني خلال 24 ساعة.
                      </div>
                      <button onClick={closeModal} style={{ ...s.payBtn, background: "#fff", color: "#0a0a0a", justifyContent: "center", width: "100%", fontWeight: 800 }}>
                        إغلاق
                      </button>
                    </div>
                  ) : (
                    <>
                      <label style={s.fileLabel}>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          style={{ display: "none" }}
                          onChange={e => { setReceiptFile(e.target.files?.[0] || null); setUploadErr(""); }}
                          disabled={uploading}
                        />
                        <div style={{ ...s.fileDropzone, borderColor: receiptFile ? "#a78bfa" : "#2a2a2a" }}>
                          {receiptFile ? (
                            <span style={{ color: "#e5e7eb", fontSize: 13 }}>{receiptFile.name}</span>
                          ) : (
                            <span style={{ color: "#555", fontSize: 13 }}>اضغط لاختيار صورة الإيصال</span>
                          )}
                        </div>
                      </label>

                      {uploadErr && (
                        <div style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{uploadErr}</div>
                      )}

                      {receiptFile && (
                        <button
                          onClick={handleReceiptUpload}
                          disabled={uploading}
                          style={{ ...s.payBtn, background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", width: "100%", justifyContent: "center", marginTop: 10, opacity: uploading ? 0.7 : 1 }}
                        >
                          {uploading
                            ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                            : <ShieldCheck size={14} />}
                          <span>{uploading ? "جاري الرفع..." : "رفع الإيصال"}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Back button — hidden after upload */}
                {!uploadDone && (
                  <button
                    onClick={() => { setStep("form"); setBankData(null); setReceiptFile(null); setUploadDone(false); setUploadErr(""); }}
                    style={{ ...s.payBtn, background: "#1a1a1a", color: "#aaa", border: "1px solid #2a2a2a", marginTop: 4, width: "100%", justifyContent: "center" }}
                  >
                    <span>← العودة لخيارات الدفع</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 760px) {
          .__grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .__modal { padding: 16px !important; border-radius: 16px !important; }
          .__formgrid { grid-template-columns: 1fr !important; }
          .__paybtns { grid-template-columns: 1fr !important; }
        }
        .__modal::-webkit-scrollbar { width: 4px; }
        .__modal::-webkit-scrollbar-track { background: transparent; }
        .__modal::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 4px; }
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
  navBtn: { background: "#fff", color: "#0a0a0a", padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none", border: "none" },

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
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14, position: "relative", zIndex: 1, flexWrap: "wrap" },
  cardName: { color: "#e5e7eb", fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: "-0.2px", flex: 1, minWidth: 0, overflowWrap: "break-word", wordBreak: "break-word" },
  savingsBadge: { background: "rgba(34,197,94,0.12)", color: "#86efac", border: "1px solid rgba(34,197,94,0.3)", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" },
  cardPrice: { display: "flex", alignItems: "flex-end", gap: 8, position: "relative", zIndex: 1 },
  priceNum: { fontSize: "clamp(38px, 9vw, 50px)", fontWeight: 900, color: "#fff", lineHeight: 0.9, letterSpacing: "-2px" },
  priceMeta: { display: "flex", flexDirection: "column", gap: 2, paddingBottom: 4 },
  priceCurr: { fontSize: 13, color: "#888", fontWeight: 700 },
  priceDur: { fontSize: 11, color: "#666", fontWeight: 500 },
  monthlyEquiv: { fontSize: 12, color: "#888", marginTop: 8, fontWeight: 500, position: "relative", zIndex: 1 },
  divider: { height: 1, background: "#1f1f1f", margin: "20px 0", position: "relative", zIndex: 1 },
  featureList: { listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 11, flex: 1, position: "relative", zIndex: 1 },
  featureItem: { display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#bbb" },
  checkIcon: { width: 18, height: 18, borderRadius: 6, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  buyBtn: { width: "100%", padding: "13px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff", color: "#0a0a0a", border: "none", marginTop: "auto", position: "relative", zIndex: 1 },

  // FOOTER
  footer: { borderTop: "1px solid #1a1a1a", padding: "24px" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  footerLink: { color: "#666", fontSize: 12.5, textDecoration: "none" },

  // MODAL
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 },
  modal: { background: "#0d0d0d", border: "1px solid #222", borderRadius: 20, padding: "22px 22px 18px", width: "100%", maxWidth: 440, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,0.9)", position: "relative" },
  modalGlow: { position: "absolute", top: -60, right: -60, width: 180, height: 180, background: "radial-gradient(circle, rgba(167,139,250,0.12), transparent 70%)", pointerEvents: "none", zIndex: 0 },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, position: "relative", zIndex: 1 },
  modalIconWrap: { width: 34, height: 34, borderRadius: 10, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: 800, marginBottom: 2 },
  modalSub: { color: "#666", fontSize: 12 },
  closeBtn: { background: "#161616", border: "1px solid #252525", borderRadius: 8, padding: "6px", cursor: "pointer", color: "#666", display: "flex", lineHeight: 1, flexShrink: 0 },

  // Price strip
  priceStrip: { background: "linear-gradient(135deg, rgba(167,139,250,0.08), rgba(109,40,217,0.06))", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 },
  stripLabel: { color: "#888", fontSize: 12 },
  stripAmount: { color: "#a78bfa", fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px" },
  stripCurr: { color: "#888", fontSize: 12, fontWeight: 600 },
  stripDur: { color: "#555", fontSize: 11 },

  // Form grid
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px", marginBottom: 14, position: "relative", zIndex: 1 },
  formCol: { display: "flex", flexDirection: "column" as const },
  label: { display: "block", color: "#777", fontSize: 11, marginBottom: 5, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.3px" },
  input: { width: "100%", background: "#080808", border: "1px solid #1e1e1e", borderRadius: 9, padding: "10px 12px", color: "#fff", fontSize: 13.5, outline: "none", boxSizing: "border-box" as const },

  errBox: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 9, padding: "9px 13px", color: "#fca5a5", fontSize: 12.5, marginBottom: 12, position: "relative", zIndex: 1 },

  // Gateway divider
  gatewayLabel: { display: "flex", alignItems: "center", gap: 10, margin: "14px 0 12px", position: "relative", zIndex: 1 },
  gatewayLine: { flex: 1, height: 1, background: "#1e1e1e" },
  gatewayText: { color: "#555", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" as const },

  // Pay buttons side by side
  payBtns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14, position: "relative", zIndex: 1 },
  payBtn: { borderRadius: 11, padding: "12px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "opacity 0.15s" },
  payBtnTamara: { background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", boxShadow: "0 6px 20px rgba(109,40,217,0.35)" },
  payBtnStream: { background: "#161b27", color: "#94a3b8", border: "1px solid #1e2738" },
  payBtnBank: { background: "#0f1612", color: "#86efac", border: "1px solid #1a2e20" },
  discountBadge: { position: "absolute" as const, top: -8, left: 12, background: "#a78bfa", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6 },

  // Bank transfer styles
  bankAmountBox: { background: "linear-gradient(135deg, rgba(167,139,250,0.06), rgba(109,40,217,0.04))", border: "1px solid rgba(167,139,250,0.12)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column" as const, gap: 6 },
  bankCard: { background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 12, padding: "14px 14px 10px" },
  bankIcon: { width: 28, height: 28, borderRadius: 8, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center" },
  bankTypeTag: { marginRight: "auto", background: "#111", color: "#666", fontSize: 10, padding: "2px 8px", borderRadius: 6, border: "1px solid #1f1f1f" },

  // Receipt upload
  receiptBox: { background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 12, padding: "14px", marginTop: 14 },
  receiptIcon: { width: 26, height: 26, borderRadius: 7, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  fileLabel: { display: "block", cursor: "pointer" },
  fileDropzone: { border: "1.5px dashed #2a2a2a", borderRadius: 10, padding: "14px 16px", textAlign: "center" as const, transition: "border-color 0.2s", background: "#080808" },
  uploadSuccess: { display: "flex", alignItems: "center", gap: 8, background: "rgba(134,239,172,0.06)", border: "1px solid rgba(134,239,172,0.2)", borderRadius: 10, padding: "10px 14px", color: "#86efac", fontSize: 13, fontWeight: 600 },

  secureNote: { textAlign: "center" as const, color: "#444", fontSize: 11, margin: 0, position: "relative", zIndex: 1 },

  // legacy (kept for card)
  summaryBox: { background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 12, padding: "14px 16px", marginBottom: 20 },
  formFields: { display: "flex", flexDirection: "column" as const, gap: 14, marginBottom: 16 },
  checkoutBtn: { width: "100%", background: "linear-gradient(135deg, #a78bfa, #6d28d9)", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12, boxShadow: "0 8px 24px rgba(109,40,217,0.4)" },
};

// rebuild: 1776481799
