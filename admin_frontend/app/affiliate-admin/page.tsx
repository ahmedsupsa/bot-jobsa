"use client";

import Shell from "@/components/shell";
import { API_BASE } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Users, DollarSign, Plus, Pencil, Trash2, X, Save,
  RefreshCw, Copy, Check, Link2, ChevronLeft, CheckCircle2,
  Clock, Package, Percent, Banknote, User, Mail, Phone, FileText,
  ShoppingCart, Eye, Upload, Wallet, Building2, XCircle,
} from "lucide-react";

type Marketer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  code: string;
  commission_type: "percent" | "fixed";
  commission_value: number;
  product_id?: string | null;
  product_name?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  sales_count: number;
  total_earned: number;
  pending_earned: number;
  paid_earned: number;
};

type Sale = {
  id: string;
  affiliate_id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  order_amount: number;
  commission_earned: number;
  status: "pending" | "paid";
  notes?: string | null;
  paid_at?: string | null;
  created_at: string;
};

type Product = { id: string; name: string; price: number };

type Withdrawal = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  amount: number;
  method: "bank" | "wallet";
  bank_name?: string | null;
  iban?: string | null;
  account_holder: string;
  wallet_provider?: string | null;
  wallet_number?: string | null;
  status: "pending" | "paid" | "rejected";
  proof_url?: string | null;
  notes?: string | null;
  created_at: string;
  paid_at?: string | null;
};

const EMPTY_FORM = {
  name: "", email: "", phone: "", code: "",
  commission_type: "percent" as "percent" | "fixed",
  commission_value: "10",
  product_id: "",
  notes: "",
};

const EMPTY_SALE = { customer_name: "", customer_email: "", order_amount: "", commission_earned: "", notes: "" };

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function generateCode(name: string) {
  const base = name.trim().split(" ")[0].toUpperCase().replace(/[^A-Z0-9]/g, "") || "REF";
  const num = Math.floor(Math.random() * 90 + 10);
  return `${base}${num}`;
}

export default function AffiliateAdminPage() {
  const [tab, setTab] = useState<"marketers" | "withdrawals">("marketers");
  const [marketers, setMarketers] = useState<Marketer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  // Panel state
  const [selectedMarketer, setSelectedMarketer] = useState<Marketer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editMarketer, setEditMarketer] = useState<Marketer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  // Sales panel
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [showAddSale, setShowAddSale] = useState(false);
  const [saleForm, setSaleForm] = useState(EMPTY_SALE);
  const [saleSaving, setSaleSaving] = useState(false);

  // Withdrawal modal
  const [activeWd, setActiveWd] = useState<Withdrawal | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewProof, setPreviewProof] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`${API_BASE}/api/admin/marketers`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/store/products`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/affiliates/withdrawals`, { credentials: "include" }),
      ]);
      const j1 = await r1.json();
      const j2 = await r2.json();
      const j3 = await r3.json();
      if (j1.ok) setMarketers(j1.marketers || []);
      if (j2.ok) setProducts((j2.products || []).filter((p: Product & { is_active: boolean }) => p.is_active));
      if (j3.ok) setWithdrawals(j3.withdrawals || []);
    } catch {}
    setLoading(false);
  }, []);

  const loadSales = useCallback(async (affiliateId: string) => {
    setSalesLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/marketers/${affiliateId}`, { credentials: "include" });
      const j = await r.json();
      if (j.ok) setSales(j.sales || []);
    } catch {}
    setSalesLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (selectedMarketer) {
      loadSales(selectedMarketer.id);
      // Sync panel data if marketers reload
      const updated = marketers.find(m => m.id === selectedMarketer.id);
      if (updated) setSelectedMarketer(updated);
    }
  }, [selectedMarketer?.id, marketers]);

  const openAdd = () => {
    setEditMarketer(null);
    setForm(EMPTY_FORM);
    setMsg("");
    setShowForm(true);
  };

  const openEdit = (m: Marketer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditMarketer(m);
    setForm({
      name: m.name,
      email: m.email || "",
      phone: m.phone || "",
      code: m.code,
      commission_type: m.commission_type,
      commission_value: String(m.commission_value),
      product_id: m.product_id || "",
      notes: m.notes || "",
    });
    setMsg("");
    setShowForm(true);
  };

  const saveMarketer = async () => {
    if (!form.name.trim()) { setMsg("الاسم مطلوب"); setMsgType("err"); return; }
    if (!form.code.trim()) { setMsg("كود الإحالة مطلوب"); setMsgType("err"); return; }
    if (!form.commission_value) { setMsg("قيمة العمولة مطلوبة"); setMsgType("err"); return; }
    setSaving(true); setMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/marketers`, {
        method: editMarketer ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editMarketer ? { id: editMarketer.id } : {}),
          ...form,
          product_id: form.product_id || null,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الحفظ");
      setMsg(editMarketer ? "تم التحديث ✓" : "تم إضافة المسوّق ✓");
      setMsgType("ok");
      setShowForm(false);
      await loadData();
    } catch (e) {
      setMsg(String(e).replace("Error: ", "")); setMsgType("err");
    }
    setSaving(false);
  };

  const deleteMarketer = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("حذف هذا المسوّق؟ سيتم حذف جميع بياناته ومبيعاته.")) return;
    await fetch(`${API_BASE}/api/admin/marketers`, {
      method: "DELETE", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (selectedMarketer?.id === id) setSelectedMarketer(null);
    await loadData();
  };

  const toggleActive = async (m: Marketer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await fetch(`${API_BASE}/api/admin/marketers`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, is_active: !m.is_active }),
    });
    await loadData();
  };

  const markAllPaid = async (id: string) => {
    if (!confirm("تحديد جميع العمولات المعلّقة كمدفوعة؟")) return;
    setMarkingPaid(true);
    await fetch(`${API_BASE}/api/admin/marketers/${id}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_paid" }),
    });
    await loadData();
    await loadSales(id);
    setMarkingPaid(false);
  };

  const addSale = async () => {
    if (!selectedMarketer) return;
    if (!saleForm.order_amount) { alert("مبلغ الطلب مطلوب"); return; }
    setSaleSaving(true);
    const r = await fetch(`${API_BASE}/api/admin/marketers/${selectedMarketer.id}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_sale", ...saleForm }),
    });
    const j = await r.json();
    if (j.ok) {
      setShowAddSale(false);
      setSaleForm(EMPTY_SALE);
      await loadData();
      await loadSales(selectedMarketer.id);
    } else alert(j.error || "فشل");
    setSaleSaving(false);
  };

  const copyRef = async (code: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const link = `https://jobbots.org/store?ref=${code}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Withdrawals
  const rejectWd = async (id: string) => {
    const reason = prompt("سبب الرفض (اختياري):") ?? null;
    if (reason === null && !confirm("رفض الطلب؟")) return;
    await fetch(`${API_BASE}/api/admin/affiliates/withdrawals`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ withdrawal_id: id, action: "reject", notes: reason }),
    });
    await loadData();
    setActiveWd(null);
  };

  const uploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeWd) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("withdrawal_id", activeWd.id);
    fd.append("file", file);
    try {
      const r = await fetch(`${API_BASE}/api/admin/affiliates/withdrawals/proof`, {
        method: "POST", credentials: "include", body: fd,
      });
      const j = await r.json();
      if (j.ok) { await loadData(); setActiveWd(null); }
      else alert(j.error || "فشل الرفع");
    } catch { alert("فشل الرفع"); }
    setUploading(false);
    e.target.value = "";
  };

  const pendingWds = withdrawals.filter(w => w.status === "pending");
  const totalPendingWd = pendingWds.reduce((s, w) => s + Number(w.amount || 0), 0);
  const totalPending = marketers.reduce((s, m) => s + Number(m.pending_earned || 0), 0);
  const totalPaid = marketers.reduce((s, m) => s + Number(m.paid_earned || 0), 0);
  const totalSales = marketers.reduce((s, m) => s + Number(m.sales_count || 0), 0);

  return (
    <Shell>
      <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel2 border border-line2">
              <TrendingUp size={20} className="text-ink" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink">المسوّقون بالعمولة</h1>
              <p className="text-xs text-muted2">إدارة برنامج الإحالة والعمولات</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users,        color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", label: "المسوّقون",      value: String(marketers.length) },
            { icon: ShoppingCart, color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",     label: "إجمالي المبيعات", value: String(totalSales) },
            { icon: Clock,        color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "عمولات معلّقة",   value: `${totalPending.toFixed(2)} ر.س` },
            { icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20",   label: "إجمالي مدفوع",   value: `${totalPaid.toFixed(2)} ر.س` },
          ].map(({ icon: Icon, color, bg, label, value }) => (
            <div key={label} className={`rounded-2xl border ${bg} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={color} />
                <span className="text-xs text-muted2">{label}</span>
              </div>
              <p className="text-lg font-bold text-ink">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-line bg-panel p-1 w-fit">
          <button
            onClick={() => setTab("marketers")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === "marketers" ? "bg-panel2 text-ink border border-line2" : "text-muted hover:text-ink"}`}
          >
            <Users size={15} />
            المسوّقون
          </button>
          <button
            onClick={() => setTab("withdrawals")}
            className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === "withdrawals" ? "bg-panel2 text-ink border border-line2" : "text-muted hover:text-ink"}`}
          >
            <Wallet size={15} />
            طلبات السحب
            {pendingWds.length > 0 && (
              <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[9px] font-bold text-black">
                {pendingWds.length}
              </span>
            )}
          </button>
        </div>

        {/* ─── MARKETERS TAB ─── */}
        {tab === "marketers" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{marketers.length} مسوّق</span>
              <button
                onClick={openAdd}
                className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-4 py-2 text-sm font-semibold hover:bg-panel2 transition-all"
              >
                <Plus size={15} />
                إضافة مسوّق
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted2">
                <RefreshCw size={18} className="animate-spin ml-2" />جاري التحميل...
              </div>
            ) : marketers.length === 0 ? (
              <div className="rounded-2xl border border-line bg-panel p-14 text-center">
                <TrendingUp size={32} className="mx-auto mb-3 text-muted" />
                <p className="text-muted2 mb-1">لا يوجد مسوّقون بعد</p>
                <p className="text-xs text-muted2">أضف أول مسوّق وشاركه رابط الإحالة</p>
                <button onClick={openAdd} className="mt-4 text-sm text-ink underline">إضافة مسوّق</button>
              </div>
            ) : (
              <div className="space-y-2">
                {marketers.map((m, i) => (
                  <motion.button
                    key={m.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedMarketer(m)}
                    className={`w-full text-right rounded-2xl border bg-panel px-4 py-3.5 transition-all hover:border-line2 hover:bg-panel2 ${selectedMarketer?.id === m.id ? "border-line2 bg-panel2" : "border-line"}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="h-9 w-9 rounded-xl bg-panel2 border border-line flex items-center justify-center shrink-0">
                        <User size={15} className="text-muted" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-ink">{m.name}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${m.is_active ? "border-line2 bg-panel2 text-ink" : "border-slate-600 text-muted"}`}>
                            {m.is_active ? "نشط" : "متوقف"}
                          </span>
                          <span className="font-mono text-xs text-muted2 bg-bg border border-line rounded px-1.5 py-0.5">{m.code}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${m.commission_type === "percent" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-blue-500/30 bg-blue-500/10 text-blue-400"}`}>
                            {m.commission_type === "percent" ? `${m.commission_value}%` : `${m.commission_value} ر.س`}
                          </span>
                          {m.product_name && (
                            <span className="text-xs text-muted2 border border-line rounded-full px-2 py-0.5 flex items-center gap-1">
                              <Package size={9} />{m.product_name}
                            </span>
                          )}
                        </div>
                        {m.phone && <p className="text-xs text-muted2 mt-0.5" dir="ltr">{m.phone}</p>}
                      </div>

                      {/* Stats */}
                      <div className="text-left shrink-0 space-y-0.5">
                        <p className="text-xs text-muted2">{m.sales_count} مبيعة</p>
                        {m.pending_earned > 0 && (
                          <p className="text-xs font-bold text-yellow-400">{m.pending_earned.toFixed(2)} ر.س معلّق</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => copyRef(m.code, e)}
                          className="rounded-lg border border-line p-1.5 text-muted hover:text-blue-400 hover:border-blue-500/30 transition-all"
                          title="نسخ رابط الإحالة"
                        >
                          {copiedCode === m.code ? <Check size={13} className="text-green-400" /> : <Link2 size={13} />}
                        </button>
                        <button
                          onClick={(e) => openEdit(m, e)}
                          className="rounded-lg border border-line p-1.5 text-muted hover:text-ink hover:border-line2 transition-all"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => deleteMarketer(m.id, e)}
                          className="rounded-lg border border-line p-1.5 text-muted hover:text-danger hover:border-danger-border transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <ChevronLeft size={14} className="text-muted2 shrink-0" />
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── WITHDRAWALS TAB ─── */}
        {tab === "withdrawals" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted2">
                <RefreshCw size={18} className="animate-spin ml-2" />جاري التحميل...
              </div>
            ) : withdrawals.length === 0 ? (
              <div className="rounded-2xl border border-line bg-panel p-14 text-center">
                <Wallet size={32} className="mx-auto mb-3 text-muted" />
                <p className="text-muted2">لا توجد طلبات سحب</p>
              </div>
            ) : (
              <div className="space-y-2">
                {withdrawals.map((w, i) => {
                  const statusMap = {
                    pending:  { label: "معلّق",  color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
                    paid:     { label: "مدفوع",  color: "text-ink bg-panel2 border-line2" },
                    rejected: { label: "مرفوض", color: "text-danger bg-danger-bg border-danger-border" },
                  };
                  const s = statusMap[w.status];
                  return (
                    <motion.div
                      key={w.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="rounded-2xl border border-line bg-panel px-4 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-ink">{w.full_name || "—"}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${s.color}`}>{s.label}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${w.method === "wallet" ? "border-purple-500/30 bg-purple-500/10 text-purple-400" : "border-blue-500/30 bg-blue-500/10 text-blue-400"}`}>
                              {w.method === "wallet" ? "محفظة رقمية" : "حساب بنكي"}
                            </span>
                          </div>
                          <p className="text-xs text-muted2 mt-0.5" dir="ltr">{w.phone} · {fmt(w.created_at)}</p>
                        </div>
                        <div className="shrink-0 text-left space-y-0.5">
                          <p className="text-base font-bold text-ink">{Number(w.amount).toFixed(2)} ر.س</p>
                        </div>
                        <div className="shrink-0 flex gap-2">
                          {w.status === "pending" && (
                            <button
                              onClick={() => setActiveWd(w)}
                              className="rounded-xl bg-accent text-accent-fg px-3 py-1.5 text-xs font-semibold hover:bg-panel2 transition-all"
                            >
                              معالجة
                            </button>
                          )}
                          {w.proof_url && (
                            <button
                              onClick={() => setPreviewProof(w.proof_url!)}
                              className="rounded-xl border border-blue-500/30 text-blue-400 px-3 py-1.5 text-xs font-medium hover:bg-blue-500/10 transition-all flex items-center gap-1"
                            >
                              <Eye size={11} />الإيصال
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          MARKETER DETAIL SIDE PANEL
      ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedMarketer && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setSelectedMarketer(null)}
            />
            <motion.div
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-panel border-r border-line shadow-2xl flex flex-col"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedMarketer(null)} className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-panel2 transition-all">
                    <X size={16} />
                  </button>
                  <div>
                    <h2 className="font-bold text-ink">{selectedMarketer.name}</h2>
                    <p className="text-[10px] text-muted2">{selectedMarketer.code}</p>
                  </div>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${selectedMarketer.is_active ? "border-line2 bg-panel2 text-ink" : "border-slate-600 text-muted"}`}>
                  {selectedMarketer.is_active ? "نشط" : "متوقف"}
                </span>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Stats cards */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "مبيعات",   value: String(selectedMarketer.sales_count), color: "text-blue-400" },
                    { label: "معلّق",    value: `${selectedMarketer.pending_earned.toFixed(2)}`, color: "text-yellow-400" },
                    { label: "مدفوع",   value: `${selectedMarketer.paid_earned.toFixed(2)}`, color: "text-green-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border border-line bg-bg p-3 text-center">
                      <p className={`text-sm font-bold ${color}`}>{value}</p>
                      <p className="text-[10px] text-muted2 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Info */}
                <div className="rounded-2xl border border-line bg-bg p-4 space-y-2.5">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">بيانات المسوّق</h3>
                  {selectedMarketer.email && (
                    <div className="flex items-center gap-3">
                      <Mail size={13} className="text-muted2 shrink-0" />
                      <span className="text-sm text-ink" dir="ltr">{selectedMarketer.email}</span>
                    </div>
                  )}
                  {selectedMarketer.phone && (
                    <div className="flex items-center gap-3">
                      <Phone size={13} className="text-muted2 shrink-0" />
                      <span className="text-sm text-ink" dir="ltr">{selectedMarketer.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted2">العمولة</span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-sm font-bold ${selectedMarketer.commission_type === "percent" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-blue-500/30 bg-blue-500/10 text-blue-400"}`}>
                      {selectedMarketer.commission_type === "percent" ? `${selectedMarketer.commission_value}%` : `${selectedMarketer.commission_value} ر.س`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted2">المنتج المشمول</span>
                    <span className="text-sm text-ink">{selectedMarketer.product_name || "جميع المنتجات"}</span>
                  </div>
                  {selectedMarketer.notes && (
                    <div className="pt-2 border-t border-line">
                      <p className="text-xs text-muted2 mb-1">ملاحظات</p>
                      <p className="text-sm text-ink">{selectedMarketer.notes}</p>
                    </div>
                  )}
                </div>

                {/* Referral link */}
                <div className="rounded-2xl border border-line bg-bg p-4">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">رابط الإحالة</h3>
                  <div className="flex items-center gap-2 bg-panel rounded-xl border border-line px-3 py-2.5">
                    <span className="flex-1 text-xs font-mono text-ink/80 truncate" dir="ltr">
                      https://jobbots.org/store?ref={selectedMarketer.code}
                    </span>
                    <button
                      onClick={() => copyRef(selectedMarketer.code)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all shrink-0 ${copiedCode === selectedMarketer.code ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-line2 text-ink hover:bg-bg"}`}
                    >
                      {copiedCode === selectedMarketer.code ? <><Check size={11} />تم النسخ</> : <><Copy size={11} />نسخ</>}
                    </button>
                  </div>
                </div>

                {/* Sales */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">المبيعات ({sales.length})</h3>
                    <button
                      onClick={() => setShowAddSale(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-ink hover:border-line2 transition-all"
                    >
                      <Plus size={11} />
                      إضافة يدوي
                    </button>
                  </div>

                  {salesLoading ? (
                    <div className="flex justify-center py-6 text-muted2">
                      <RefreshCw size={14} className="animate-spin" />
                    </div>
                  ) : sales.length === 0 ? (
                    <div className="rounded-xl border border-line bg-bg p-6 text-center text-xs text-muted2">
                      لا توجد مبيعات مسجّلة بعد
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sales.map(s => (
                        <div key={s.id} className="rounded-xl border border-line bg-bg p-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full border px-2 py-0.5 text-xs ${s.status === "paid" ? "border-line2 bg-panel2 text-ink" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"}`}>
                                {s.status === "paid" ? "مدفوع" : "معلّق"}
                              </span>
                              {s.customer_name && <span className="text-xs text-ink">{s.customer_name}</span>}
                            </div>
                            <p className="text-[10px] text-muted2 mt-0.5">{fmt(s.created_at)}</p>
                          </div>
                          <div className="text-left shrink-0">
                            <p className="text-xs font-bold text-ink">{Number(s.order_amount).toFixed(0)} ر.س</p>
                            <p className="text-[10px] text-yellow-400">عمولة: {Number(s.commission_earned).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer actions */}
              <div className="border-t border-line p-4 shrink-0 space-y-2">
                {selectedMarketer.pending_earned > 0 && (
                  <button
                    onClick={() => markAllPaid(selectedMarketer.id)}
                    disabled={markingPaid}
                    className="w-full rounded-xl border border-green-500/30 py-2.5 text-sm text-green-400 hover:bg-green-500/10 disabled:opacity-50 transition-all font-medium flex items-center justify-center gap-2"
                  >
                    {markingPaid ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    تحديد {selectedMarketer.pending_earned.toFixed(2)} ر.س كمدفوعة
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { setSelectedMarketer(null); openEdit(selectedMarketer); }}
                    className="flex-1 rounded-xl border border-line2 py-2.5 text-sm text-ink hover:bg-panel2 transition-all font-medium flex items-center justify-center gap-2"
                  >
                    <Pencil size={13} />
                    تعديل البيانات
                  </button>
                  <button
                    onClick={(e) => toggleActive(selectedMarketer)}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${selectedMarketer.is_active ? "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10" : "border-line2 text-ink hover:bg-panel2"}`}
                  >
                    {selectedMarketer.is_active ? "إيقاف" : "تفعيل"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          ADD / EDIT MARKETER SIDE PANEL
      ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-panel border-r border-line shadow-2xl flex flex-col"
              dir="rtl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-panel2 transition-all">
                    <X size={16} />
                  </button>
                  <h2 className="font-bold text-ink">{editMarketer ? "تعديل المسوّق" : "إضافة مسوّق جديد"}</h2>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs text-muted mb-1.5">الاسم الكامل *</label>
                  <input
                    value={form.name}
                    onChange={e => {
                      const v = e.target.value;
                      setForm(s => ({ ...s, name: v, ...(!editMarketer && !s.code ? { code: generateCode(v) } : {}) }));
                    }}
                    placeholder="أحمد محمد"
                    className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                  />
                </div>

                {/* Email + Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1.5">البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(s => ({ ...s, email: e.target.value }))}
                      placeholder="ahmed@example.com"
                      className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1.5">رقم الجوال</label>
                    <input
                      value={form.phone}
                      onChange={e => setForm(s => ({ ...s, phone: e.target.value }))}
                      placeholder="+966"
                      className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Referral code */}
                <div>
                  <label className="block text-xs text-muted mb-1.5">كود الإحالة * <span className="text-muted2">(يُستخدم في الرابط)</span></label>
                  <div className="flex gap-2">
                    <input
                      value={form.code}
                      onChange={e => setForm(s => ({ ...s, code: e.target.value.toUpperCase() }))}
                      placeholder="AHMED20"
                      className="flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink font-mono uppercase placeholder:text-muted2 focus:border-line2 focus:outline-none"
                    />
                    <button
                      onClick={() => setForm(s => ({ ...s, code: generateCode(form.name || "REF") }))}
                      className="rounded-xl border border-line px-3 py-2 text-xs text-muted hover:text-ink hover:border-line2 transition-all whitespace-nowrap"
                    >
                      توليد تلقائي
                    </button>
                  </div>
                  {form.code && (
                    <p className="mt-1.5 text-[10px] text-muted2 font-mono">
                      الرابط: https://jobbots.org/store?ref={form.code}
                    </p>
                  )}
                </div>

                {/* Commission */}
                <div>
                  <label className="block text-xs text-muted mb-1.5">نوع العمولة *</label>
                  <div className="flex gap-2 mb-3">
                    {[
                      { v: "percent", label: "نسبة مئوية %", icon: Percent },
                      { v: "fixed",   label: "مبلغ ثابت ر.س",  icon: Banknote },
                    ].map(({ v, label, icon: Icon }) => (
                      <button
                        key={v}
                        onClick={() => setForm(s => ({ ...s, commission_type: v as "percent" | "fixed" }))}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${form.commission_type === v ? "border-line2 bg-panel2 text-ink" : "border-line text-muted hover:text-ink"}`}
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={form.commission_value}
                    onChange={e => setForm(s => ({ ...s, commission_value: e.target.value }))}
                    placeholder={form.commission_type === "percent" ? "10" : "50"}
                    className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-muted2">
                    {form.commission_type === "percent"
                      ? `بيع بـ 100 ر.س → عمولة ${form.commission_value || 0} ر.س`
                      : `عمولة ثابتة ${form.commission_value || 0} ر.س لكل عملية بيع`
                    }
                  </p>
                </div>

                {/* Product */}
                <div>
                  <label className="block text-xs text-muted mb-1.5">المنتج المشمول <span className="text-muted2">(اتركه فارغاً لجميع المنتجات)</span></label>
                  <select
                    value={form.product_id}
                    onChange={e => setForm(s => ({ ...s, product_id: e.target.value }))}
                    className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink focus:border-line2 focus:outline-none"
                  >
                    <option value="">جميع المنتجات</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {p.price} ر.س</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs text-muted mb-1.5">ملاحظات</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(s => ({ ...s, notes: e.target.value }))}
                    placeholder="أي ملاحظات إضافية..."
                    rows={2}
                    className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none resize-none"
                  />
                </div>

                {msg && (
                  <div className={`rounded-xl border px-3 py-2.5 text-sm ${msgType === "ok" ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
                    {msg}
                  </div>
                )}
              </div>

              <div className="border-t border-line p-4 shrink-0 flex gap-2">
                <button
                  onClick={saveMarketer}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-fg py-2.5 text-sm font-semibold hover:bg-panel2 disabled:opacity-50 transition-all"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {editMarketer ? "حفظ التغييرات" : "إضافة المسوّق"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted hover:text-ink hover:border-line2 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Manual Sale Modal */}
      <AnimatePresence>
        {showAddSale && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowAddSale(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-xl"
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-ink">إضافة مبيعة يدوية</h2>
                <button onClick={() => setShowAddSale(false)} className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-panel2">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1">اسم العميل</label>
                    <input value={saleForm.customer_name} onChange={e => setSaleForm(s => ({ ...s, customer_name: e.target.value }))} placeholder="أحمد محمد" className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">مبلغ الطلب (ر.س) *</label>
                    <input type="number" value={saleForm.order_amount} onChange={e => setSaleForm(s => ({ ...s, order_amount: e.target.value }))} placeholder="99" className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">العمولة المستحقة (ر.س)</label>
                  <input type="number" value={saleForm.commission_earned} onChange={e => setSaleForm(s => ({ ...s, commission_earned: e.target.value }))} placeholder={
                    selectedMarketer
                      ? selectedMarketer.commission_type === "percent"
                        ? String(((Number(saleForm.order_amount) || 0) * selectedMarketer.commission_value / 100).toFixed(2))
                        : String(selectedMarketer.commission_value)
                      : "0"
                  } className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">ملاحظات</label>
                  <input value={saleForm.notes} onChange={e => setSaleForm(s => ({ ...s, notes: e.target.value }))} placeholder="أي ملاحظات..." className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none" />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={addSale} disabled={saleSaving} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-fg py-2.5 text-sm font-semibold hover:bg-panel2 disabled:opacity-50 transition-all">
                  {saleSaving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  إضافة
                </button>
                <button onClick={() => setShowAddSale(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink hover:border-line2 transition-all">إلغاء</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdrawal Process Modal */}
      {activeWd && (
        <div
          onClick={() => !uploading && setActiveWd(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-xl" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-ink">معالجة طلب السحب</h2>
              <button onClick={() => setActiveWd(null)} disabled={uploading} className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-panel2">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 mb-5">
              {[
                { label: "المسوّق", value: activeWd.full_name },
                { label: "الجوال", value: activeWd.phone, ltr: true },
                { label: "المبلغ", value: `${Number(activeWd.amount).toFixed(2)} ر.س`, bold: true },
                { label: "طريقة الاستلام", value: activeWd.method === "wallet" ? "محفظة رقمية" : "حساب بنكي" },
                { label: "اسم الحساب", value: activeWd.account_holder },
                ...(activeWd.method === "bank"
                  ? [{ label: "البنك", value: activeWd.bank_name || "—" }, { label: "الآيبان", value: activeWd.iban || "—", ltr: true, mono: true }]
                  : [{ label: "المحفظة", value: activeWd.wallet_provider || "—" }, { label: "الجوال", value: activeWd.wallet_number || "—", ltr: true, mono: true }]),
              ].map(({ label, value, ltr, bold, mono }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-line">
                  <span className="text-xs text-muted2">{label}</span>
                  <span className={`text-sm text-ink ${bold ? "font-bold text-base" : ""} ${mono ? "font-mono" : ""}`} dir={ltr ? "ltr" : undefined}>{value}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-yellow-400/80 mb-4 leading-relaxed">⚠️ بعد تحويل المبلغ يدوياً، ارفع صورة إيصال التحويل لإكمال الطلب.</p>
            <input type="file" accept="image/*" onChange={uploadProof} className="hidden" id="proof-upload" />
            <div className="flex gap-2">
              <button onClick={() => rejectWd(activeWd.id)} disabled={uploading} className="rounded-xl border border-danger-border text-danger px-4 py-2.5 text-sm font-medium hover:bg-danger-bg disabled:opacity-50 transition-all">
                رفض
              </button>
              <label htmlFor="proof-upload" className={`flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-fg py-2.5 text-sm font-semibold cursor-pointer hover:bg-panel2 transition-all ${uploading ? "opacity-50 cursor-wait" : ""}`}>
                {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? "جاري الرفع..." : "رفع إيصال + تأكيد"}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Proof preview */}
      {previewProof && (
        <div onClick={() => setPreviewProof(null)} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 cursor-pointer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewProof} alt="إيصال" className="max-w-full max-h-[90vh] rounded-xl" />
        </div>
      )}
    </Shell>
  );
}
