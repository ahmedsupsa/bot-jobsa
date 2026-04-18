"use client";

import Shell from "@/components/shell";
import { API_BASE } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Package, ClipboardList, Plus, Pencil, Trash2,
  CheckCircle2, XCircle, Clock, RefreshCw, X, Save, Zap
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_days: number;
  streampay_product_id?: string;
  is_active: boolean;
  created_at: string;
};

type Order = {
  id: string;
  user_name?: string;
  user_email?: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  amount?: number;
  notes?: string;
  streampay_payment_link_id?: string;
  streampay_invoice_id?: string;
  streampay_payment_id?: string;
  created_at: string;
  paid_at?: string;
  store_products?: { name: string; price: number; duration_days: number };
};

const EMPTY_PRODUCT = { name: "", description: "", price: "", duration_days: "" };

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "معلّق",   color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: Clock },
  paid:      { label: "مدفوع",   color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle2 },
  failed:    { label: "فشل",     color: "text-red-400 bg-red-400/10 border-red-400/20", icon: XCircle },
  cancelled: { label: "ملغى",    color: "text-slate-400 bg-slate-400/10 border-slate-400/20", icon: XCircle },
};

function Badge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
      <Icon size={11} />
      {s.label}
    </span>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function StoreAdminPage() {
  const [tab, setTab] = useState<"products" | "orders">("products");

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [pLoading, setPLoading] = useState(false);
  const [pMsg, setPMsg] = useState("");
  const [pMsgType, setPMsgType] = useState<"ok" | "err">("ok");
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [pForm, setPForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [oLoading, setOLoading] = useState(false);
  const [oFilter, setOFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [oForm, setOForm] = useState({ user_name: "", user_email: "", product_id: "", amount: "", notes: "" });
  const [oSaving, setOSaving] = useState(false);
  const [oMsg, setOMsg] = useState("");
  const [oMsgType, setOMsgType] = useState<"ok" | "err">("ok");

  const loadProducts = useCallback(async () => {
    setPLoading(true);
    const r = await fetch(`${API_BASE}/api/admin/store/products`, { credentials: "include" });
    const j = await r.json();
    setProducts(j.products || []);
    setPLoading(false);
  }, []);

  const loadOrders = useCallback(async () => {
    setOLoading(true);
    const url = oFilter === "all" ? `${API_BASE}/api/admin/store/orders` : `${API_BASE}/api/admin/store/orders?status=${oFilter}`;
    const r = await fetch(url, { credentials: "include" });
    const j = await r.json();
    setOrders(j.orders || []);
    setOLoading(false);
  }, [oFilter]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { if (tab === "orders") loadOrders(); }, [tab, loadOrders]);

  const openAddProduct = () => {
    setEditProduct(null);
    setPForm(EMPTY_PRODUCT);
    setShowForm(true);
  };

  const openEditProduct = (p: Product) => {
    setEditProduct(p);
    setPForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      duration_days: String(p.duration_days),
    });
    setShowForm(true);
  };

  const saveProduct = async () => {
    if (!pForm.name.trim() || !pForm.price || !pForm.duration_days) {
      setPMsg("الاسم والسعر وعدد الأيام مطلوبة");
      setPMsgType("err");
      return;
    }
    setSaving(true);
    setPMsg("");
    try {
      if (editProduct) {
        const r = await fetch(`${API_BASE}/api/admin/store/products`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editProduct.id, ...pForm }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error);
        setPMsg("تم التحديث ✓"); setPMsgType("ok");
      } else {
        const r = await fetch(`${API_BASE}/api/admin/store/products`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pForm),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error);
        setPMsg("تمت الإضافة ✓"); setPMsgType("ok");
      }
      setShowForm(false);
      await loadProducts();
    } catch (e) {
      setPMsg(String(e)); setPMsgType("err");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("حذف هذا المنتج؟")) return;
    const res = await fetch(`${API_BASE}/api/admin/store/products`, {
      method: "DELETE", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.ok) {
      alert("فشل الحذف: " + (j.error || "خطأ غير معروف"));
    } else if (j.note) {
      alert(j.note);
    }
    await loadProducts();
  };

  const toggleActive = async (p: Product) => {
    await fetch(`${API_BASE}/api/admin/store/products`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
    });
    await loadProducts();
  };

  const updateOrderStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    await fetch(`${API_BASE}/api/admin/store/orders/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdatingId(null);
    await loadOrders();
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("حذف هذا الطلب؟")) return;
    await fetch(`${API_BASE}/api/admin/store/orders/${id}`, {
      method: "DELETE", credentials: "include",
    });
    await loadOrders();
  };

  const addOrder = async () => {
    if (!oForm.product_id) { setOMsg("اختر منتجاً"); setOMsgType("err"); return; }
    setOSaving(true); setOMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/store/orders`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(oForm),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setOMsg("تمت إضافة الطلب ✓"); setOMsgType("ok");
      setShowAddOrder(false);
      setOForm({ user_name: "", user_email: "", product_id: "", amount: "", notes: "" });
      await loadOrders();
    } catch (e) {
      setOMsg(String(e)); setOMsgType("err");
    } finally {
      setOSaving(false);
    }
  };

  const filteredOrders = oFilter === "all" ? orders : orders.filter(o => o.status === oFilter);

  return (
    <Shell>
      <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/15">
              <ShoppingBag size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">المتجر</h1>
              <p className="text-xs text-slate-500">إدارة المنتجات والطلبات</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-line bg-panel p-1 w-fit">
          {[
            { key: "products", label: "المنتجات", icon: Package },
            { key: "orders",   label: "الطلبات",  icon: ClipboardList },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as "products" | "orders")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === key ? "bg-white/10 text-white border border-white/15" : "text-slate-400 hover:text-white"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* ─── PRODUCTS TAB ─── */}
        {tab === "products" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{products.length} منتج</span>
              <button
                onClick={openAddProduct}
                className="flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90 transition-all"
              >
                <Plus size={15} />
                إضافة منتج
              </button>
            </div>

            {pMsg && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${pMsgType === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                {pMsg}
              </div>
            )}

            {pLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-500"><RefreshCw size={18} className="animate-spin ml-2" />جاري التحميل...</div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-line bg-panel p-12 text-center">
                <Package size={32} className="mx-auto mb-3 text-slate-600" />
                <p className="text-slate-500">لا توجد منتجات بعد</p>
                <button onClick={openAddProduct} className="mt-4 text-sm text-white underline">أضف أول منتج</button>
              </div>
            ) : (
              <div className="grid gap-3">
                {products.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-2xl border border-line bg-panel p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-white text-sm">{p.name}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${p.is_active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-slate-600 bg-slate-700/50 text-slate-400"}`}>
                            {p.is_active ? "نشط" : "متوقف"}
                          </span>
                          {p.streampay_product_id ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/5 px-2 py-0.5 text-xs text-blue-400">
                              <Zap size={9} />
                              مرتبط بـ StreamPay
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-700/30 px-2 py-0.5 text-xs text-slate-500">
                              غير مرتبط
                            </span>
                          )}
                        </div>
                        {p.description && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{p.description}</p>}
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="font-bold text-white text-base">{p.price} ر.س</span>
                          <span>مدة: {p.duration_days} يوم</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleActive(p)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs transition-all ${p.is_active ? "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"}`}
                        >
                          {p.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                        <button
                          onClick={() => openEditProduct(p)}
                          className="rounded-lg border border-line p-1.5 text-slate-400 hover:text-white hover:border-white/20 transition-all"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteProduct(p.id)}
                          className="rounded-lg border border-line p-1.5 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Add/Edit Product Modal */}
            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                  onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-xl"
                    dir="rtl"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="font-bold text-white">{editProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</h2>
                      <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">اسم المنتج *</label>
                        <input
                          value={pForm.name}
                          onChange={e => setPForm(s => ({ ...s, name: e.target.value }))}
                          placeholder="مثال: خطة شهرية"
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-white/30 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">الوصف</label>
                        <textarea
                          value={pForm.description}
                          onChange={e => setPForm(s => ({ ...s, description: e.target.value }))}
                          placeholder="وصف مختصر للخطة..."
                          rows={2}
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-white/30 focus:outline-none resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">السعر (ر.س) *</label>
                          <input
                            type="number"
                            value={pForm.price}
                            onChange={e => setPForm(s => ({ ...s, price: e.target.value }))}
                            placeholder="99"
                            className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-white/30 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">المدة (أيام) *</label>
                          <input
                            type="number"
                            value={pForm.duration_days}
                            onChange={e => setPForm(s => ({ ...s, duration_days: e.target.value }))}
                            placeholder="30"
                            className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-white/30 focus:outline-none"
                          />
                        </div>
                      </div>
                      {editProduct?.streampay_product_id ? (
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">StreamPay Product ID</label>
                          <div className="w-full rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400 font-mono flex items-center gap-2" dir="ltr">
                            <CheckCircle2 size={12} className="flex-shrink-0" />
                            <span className="truncate">{editProduct.streampay_product_id}</span>
                          </div>
                        </div>
                      ) : !editProduct ? (
                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 text-xs text-blue-300 flex items-center gap-2">
                          <Zap size={13} className="flex-shrink-0 text-blue-400" />
                          سيتم إنشاء المنتج تلقائياً في StreamPay عند الحفظ
                        </div>
                      ) : null}
                    </div>
                    {pMsg && (
                      <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${pMsgType === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                        {pMsg}
                      </div>
                    )}
                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={saveProduct}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white text-black py-2.5 text-sm font-semibold hover:bg-white/90 disabled:opacity-50 transition-all"
                      >
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        {editProduct ? "حفظ التغييرات" : "إضافة"}
                      </button>
                      <button
                        onClick={() => setShowForm(false)}
                        className="rounded-xl border border-line px-4 py-2.5 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-all"
                      >
                        إلغاء
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ─── ORDERS TAB ─── */}
        {tab === "orders" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Filter bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-1 rounded-xl border border-line bg-panel p-1">
                {[
                  { k: "all",       l: "الكل" },
                  { k: "pending",   l: "معلّق" },
                  { k: "paid",      l: "مدفوع" },
                  { k: "failed",    l: "فشل" },
                  { k: "cancelled", l: "ملغى" },
                ].map(({ k, l }) => (
                  <button
                    key={k}
                    onClick={() => setOFilter(k)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${oFilter === k ? "bg-white/10 text-white border border-white/15" : "text-slate-400 hover:text-white"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadOrders}
                  className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs text-slate-400 hover:text-white transition-all"
                >
                  <RefreshCw size={12} className={oLoading ? "animate-spin" : ""} />
                  تحديث
                </button>
                <button
                  onClick={() => setShowAddOrder(true)}
                  className="flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90 transition-all"
                >
                  <Plus size={15} />
                  طلب يدوي
                </button>
              </div>
            </div>

            {oMsg && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${oMsgType === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                {oMsg}
              </div>
            )}

            {oLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-500"><RefreshCw size={18} className="animate-spin ml-2" />جاري التحميل...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-line bg-panel p-12 text-center">
                <ClipboardList size={32} className="mx-auto mb-3 text-slate-600" />
                <p className="text-slate-500">لا توجد طلبات</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((o, i) => (
                  <motion.div
                    key={o.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-2xl border border-line bg-panel p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Badge status={o.status} />
                          {o.store_products && (
                            <span className="text-xs font-medium text-white bg-white/10 border border-white/10 rounded-full px-2 py-0.5">
                              {o.store_products.name}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-400">
                          {o.user_name && <span>👤 {o.user_name}</span>}
                          {o.user_email && <span>✉️ {o.user_email}</span>}
                          {o.amount && <span className="text-white font-bold">💳 {o.amount} ر.س</span>}
                          <span>🕒 {fmt(o.created_at)}</span>
                          {o.paid_at && <span className="text-emerald-400">✅ {fmt(o.paid_at)}</span>}
                          {o.notes && <span className="col-span-2 text-slate-500 italic">📝 {o.notes}</span>}
                          {o.streampay_invoice_id && (
                            <span className="col-span-2 font-mono text-slate-500 truncate">INV: {o.streampay_invoice_id}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {o.status === "pending" && (
                          <>
                            <button
                              disabled={updatingId === o.id}
                              onClick={() => updateOrderStatus(o.id, "paid")}
                              className="rounded-lg border border-emerald-500/30 px-2.5 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 transition-all"
                            >
                              تأكيد
                            </button>
                            <button
                              disabled={updatingId === o.id}
                              onClick={() => updateOrderStatus(o.id, "cancelled")}
                              className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-500/10 disabled:opacity-50 transition-all"
                            >
                              إلغاء
                            </button>
                          </>
                        )}
                        {o.status === "paid" && (
                          <span className="text-xs text-emerald-400 px-2">مكتمل</span>
                        )}
                        {(o.status === "failed" || o.status === "cancelled") && (
                          <button
                            disabled={updatingId === o.id}
                            onClick={() => updateOrderStatus(o.id, "pending")}
                            className="rounded-lg border border-yellow-500/30 px-2.5 py-1.5 text-xs text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50 transition-all"
                          >
                            إعادة
                          </button>
                        )}
                        <button
                          onClick={() => deleteOrder(o.id)}
                          className="rounded-lg border border-line p-1.5 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Add Manual Order Modal */}
            <AnimatePresence>
              {showAddOrder && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                  onClick={e => { if (e.target === e.currentTarget) setShowAddOrder(false); }}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-xl"
                    dir="rtl"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="font-bold text-white">إضافة طلب يدوي</h2>
                      <button onClick={() => setShowAddOrder(false)} className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">المنتج *</label>
                        <select
                          value={oForm.product_id}
                          onChange={e => setOForm(s => ({ ...s, product_id: e.target.value }))}
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                        >
                          <option value="">-- اختر منتجاً --</option>
                          {products.filter(p => p.is_active).map(p => (
                            <option key={p.id} value={p.id}>{p.name} — {p.price} ر.س</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">اسم العميل</label>
                          <input
                            value={oForm.user_name}
                            onChange={e => setOForm(s => ({ ...s, user_name: e.target.value }))}
                            placeholder="أحمد محمد"
                            className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-white/30 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">المبلغ (ر.س)</label>
                          <input
                            type="number"
                            value={oForm.amount}
                            onChange={e => setOForm(s => ({ ...s, amount: e.target.value }))}
                            placeholder="99"
                            className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-white/30 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">البريد الإلكتروني</label>
                        <input
                          type="email"
                          value={oForm.user_email}
                          onChange={e => setOForm(s => ({ ...s, user_email: e.target.value }))}
                          placeholder="user@example.com"
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-white/30 focus:outline-none"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">ملاحظات</label>
                        <input
                          value={oForm.notes}
                          onChange={e => setOForm(s => ({ ...s, notes: e.target.value }))}
                          placeholder="أي ملاحظات إضافية..."
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-white/30 focus:outline-none"
                        />
                      </div>
                    </div>
                    {oMsg && (
                      <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${oMsgType === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                        {oMsg}
                      </div>
                    )}
                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={addOrder}
                        disabled={oSaving}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white text-black py-2.5 text-sm font-semibold hover:bg-white/90 disabled:opacity-50 transition-all"
                      >
                        {oSaving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                        إضافة الطلب
                      </button>
                      <button
                        onClick={() => setShowAddOrder(false)}
                        className="rounded-xl border border-line px-4 py-2.5 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-all"
                      >
                        إلغاء
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </Shell>
  );
}
