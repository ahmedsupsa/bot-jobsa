"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Sparkles, Check, ShoppingCart, X, RefreshCw, Loader2, ShieldCheck,
  Copy, CheckCheck, Building2, Wallet, Tag, Search, ArrowUpDown, Clock,
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ color: "var(--text3)", fontSize: 11 }}>{label}</span>
        <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 600, letterSpacing: "0.2px", direction: "ltr" }}>{value}</span>
      </div>
      <button
        onClick={() => onCopy(value, id)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: copied ? "var(--text)" : "var(--text4)", transition: "color 0.2s" }}
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

  // Discount code
  const [discountInput, setDiscountInput] = useState("");
  const [discountState, setDiscountState] = useState<{
    applied: boolean;
    code?: string;
    original?: number;
    final?: number;
    saved?: number;
    error?: string;
    loading?: boolean;
  }>({ applied: false });

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const [pendingBanner, setPendingBanner] = useState<{ order_id: string; product_name: string; amount: number } | null>(null);
  const [resuming, setResuming] = useState(false);

  // Search + sort
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "price_asc" | "price_desc" | "duration_asc" | "duration_desc">("default");

  useEffect(() => {
    fetch(`/api/store/products?t=${Date.now()}`, { cache: "no-store" })
      .then(r => r.json())
      .then(j => { setProducts(j.products || []); setLoading(false); })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch with admin key when user searches for "adm" → reveals secret products
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (q.includes("adm")) {
      fetch(`/api/store/products?key=admin&t=${Date.now()}`, { cache: "no-store" })
        .then(r => r.json())
        .then(j => setProducts(j.products || []))
        .catch(() => {});
    }
  }, [search]);

  useEffect(() => {

    if (typeof window !== "undefined") { // legacy ref param

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

      // Check for pending bank transfer order
      const raw = localStorage.getItem("jobbots_pending_bank");
      if (raw) {
        try {
          const saved = JSON.parse(raw) as { order_id: string; product_name: string; amount: number; saved_at: number };
          const age = Date.now() - (saved.saved_at || 0);
          // Only show if less than 7 days old
          if (age < 7 * 24 * 60 * 60 * 1000 && saved.order_id) {
            setPendingBanner({ order_id: saved.order_id, product_name: saved.product_name, amount: saved.amount });
          } else {
            localStorage.removeItem("jobbots_pending_bank");
          }
        } catch {
          localStorage.removeItem("jobbots_pending_bank");
        }
      }
    }
  }, []);

  const handleResumeOrder = async () => {
    if (!pendingBanner) return;
    setResuming(true);
    try {
      const r = await fetch(`/api/store/resume-order?order_id=${pendingBanner.order_id}&t=${Date.now()}`);
      const j = await r.json();
      if (!j.ok) {
        // Order already processed or not found — clear banner
        localStorage.removeItem("jobbots_pending_bank");
        setPendingBanner(null);
        if (j.status === "paid" || j.status === "active") {
          alert("تم تفعيل اشتراكك بالفعل! تحقق من بريدك الإلكتروني.");
        } else {
          alert(j.error || "لم يتم العثور على الطلب أو تم إلغاؤه.");
        }
        return;
      }
      // Open modal in bank_details step directly
      setSelected({
        id: "__resume__",
        name: j.product_name,
        price: j.original_amount,
        duration_days: 30,
      });
      setBankData({
        accounts: j.accounts || [],
        amount: j.amount,
        original_amount: j.original_amount,
        has_discount: j.has_discount,
        order_id: j.order_id,
      });
      setStep("bank_details");
    } catch {
      alert("حدث خطأ أثناء جلب بيانات الطلب. حاول مجدداً.");
    }
    setResuming(false);
  };

  const handleBuy = (p: Product) => {
    setSelected(p); setFormErr(""); setStep("form"); setBankData(null);
    setDiscountInput(""); setDiscountState({ applied: false });
  };

  const closeModal = () => {
    setSelected(null); setFormErr(""); setStep("form"); setBankData(null);
    setReceiptFile(null); setUploadDone(false); setUploadErr("");
    setDiscountInput(""); setDiscountState({ applied: false });
  };

  const applyDiscountCode = async () => {
    if (!selected || !discountInput.trim()) return;
    setDiscountState({ applied: false, loading: true });
    try {
      const r = await fetch("/api/store/validate-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: discountInput.trim(), product_id: selected.id }),
      });
      const j = await r.json();
      if (!j.ok) {
        setDiscountState({ applied: false, error: j.error || "كود غير صحيح" });
        return;
      }
      setDiscountState({
        applied: true,
        code: j.code,
        original: j.original_amount,
        final: j.discounted_amount,
        saved: j.discount_amount,
      });
    } catch {
      setDiscountState({ applied: false, error: "خطأ في التحقق" });
    }
  };

  const removeDiscount = () => {
    setDiscountInput("");
    setDiscountState({ applied: false });
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
      // Clear pending order from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("jobbots_pending_bank");
        setPendingBanner(null);
      }
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
          discount_code: discountState.applied ? discountState.code : undefined,
          gateway,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل إنشاء رابط الدفع");

      if (gateway === "bank_transfer") {
        const bData = {
          accounts: j.accounts || [],
          amount: j.amount,
          original_amount: j.original_amount,
          has_discount: j.has_discount,
          order_id: j.order_id,
        };
        setBankData(bData);
        setStep("bank_details");
        setSubmitting(null);
        // Save to localStorage so user can resume later
        if (typeof window !== "undefined" && j.order_id) {
          localStorage.setItem("jobbots_pending_bank", JSON.stringify({
            order_id: j.order_id,
            product_name: selected?.name || "اشتراك",
            amount: j.amount,
            saved_at: Date.now(),
          }));
          setPendingBanner(null); // hide banner if it was showing
        }
        return;
      }

      const allowedHosts = [
        "api.tamara.co", "checkout.tamara.co",
        "api.moyasar.com", "checkout.moyasar.com",
        "secure.moyasar.com",
      ];
      try {
        const dest = new URL(j.url);
        if (dest.protocol === "https:" && allowedHosts.some(h => dest.hostname === h || dest.hostname.endsWith("." + h))) {
          window.location.href = j.url;
        } else {
          throw new Error("رابط الدفع غير صالح");
        }
      } catch {
        throw new Error("رابط الدفع غير صالح");
      }
    } catch (e) {
      setFormErr(String(e).replace("Error: ", ""));
      setSubmitting(null);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (p.name || "").toLowerCase().includes(q)
      || (p.description || "").toLowerCase().includes(q);
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "price_asc":    return a.price - b.price;
      case "price_desc":   return b.price - a.price;
      case "duration_asc": return a.duration_days - b.duration_days;
      case "duration_desc":return b.duration_days - a.duration_days;
      default:             return a.duration_days - b.duration_days;
    }
  });

  const baseMonthly = [...products].sort((a, b) => a.duration_days - b.duration_days).find(p => p.duration_days === 30)?.price
    || (products[0] ? products[0].price / (products[0].duration_days / 30) : 0);

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
            <Sparkles size={13} color="var(--text)" />
            <span>تم تطبيق كود الإحالة <strong style={{ color: "var(--text)" }}>{refCode}</strong></span>
          </div>
        )}

        {/* Pending bank transfer banner */}
        {pendingBanner && (
          <div style={s.resumeBanner}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <div style={s.resumeIconWrap}>
                <Clock size={14} color="var(--text)" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>
                  لديك طلب حوالة بنكية معلق
                </span>
                <span style={{ color: "var(--text3)", fontSize: 11.5 }}>
                  {pendingBanner.product_name} · {pendingBanner.amount} ر.س — أرفع إيصالك لإتمام الاشتراك
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={handleResumeOrder}
                disabled={resuming}
                style={s.resumeBtn}
              >
                {resuming
                  ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />
                  : null}
                <span>{resuming ? "جاري..." : "استكمال"}</span>
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("jobbots_pending_bank");
                  setPendingBanner(null);
                }}
                style={s.resumeDismissBtn}
                title="إخفاء"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Search + sort toolbar */}
        {!loading && products.length > 0 && (
          <div style={s.toolbar}>
            <div style={s.searchWrap}>
              <Search size={15} color="var(--text4)" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن باقة..."
                style={s.searchInput}
              />
            </div>
            <div style={s.sortWrap}>
              <ArrowUpDown size={14} color="var(--text4)" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                style={s.sortSelect}
              >
                <option value="default">ترتيب افتراضي</option>
                <option value="price_asc">السعر: من الأقل للأعلى</option>
                <option value="price_desc">السعر: من الأعلى للأقل</option>
                <option value="duration_asc">المدة: من الأقصر للأطول</option>
                <option value="duration_desc">المدة: من الأطول للأقصر</option>
              </select>
            </div>
          </div>
        )}

        {loading ? (
          <div style={s.loaderWrap}>
            <Loader2 size={28} color="var(--text3)" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : products.length === 0 ? (
          <div style={s.empty}>
            <p style={{ color: "var(--text3)", fontSize: 15 }}>لا توجد منتجات متاحة حالياً</p>
          </div>
        ) : sortedProducts.length === 0 ? (
          <div style={s.empty}>
            <p style={{ color: "var(--text3)", fontSize: 15 }}>لا توجد نتائج مطابقة لبحثك</p>
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
                              <Check size={11} strokeWidth={3} color="var(--text)" />
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
          <span style={{ color: "var(--text3)", fontSize: 12.5 }}>© 2025 Jobbots</span>
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
                  <ShoppingCart size={15} color="var(--text)" />
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
                {discountState.applied && discountState.final !== undefined ? (
                  <>
                    <span style={{ ...s.stripAmount, color: "var(--text)" }}>{discountState.final}</span>
                    <span style={s.stripCurr}>ر.س</span>
                    <span style={{ color: "var(--text3)", fontSize: 13, textDecoration: "line-through", marginInlineStart: 6 }}>
                      {selected.price} ر.س
                    </span>
                    <span style={s.stripDur}>/ {durationLabel(selected.duration_days)}</span>
                  </>
                ) : (
                  <>
                    <span style={s.stripAmount}>{selected.price}</span>
                    <span style={s.stripCurr}>ر.س</span>
                    <span style={s.stripDur}>/ {durationLabel(selected.duration_days)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Form — two columns on desktop — hidden in resume mode */}
            <div style={{ ...s.formGrid, display: selected?.id === "__resume__" ? "none" : "grid" }} className="__formgrid">
              <div style={s.formCol}>
                <label style={s.label}>الاسم الكامل *</label>
                <input style={s.input} placeholder=""
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!!submitting}
                />
              </div>
              <div style={s.formCol}>
                <label style={s.label}>رقم الجوال *</label>
                <input style={{ ...s.input, direction: "ltr", textAlign: "right" }}
                  type="tel" placeholder=""
                  value={form.phone}
                  onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!!submitting}
                />
              </div>
              <div style={{ ...s.formCol, gridColumn: "1 / -1" }}>
                <label style={s.label}>البريد الإلكتروني *</label>
                <input style={{ ...s.input, direction: "ltr", textAlign: "right" }}
                  type="email" placeholder=""
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!!submitting}
                />
              </div>
            </div>

            {formErr && <div style={s.errBox}>{formErr}</div>}

            {/* Discount code */}
            {step === "form" && (
              <div style={s.discountBox}>
                <div style={s.discountHeader}>
                  <Tag size={13} color="var(--text)" />
                  <span style={s.discountTitle}>كود خصم (اختياري)</span>
                </div>
                {discountState.applied ? (
                  <div style={s.discountApplied}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <CheckCheck size={14} color="var(--text)" />
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>{discountState.code}</span>
                        <span style={{ color: "var(--text)", fontSize: 11, fontWeight: 600 }}>
                          وفّرت {discountState.saved} ر.س
                        </span>
                      </div>
                    </div>
                    <button onClick={removeDiscount} style={s.discountRemoveBtn}>
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        style={{ ...s.input, flex: 1, textTransform: "uppercase" }}
                        placeholder="مثال: WELCOME10"
                        value={discountInput}
                        onChange={e => { setDiscountInput(e.target.value); setDiscountState(s => ({ ...s, error: undefined })); }}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyDiscountCode(); } }}
                        disabled={!!submitting || discountState.loading}
                      />
                      <button
                        onClick={applyDiscountCode}
                        disabled={!discountInput.trim() || discountState.loading || !!submitting}
                        style={s.discountApplyBtn}
                      >
                        {discountState.loading
                          ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
                          : "تطبيق"}
                      </button>
                    </div>
                    {discountState.error && (
                      <div style={s.discountError}>{discountState.error}</div>
                    )}
                  </>
                )}

                {discountState.applied && (
                  <div style={s.discountSummary}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text3)" }}>
                      <span>السعر الأصلي</span>
                      <span style={{ textDecoration: "line-through" }}>{discountState.original} ر.س</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text)", fontWeight: 800, marginTop: 4 }}>
                      <span>الإجمالي بعد الخصم</span>
                      <span style={{ color: "var(--text)" }}>{discountState.final} ر.س</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment gateway label — hidden in bank_details step */}
            <div style={{ ...s.gatewayLabel, display: step === "bank_details" ? "none" : "flex" }}>
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
                      ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /><span>جاري...</span></>
                      : <img src="/payment-logos/tamara.png" alt="Tamara" style={{ height: 22, width: "auto", display: "block" }} />}
                  </button>

                  <button
                    onClick={() => handleCheckout("streampay")}
                    disabled={!!submitting}
                    style={{ ...s.payBtn, ...s.payBtnStream, opacity: submitting ? 0.65 : 1 }}
                  >
                    {submitting === "streampay"
                      ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /><span>جاري...</span></>
                      : <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <img src="/payment-logos/mada.png" alt="مدى" style={{ height: 18, width: "auto", display: "block" }} />
                          <img src="/payment-logos/visa.png" alt="Visa" style={{ height: 14, width: "auto", display: "block" }} />
                          <img src="/payment-logos/mastercard.png" alt="Mastercard" style={{ height: 18, width: "auto", display: "block" }} />
                        </span>}
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
                      <span style={{ color: "var(--text2)" }}>السعر الأصلي</span>
                      <span style={{ color: "var(--text3)", textDecoration: "line-through" }}>{bankData.original_amount} ر.س</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text2)", fontSize: 13 }}>
                      {bankData.has_discount ? "بعد الخصم 15%" : "المبلغ المطلوب"}
                    </span>
                    <span style={{ color: "var(--text)", fontSize: 22, fontWeight: 900 }}>{bankData.amount} ر.س</span>
                  </div>
                  <p style={{ color: "var(--text2)", fontSize: 12, margin: "8px 0 0", lineHeight: 1.7 }}>
                    بعد إتمام التحويل، أرسل إيصال الدفع إلى الدعم وسيتم تفعيل حسابك خلال 24 ساعة.
                  </p>
                </div>

                {/* Bank accounts list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                  {bankData.accounts.map(acc => (
                    <div key={acc.id} style={s.bankCard}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={s.bankIcon}>
                          {acc.type === "bank" ? <Building2 size={14} color="var(--text)" /> : <Wallet size={14} color="var(--text)" />}
                        </div>
                        <span style={{ color: "var(--text)", fontWeight: 700, fontSize: 14 }}>{acc.name}</span>
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
                    <p style={{ color: "var(--text3)", textAlign: "center", fontSize: 13, padding: "16px 0" }}>
                      لا توجد حسابات بنكية متاحة حالياً. تواصل مع الدعم.
                    </p>
                  )}
                </div>

                {/* Receipt upload section */}
                <div style={s.receiptBox}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={s.receiptIcon}>
                      <ShieldCheck size={14} color="var(--text)" />
                    </div>
                    <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>رفع إيصال التحويل</span>
                    <span style={{ color: "var(--danger)", fontSize: 12, fontWeight: 700 }}>*</span>
                    <span style={{ color: "var(--text4)", fontSize: 11, marginRight: 2 }}>(إلزامي)</span>
                  </div>
                  <p style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.7, margin: "0 0 12px" }}>
                    يرجى رفع صورة إيصال التحويل لإتمام طلبك وتفعيل حسابك.
                  </p>

                  {uploadDone ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={s.uploadSuccess}>
                        <CheckCheck size={16} color="var(--success-fg)" />
                        <span>تم رفع الإيصال بنجاح!</span>
                      </div>
                      <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", color: "var(--text2)", fontSize: 12.5, lineHeight: 1.8 }}>
                        ✅ تم استلام طلبك وإيصال التحويل.<br />
                        سيتم مراجعته وتفعيل حسابك وإرسال كود التفعيل على بريدك الإلكتروني خلال 24 ساعة.
                      </div>
                      <button onClick={closeModal} style={{ ...s.payBtn, background: "var(--accent)", color: "var(--accent-fg)", justifyContent: "center", width: "100%", fontWeight: 800 }}>
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
                        <div style={{ ...s.fileDropzone, borderColor: receiptFile ? "var(--accent)" : "var(--border2)" }}>
                          {receiptFile ? (
                            <span style={{ color: "var(--text)", fontSize: 13 }}>{receiptFile.name}</span>
                          ) : (
                            <span style={{ color: "var(--text4)", fontSize: 13 }}>اضغط لاختيار صورة الإيصال</span>
                          )}
                        </div>
                      </label>

                      {uploadErr && (
                        <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{uploadErr}</div>
                      )}

                      {receiptFile && (
                        <button
                          onClick={handleReceiptUpload}
                          disabled={uploading}
                          style={{ ...s.payBtn, background: "var(--accent)", color: "var(--text)", width: "100%", justifyContent: "center", marginTop: 10, opacity: uploading ? 0.7 : 1 }}
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
                    onClick={() => {
                      if (selected?.id === "__resume__") {
                        // In resume mode, back = close modal
                        closeModal();
                      } else {
                        setStep("form"); setBankData(null); setReceiptFile(null); setUploadDone(false); setUploadErr("");
                      }
                    }}
                    style={{ ...s.payBtn, background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border2)", marginTop: 4, width: "100%", justifyContent: "center" }}
                  >
                    <span>{selected?.id === "__resume__" ? "← إغلاق" : "← العودة لخيارات الدفع"}</span>
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
        .__modal::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", color: "var(--text)", fontFamily: "'Tajawal', system-ui, sans-serif" },

  // NAV
  nav: { borderBottom: "1px solid var(--border)", padding: "0 24px", background: "var(--surface)" },
  navInner: { maxWidth: 1100, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  logoIcon: { width: 34, height: 34, borderRadius: 9, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { color: "var(--text)", fontSize: 17, fontWeight: 800 },
  navBtn: { background: "var(--accent)", color: "var(--accent-fg)", padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none", border: "none" },

  // MAIN
  main: { flex: 1, padding: "60px 24px", maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box" },
  refBanner: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 18px", fontSize: 12.5, color: "var(--text2)", marginBottom: 28, maxWidth: 480, marginLeft: "auto", marginRight: "auto" },
  loaderWrap: { textAlign: "center", padding: "120px 0" },
  empty: { textAlign: "center", padding: "120px 0" },

  // GRID
  grid: { display: "grid", gap: 18, alignItems: "stretch" },

  // CARD
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "28px 26px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", transition: "all 0.2s", boxShadow: "var(--shadow)" },
  cardGlow: { display: "none" },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14, position: "relative", zIndex: 1, flexWrap: "wrap" },
  cardName: { color: "var(--text)", fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: "-0.2px", flex: 1, minWidth: 0, overflowWrap: "break-word", wordBreak: "break-word" },
  savingsBadge: { background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border2)", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" },
  cardPrice: { display: "flex", alignItems: "flex-end", gap: 8, position: "relative", zIndex: 1 },
  priceNum: { fontSize: "clamp(38px, 9vw, 50px)", fontWeight: 900, color: "var(--text)", lineHeight: 0.9, letterSpacing: "-2px" },
  priceMeta: { display: "flex", flexDirection: "column", gap: 2, paddingBottom: 4 },
  priceCurr: { fontSize: 13, color: "var(--text3)", fontWeight: 700 },
  priceDur: { fontSize: 11, color: "var(--text4)", fontWeight: 500 },
  monthlyEquiv: { fontSize: 12, color: "var(--text3)", marginTop: 8, fontWeight: 500, position: "relative", zIndex: 1 },
  divider: { height: 1, background: "var(--border)", margin: "20px 0", position: "relative", zIndex: 1 },
  featureList: { listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 11, flex: 1, position: "relative", zIndex: 1 },
  featureItem: { display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--text2)" },
  checkIcon: { width: 18, height: 18, borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  buyBtn: { width: "100%", padding: "13px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--accent)", color: "var(--accent-fg)", border: "none", marginTop: "auto", position: "relative", zIndex: 1 },

  // FOOTER
  footer: { borderTop: "1px solid var(--border)", padding: "24px", background: "var(--surface)" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  footerLink: { color: "var(--text3)", fontSize: 12.5, textDecoration: "none" },

  // MODAL
  overlay: { position: "fixed", inset: 0, background: "var(--modal-backdrop)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 },
  modal: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "22px 22px 18px", width: "100%", maxWidth: 440, maxHeight: "92vh", overflowY: "auto", boxShadow: "var(--shadow)", position: "relative" },
  modalGlow: { display: "none" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, position: "relative", zIndex: 1 },
  modalIconWrap: { width: 34, height: 34, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  modalTitle: { color: "var(--text)", fontSize: 16, fontWeight: 800, marginBottom: 2 },
  modalSub: { color: "var(--text3)", fontSize: 12 },
  closeBtn: { background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: "6px", cursor: "pointer", color: "var(--text3)", display: "flex", lineHeight: 1, flexShrink: 0 },

  // Price strip
  priceStrip: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 },
  stripLabel: { color: "var(--text3)", fontSize: 12 },
  stripAmount: { color: "var(--text)", fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px" },
  stripCurr: { color: "var(--text3)", fontSize: 12, fontWeight: 600 },
  stripDur: { color: "var(--text4)", fontSize: 11 },

  // Form grid
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px", marginBottom: 14, position: "relative", zIndex: 1 },
  formCol: { display: "flex", flexDirection: "column" as const },
  label: { display: "block", color: "var(--text3)", fontSize: 11, marginBottom: 5, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.3px" },
  input: { width: "100%", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px", color: "var(--text)", fontSize: 13.5, outline: "none", boxSizing: "border-box" as const },


  toolbar: { display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" as const, alignItems: "center" },
  searchWrap: { position: "relative" as const, flex: "1 1 220px", minWidth: 0 },
  searchInput: { width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, padding: "10px 38px 10px 12px", color: "var(--text)", fontSize: 13.5, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" },
  sortWrap: { display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, padding: "0 12px", height: 40 },
  sortSelect: { background: "transparent", border: "none", color: "var(--text)", fontSize: 13, outline: "none", cursor: "pointer", fontFamily: "inherit", padding: "8px 0", minWidth: 160 },

  errBox: { background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 9, padding: "9px 13px", color: "var(--danger)", fontSize: 12.5, marginBottom: 12, position: "relative", zIndex: 1 },

  // Gateway divider
  gatewayLabel: { display: "flex", alignItems: "center", gap: 10, margin: "14px 0 12px", position: "relative", zIndex: 1 },
  gatewayLine: { flex: 1, height: 1, background: "var(--border)" },
  gatewayText: { color: "var(--text4)", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" as const },

  // Pay buttons side by side
  payBtns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14, position: "relative", zIndex: 1 },
  payBtn: { borderRadius: 11, padding: "10px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "opacity 0.15s", background: "var(--surface)", color: "var(--text)", minHeight: 46 },
  payBtnTamara: { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border2)" },
  payBtnStream: { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border2)" },
  payBtnBank: { background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border2)" },
  discountBadge: { position: "absolute" as const, top: -8, left: 12, background: "var(--accent)", color: "var(--accent-fg)", fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6 },

  // Bank transfer styles
  bankAmountBox: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column" as const, gap: 6 },
  bankCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 14px 10px" },
  bankIcon: { width: 28, height: 28, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center" },
  bankTypeTag: { marginRight: "auto", background: "var(--surface2)", color: "var(--text3)", fontSize: 10, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)" },

  // Discount code
  discountBox: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, position: "relative", zIndex: 1 },
  discountHeader: { display: "flex", alignItems: "center", gap: 7, marginBottom: 9 },
  discountTitle: { color: "var(--text2)", fontSize: 12, fontWeight: 700 },
  discountApplyBtn: { background: "var(--accent)", color: "var(--accent-fg)", border: "none", borderRadius: 9, padding: "0 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 64 },
  discountApplied: { display: "flex", alignItems: "center", gap: 8, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 9, padding: "9px 12px" },
  discountRemoveBtn: { background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 7, padding: 5, cursor: "pointer", color: "var(--text3)", display: "flex", lineHeight: 1, flexShrink: 0 },
  discountError: { color: "var(--danger)", fontSize: 11.5, marginTop: 7 },
  discountSummary: { marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" },

  // Receipt upload
  receiptBox: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px", marginTop: 14 },
  receiptIcon: { width: 26, height: 26, borderRadius: 7, background: "var(--surface2)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  fileLabel: { display: "block", cursor: "pointer" },
  fileDropzone: { border: "1.5px dashed var(--border2)", borderRadius: 10, padding: "14px 16px", textAlign: "center" as const, transition: "border-color 0.2s", background: "var(--input-bg)" },
  uploadSuccess: { display: "flex", alignItems: "center", gap: 8, background: "var(--success-bg)", border: "1px solid var(--success-border)", borderRadius: 10, padding: "10px 14px", color: "var(--success-fg)", fontSize: 13, fontWeight: 600 },

  secureNote: { textAlign: "center" as const, color: "var(--text4)", fontSize: 11, margin: 0, position: "relative", zIndex: 1 },

  // Resume pending bank order
  resumeBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 14, padding: "12px 16px", marginBottom: 22, flexWrap: "wrap" as const, boxShadow: "var(--shadow)" },
  resumeIconWrap: { width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  resumeBtn: { background: "var(--accent)", color: "var(--accent-fg)", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
  resumeDismissBtn: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 7px", cursor: "pointer", color: "var(--text3)", display: "flex", lineHeight: 1, alignItems: "center" },

  // legacy (kept for card)
  summaryBox: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 20 },
  formFields: { display: "flex", flexDirection: "column" as const, gap: 14, marginBottom: 16 },
  checkoutBtn: { width: "100%", background: "var(--accent)", color: "var(--accent-fg)", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
};

// rebuild: 1776481799
