"use client";

import Shell from "@/components/shell";
import { API_BASE } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Package, ClipboardList, Plus, Pencil, Trash2,
  CheckCircle2, XCircle, Clock, RefreshCw, X, Save, Zap,
  Building2, Wallet, Copy, CheckCheck, Tag, Percent, DollarSign,
  Image as ImageIcon, Upload, Eye, EyeOff,
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
  user_phone?: string;
  status: "pending" | "awaiting_payment" | "paid" | "failed" | "cancelled";
  amount?: number;
  notes?: string;
  streampay_payment_link_id?: string;
  streampay_invoice_id?: string;
  streampay_payment_id?: string;
  payment_gateway?: string;
  receipt_url?: string;
  created_at: string;
  paid_at?: string;
  store_products?: { name: string; price: number; duration_days: number };
};

type BankAccount = {
  id: string;
  type: "bank" | "wallet";
  name: string;
  account_number?: string | null;
  iban?: string | null;
  phone?: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

const EMPTY_PRODUCT = { name: "", description: "", price: "", duration_days: "" };

const EMPTY_BANK = { type: "bank", name: "", account_number: "", iban: "", phone: "", display_order: "0" };

const EMPTY_DISCOUNT = {
  code: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value: "",
  product_ids: [] as string[],
  gateways: [] as string[],
  usage_limit: "",
  expires_at: "",
};

const GATEWAY_OPTIONS: { v: "tamara" | "streampay" | "bank_transfer"; label: string }[] = [
  { v: "tamara",        label: "تمارا" },
  { v: "streampay",     label: "بطاقة (StreamPay)" },
  { v: "bank_transfer", label: "تحويل بنكي" },
];

type DiscountCode = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  product_id: string | null;
  usage_limit: number | null;
  usage_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  applies_to_all_products?: boolean;
  applies_to_all_gateways?: boolean;
  store_products?: { name: string } | null;
  products?: { id: string; name: string }[];
  gateways?: string[];
  sales?: { paid_orders: number; revenue: number; total_discount: number };
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:           { label: "بانتظار التأكيد", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: Clock },
  awaiting_payment:  { label: "لم يكمل الدفع",   color: "text-muted bg-slate-400/10 border-slate-400/20", icon: Clock },
  paid:              { label: "مدفوع",            color: "text-ink bg-panel2 border-line2", icon: CheckCircle2 },
  failed:            { label: "فشل",              color: "text-danger bg-danger-bg border-danger-border", icon: XCircle },
  cancelled:         { label: "ملغى",             color: "text-muted bg-slate-400/10 border-slate-400/20", icon: XCircle },
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
  const [tab, setTab] = useState<"products" | "orders" | "banks" | "discounts" | "settings">("products");

  // Store settings (banner)
  const [settings, setSettings] = useState<{ banner_enabled: boolean; banner_text: string | null; banner_image_url: string | null }>({
    banner_enabled: false, banner_text: "", banner_image_url: "",
  });
  const [stLoading, setStLoading] = useState(false);
  const [stSaving, setStSaving] = useState(false);
  const [stMsg, setStMsg] = useState("");
  const [stMsgType, setStMsgType] = useState<"ok" | "err">("ok");
  const [bannerUploading, setBannerUploading] = useState(false);

  const loadSettings = useCallback(async () => {
    setStLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/store/settings`, { credentials: "include" });
      const j = await r.json();
      if (j.ok && j.settings) {
        setSettings({
          banner_enabled: !!j.settings.banner_enabled,
          banner_text: j.settings.banner_text || "",
          banner_image_url: j.settings.banner_image_url || "",
        });
      }
    } catch {}
    setStLoading(false);
  }, []);

  const saveSettings = async () => {
    setStSaving(true); setStMsg("");
    try {
      const hasContent = !!(settings.banner_image_url || (settings.banner_text && settings.banner_text.trim()));
      const payload = { ...settings, banner_enabled: hasContent ? settings.banner_enabled : false };
      const r = await fetch(`${API_BASE}/api/admin/store/settings`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الحفظ");
      setStMsg(payload.banner_enabled ? "تم الحفظ ✓ — البنر يظهر الآن في صفحة المتجر" : "تم الحفظ ✓"); setStMsgType("ok");
    } catch (e) {
      setStMsg(String(e).replace("Error: ", "")); setStMsgType("err");
    }
    setStSaving(false);
  };

  const uploadBanner = async (file: File) => {
    setBannerUploading(true); setStMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API_BASE}/api/admin/store/settings/banner`, {
        method: "POST", credentials: "include", body: fd,
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الرفع");

      // Persist immediately — auto-enable + save to DB so banner appears in store right away
      const newSettings = { ...settings, banner_image_url: j.url, banner_enabled: true };
      setSettings(newSettings);

      const sr = await fetch(`${API_BASE}/api/admin/store/settings`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          banner_image_url: j.url,
          banner_enabled: true,
          banner_text: newSettings.banner_text || null,
        }),
      });
      const sj = await sr.json();
      if (!sj.ok) throw new Error(sj.error || "تم الرفع لكن فشل الحفظ");

      setStMsg("تم الحفظ والتفعيل ✓ — البنر يظهر الآن في صفحة المتجر"); setStMsgType("ok");
    } catch (e) {
      setStMsg(String(e).replace("Error: ", "")); setStMsgType("err");
    }
    setBannerUploading(false);
  };

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

  // Bank accounts state
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [bMsg, setBMsg] = useState("");
  const [bMsgType, setBMsgType] = useState<"ok" | "err">("ok");
  const [showBankForm, setShowBankForm] = useState(false);
  const [bForm, setBForm] = useState(EMPTY_BANK);
  const [bSaving, setBSaving] = useState(false);
  const [bDeletingId, setBDeletingId] = useState<string | null>(null);

  const loadBanks = useCallback(async () => {
    setBLoading(true);
    const r = await fetch(`${API_BASE}/api/admin/bank-accounts`, { credentials: "include" });
    const j = await r.json();
    setBanks(j.accounts || []);
    setBLoading(false);
  }, []);

  const saveBank = async () => {
    setBSaving(true); setBMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/bank-accounts`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bForm),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الحفظ");
      setBMsg("تمت الإضافة"); setBMsgType("ok");
      setShowBankForm(false); setBForm(EMPTY_BANK);
      loadBanks();
    } catch (e) {
      setBMsg(String(e).replace("Error: ", "")); setBMsgType("err");
    }
    setBSaving(false);
  };

  const deleteBank = async (id: string) => {
    if (!confirm("حذف هذا الحساب؟")) return;
    setBDeletingId(id);
    const r = await fetch(`${API_BASE}/api/admin/bank-accounts/${id}`, { method: "DELETE", credentials: "include" });
    const j = await r.json();
    if (j.ok) loadBanks();
    else { setBMsg("فشل الحذف"); setBMsgType("err"); }
    setBDeletingId(null);
  };

  const toggleBankActive = async (acc: BankAccount) => {
    await fetch(`${API_BASE}/api/admin/bank-accounts/${acc.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !acc.is_active }),
    });
    loadBanks();
  };

  // ─── Discount codes state ────────────────────────────────────────────────
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [dLoading, setDLoading] = useState(false);
  const [dMsg, setDMsg] = useState("");
  const [dMsgType, setDMsgType] = useState<"ok" | "err">("ok");
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [dForm, setDForm] = useState(EMPTY_DISCOUNT);
  const [dSaving, setDSaving] = useState(false);
  const [dDeletingId, setDDeletingId] = useState<string | null>(null);

  const loadDiscounts = useCallback(async () => {
    setDLoading(true);
    const r = await fetch(`${API_BASE}/api/admin/store/discount-codes`, { credentials: "include" });
    const j = await r.json();
    setDiscounts(j.codes || []);
    setDLoading(false);
  }, []);

  const saveDiscount = async () => {
    if (!dForm.code.trim() || !dForm.discount_value) {
      setDMsg("الكود وقيمة الخصم مطلوبة"); setDMsgType("err"); return;
    }
    setDSaving(true); setDMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/store/discount-codes`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: dForm.code.trim().toUpperCase(),
          discount_type: dForm.discount_type,
          discount_value: dForm.discount_value,
          product_ids: dForm.product_ids,
          gateways: dForm.gateways,
          usage_limit: dForm.usage_limit || null,
          expires_at: dForm.expires_at || null,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الحفظ");
      setDMsg("تمت إضافة الكود ✓"); setDMsgType("ok");
      setShowDiscountForm(false); setDForm(EMPTY_DISCOUNT);
      await loadDiscounts();
    } catch (e) {
      setDMsg(String(e).replace("Error: ", "")); setDMsgType("err");
    }
    setDSaving(false);
  };

  const toggleDiscountActive = async (d: DiscountCode) => {
    await fetch(`${API_BASE}/api/admin/store/discount-codes/${d.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !d.is_active }),
    });
    await loadDiscounts();
  };

  const deleteDiscount = async (id: string) => {
    if (!confirm("حذف هذا الكود؟")) return;
    setDDeletingId(id);
    const r = await fetch(`${API_BASE}/api/admin/store/discount-codes/${id}`, {
      method: "DELETE", credentials: "include",
    });
    const j = await r.json();
    if (j.ok) await loadDiscounts();
    else { setDMsg("فشل الحذف"); setDMsgType("err"); }
    setDDeletingId(null);
  };

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => {
    if (tab === "orders") {
      loadOrders();
      // Mark new-orders badge as seen
      fetch("/api/admin/store/orders/mark-seen", { method: "POST", credentials: "include" }).catch(() => {});
    }
  }, [tab, loadOrders]);
  useEffect(() => { if (tab === "banks") loadBanks(); }, [tab, loadBanks]);
  useEffect(() => { if (tab === "discounts") loadDiscounts(); }, [tab, loadDiscounts]);
  useEffect(() => { if (tab === "settings") loadSettings(); }, [tab, loadSettings]);

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
    const r = await fetch(`${API_BASE}/api/admin/store/orders/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const j = await r.json().catch(() => ({}));
    setUpdatingId(null);
    await loadOrders();

    if (status === "paid") {
      if (j.email_sent) {
        setOMsg(j.is_new
          ? "✅ تم تفعيل الحساب وإرسال كود التفعيل على البريد الإلكتروني"
          : "✅ تم تجديد الاشتراك وإرسال إيميل التأكيد"
        );
      } else {
        setOMsg("✅ تم تأكيد الطلب (لم يُرسَل إيميل — تحقق من إعدادات Resend)");
      }
      setOMsgType("ok");
      setTimeout(() => setOMsg(""), 5000);
    }
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel2 border border-line2">
              <ShoppingBag size={20} className="text-ink" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink">المتجر</h1>
              <p className="text-xs text-muted2">إدارة المنتجات والطلبات</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-line bg-panel p-1 w-fit flex-wrap">
          {[
            { key: "products",  label: "المنتجات",        icon: Package },
            { key: "orders",    label: "الطلبات",          icon: ClipboardList },
            { key: "banks",     label: "الحسابات البنكية", icon: Building2 },
            { key: "discounts", label: "أكواد الخصم",      icon: Tag },
            { key: "settings",  label: "البنر",            icon: ImageIcon },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as "products" | "orders" | "banks" | "discounts" | "settings")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === key ? "bg-panel2 text-ink border border-line2" : "text-muted hover:text-ink"
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
              <span className="text-sm text-muted">{products.length} منتج</span>
              <button
                onClick={openAddProduct}
                className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-4 py-2 text-sm font-semibold hover:bg-panel2 transition-all"
              >
                <Plus size={15} />
                إضافة منتج
              </button>
            </div>

            {pMsg && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${pMsgType === "ok" ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
                {pMsg}
              </div>
            )}

            {pLoading ? (
              <div className="flex items-center justify-center py-16 text-muted2"><RefreshCw size={18} className="animate-spin ml-2" />جاري التحميل...</div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-line bg-panel p-12 text-center">
                <Package size={32} className="mx-auto mb-3 text-muted" />
                <p className="text-muted2">لا توجد منتجات بعد</p>
                <button onClick={openAddProduct} className="mt-4 text-sm text-ink underline">أضف أول منتج</button>
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
                          <span className="font-semibold text-ink text-sm">{p.name}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${p.is_active ? "border-line2 bg-panel2 text-ink" : "border-slate-600 bg-slate-700/50 text-muted"}`}>
                            {p.is_active ? "نشط" : "متوقف"}
                          </span>
                          {p.streampay_product_id ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/5 px-2 py-0.5 text-xs text-blue-400">
                              <Zap size={9} />
                              مرتبط بـ StreamPay
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-700/30 px-2 py-0.5 text-xs text-muted2">
                              غير مرتبط
                            </span>
                          )}
                        </div>
                        {p.description && <p className="text-xs text-muted2 mb-2 line-clamp-2">{p.description}</p>}
                        <div className="flex items-center gap-4 text-xs text-muted">
                          <span className="font-bold text-ink text-base">{p.price} ر.س</span>
                          <span>مدة: {p.duration_days} يوم</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleActive(p)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs transition-all ${p.is_active ? "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10" : "border-line2 text-ink hover:bg-panel2"}`}
                        >
                          {p.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                        <button
                          onClick={() => openEditProduct(p)}
                          className="rounded-lg border border-line p-1.5 text-muted hover:text-ink hover:border-line2 transition-all"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteProduct(p.id)}
                          className="rounded-lg border border-line p-1.5 text-muted hover:text-danger hover:border-danger-border transition-all"
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
                  className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--input-bg)]/60 backdrop-blur-sm p-4"
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
                      <h2 className="font-bold text-ink">{editProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</h2>
                      <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-panel2 transition-all">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-muted mb-1">اسم المنتج *</label>
                        <input
                          value={pForm.name}
                          onChange={e => setPForm(s => ({ ...s, name: e.target.value }))}
                          placeholder="مثال: خطة شهرية"
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">الوصف</label>
                        <textarea
                          value={pForm.description}
                          onChange={e => setPForm(s => ({ ...s, description: e.target.value }))}
                          placeholder="وصف مختصر للخطة..."
                          rows={2}
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted mb-1">السعر (ر.س) *</label>
                          <input
                            type="number"
                            value={pForm.price}
                            onChange={e => setPForm(s => ({ ...s, price: e.target.value }))}
                            placeholder="99"
                            className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted mb-1">المدة (أيام) *</label>
                          <input
                            type="number"
                            value={pForm.duration_days}
                            onChange={e => setPForm(s => ({ ...s, duration_days: e.target.value }))}
                            placeholder="30"
                            className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                          />
                        </div>
                      </div>
                      {editProduct?.streampay_product_id ? (
                        <div>
                          <label className="block text-xs text-muted mb-1">StreamPay Product ID</label>
                          <div className="w-full rounded-xl border border-line2 bg-panel2 px-3 py-2 text-xs text-ink/80 font-mono flex items-center gap-2" dir="ltr">
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
                      <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${pMsgType === "ok" ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
                        {pMsg}
                      </div>
                    )}
                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={saveProduct}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-fg py-2.5 text-sm font-semibold hover:bg-panel2 disabled:opacity-50 transition-all"
                      >
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        {editProduct ? "حفظ التغييرات" : "إضافة"}
                      </button>
                      <button
                        onClick={() => setShowForm(false)}
                        className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink hover:border-line2 transition-all"
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
                  { k: "all",              l: "الكل" },
                  { k: "pending",          l: "بانتظار التأكيد" },
                  { k: "awaiting_payment", l: "لم يكمل الدفع" },
                  { k: "paid",             l: "مدفوع" },
                  { k: "failed",           l: "فشل" },
                  { k: "cancelled",        l: "ملغى" },
                ].map(({ k, l }) => (
                  <button
                    key={k}
                    onClick={() => setOFilter(k)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${oFilter === k ? "bg-panel2 text-ink border border-line2" : "text-muted hover:text-ink"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadOrders}
                  className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs text-muted hover:text-ink transition-all"
                >
                  <RefreshCw size={12} className={oLoading ? "animate-spin" : ""} />
                  تحديث
                </button>
                <button
                  onClick={() => setShowAddOrder(true)}
                  className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-4 py-2 text-sm font-semibold hover:bg-panel2 transition-all"
                >
                  <Plus size={15} />
                  طلب يدوي
                </button>
              </div>
            </div>

            {oMsg && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${oMsgType === "ok" ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
                {oMsg}
              </div>
            )}

            {oLoading ? (
              <div className="flex items-center justify-center py-16 text-muted2"><RefreshCw size={18} className="animate-spin ml-2" />جاري التحميل...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-line bg-panel p-12 text-center">
                <ClipboardList size={32} className="mx-auto mb-3 text-muted" />
                <p className="text-muted2">لا توجد طلبات</p>
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
                            <span className="text-xs font-medium text-ink bg-panel2 border border-line rounded-full px-2 py-0.5">
                              {o.store_products.name}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted">
                          {o.user_name && <span>👤 {o.user_name}</span>}
                          {o.user_email && <span dir="ltr" className="text-right">✉️ {o.user_email}</span>}
                          {o.user_phone && <span dir="ltr" className="text-right">📞 {o.user_phone}</span>}
                          {o.amount && <span className="text-ink font-bold">💳 {o.amount} ر.س</span>}
                          <span>🕒 {fmt(o.created_at)}</span>
                          {o.paid_at && <span className="text-ink/80">✅ {fmt(o.paid_at)}</span>}
                          {o.notes && <span className="col-span-2 text-muted2 italic">📝 {o.notes}</span>}
                          {o.streampay_invoice_id && (
                            <span className="col-span-2 font-mono text-muted2 truncate">INV: {o.streampay_invoice_id}</span>
                          )}
                          {o.payment_gateway === "bank_transfer" && (
                            <span className="col-span-2 inline-flex w-fit items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-ink">
                              🏦 طريقة الدفع: تحويل بنكي
                            </span>
                          )}
                          {o.payment_gateway === "tamara" && (
                            <span className="col-span-2 inline-flex w-fit items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-0.5 text-xs font-semibold text-ink">
                              <img src="/payment-logos/tamara.png" alt="Tamara" className="h-4 w-auto" />
                              طريقة الدفع: تمارا (تقسيط)
                            </span>
                          )}
                          {o.payment_gateway === "streampay" && (
                            <span className="col-span-2 inline-flex w-fit items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-ink">
                              💳 طريقة الدفع: بطاقة (Mada / Visa / Mastercard)
                            </span>
                          )}
                          {!o.payment_gateway && (
                            <span className="col-span-2 inline-flex w-fit items-center gap-1 rounded-full border border-line bg-panel2 px-2.5 py-0.5 text-xs text-muted">
                              طريقة الدفع: غير محددة
                            </span>
                          )}
                        </div>
                        {/* Receipt */}
                        {o.receipt_url && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-muted2">الإيصال:</span>
                            <a
                              href={o.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-line2 bg-accent/8 px-3 py-1 text-xs text-ink hover:bg-accent/15 transition-all"
                            >
                              عرض الإيصال ↗
                            </a>
                            {/\.(jpe?g|png|webp|gif)$/i.test(o.receipt_url) && (
                              <a href={o.receipt_url} target="_blank" rel="noopener noreferrer" className="block mt-1 shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={o.receipt_url} alt="إيصال" className="h-12 w-16 rounded-lg object-cover border border-line" />
                              </a>
                            )}
                          </div>
                        )}
                        {o.payment_gateway === "bank_transfer" && !o.receipt_url && o.status === "pending" && (
                          <div className="mt-2 rounded-lg border border-yellow-500/15 bg-yellow-500/5 px-3 py-1.5 text-xs text-yellow-500/80">
                            لم يُرفع إيصال التحويل بعد
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {o.status === "pending" && (
                          <>
                            <button
                              disabled={updatingId === o.id}
                              onClick={() => updateOrderStatus(o.id, "paid")}
                              className="rounded-lg border border-line2 px-2.5 py-1.5 text-xs text-ink hover:bg-panel2 disabled:opacity-50 transition-all"
                            >
                              تأكيد
                            </button>
                            <button
                              disabled={updatingId === o.id}
                              onClick={() => updateOrderStatus(o.id, "cancelled")}
                              className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-muted hover:bg-slate-500/10 disabled:opacity-50 transition-all"
                            >
                              إلغاء
                            </button>
                          </>
                        )}
                        {o.status === "paid" && (
                          <span className="text-xs text-ink/80 px-2">مكتمل</span>
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
                          className="rounded-lg border border-line p-1.5 text-muted hover:text-danger hover:border-danger-border transition-all"
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
                  className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--input-bg)]/60 backdrop-blur-sm p-4"
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
                      <h2 className="font-bold text-ink">إضافة طلب يدوي</h2>
                      <button onClick={() => setShowAddOrder(false)} className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-panel2">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-muted mb-1">المنتج *</label>
                        <select
                          value={oForm.product_id}
                          onChange={e => setOForm(s => ({ ...s, product_id: e.target.value }))}
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-line2 focus:outline-none"
                        >
                          <option value="">-- اختر منتجاً --</option>
                          {products.filter(p => p.is_active).map(p => (
                            <option key={p.id} value={p.id}>{p.name} — {p.price} ر.س</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted mb-1">اسم العميل</label>
                          <input
                            value={oForm.user_name}
                            onChange={e => setOForm(s => ({ ...s, user_name: e.target.value }))}
                            placeholder="أحمد محمد"
                            className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted mb-1">المبلغ (ر.س)</label>
                          <input
                            type="number"
                            value={oForm.amount}
                            onChange={e => setOForm(s => ({ ...s, amount: e.target.value }))}
                            placeholder="99"
                            className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">البريد الإلكتروني</label>
                        <input
                          type="email"
                          value={oForm.user_email}
                          onChange={e => setOForm(s => ({ ...s, user_email: e.target.value }))}
                          placeholder="user@example.com"
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">ملاحظات</label>
                        <input
                          value={oForm.notes}
                          onChange={e => setOForm(s => ({ ...s, notes: e.target.value }))}
                          placeholder="أي ملاحظات إضافية..."
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                        />
                      </div>
                    </div>
                    {oMsg && (
                      <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${oMsgType === "ok" ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
                        {oMsg}
                      </div>
                    )}
                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={addOrder}
                        disabled={oSaving}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-fg py-2.5 text-sm font-semibold hover:bg-panel2 disabled:opacity-50 transition-all"
                      >
                        {oSaving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                        إضافة الطلب
                      </button>
                      <button
                        onClick={() => setShowAddOrder(false)}
                        className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink hover:border-line2 transition-all"
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

        {/* ─── BANKS TAB ─── */}
        {tab === "banks" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{banks.length} حساب</span>
              <button
                onClick={() => { setBForm(EMPTY_BANK); setShowBankForm(true); setBMsg(""); }}
                className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-4 py-2 text-sm font-semibold hover:bg-panel2 transition-all"
              >
                <Plus size={15} />
                إضافة حساب
              </button>
            </div>

            {bMsg && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${bMsgType === "ok" ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
                {bMsg}
              </div>
            )}

            {/* Add form */}
            <AnimatePresence>
              {showBankForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <motion.div className="rounded-2xl border border-line bg-panel p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-ink text-sm">إضافة حساب جديد</h3>
                      <button onClick={() => setShowBankForm(false)} className="text-muted2 hover:text-ink"><X size={16} /></button>
                    </div>

                    {/* Type selector */}
                    <div className="flex gap-2">
                      {[{ v: "bank", label: "بنك", icon: Building2 }, { v: "wallet", label: "محفظة", icon: Wallet }].map(({ v, label, icon: Icon }) => (
                        <button
                          key={v}
                          onClick={() => setBForm(f => ({ ...f, type: v }))}
                          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${bForm.type === v ? "border-line2 bg-panel2 text-ink" : "border-line text-muted hover:text-ink"}`}
                        >
                          <Icon size={14} />
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-muted mb-1.5">الاسم *</label>
                        <input
                          className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-line2"
                          placeholder={bForm.type === "bank" ? "مثال: بنك الراجحي" : "مثال: STC Pay"}
                          value={bForm.name}
                          onChange={e => setBForm(f => ({ ...f, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1.5">رقم الحساب</label>
                        <input
                          className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-line2 ltr text-right"
                          placeholder="SA..."
                          value={bForm.account_number}
                          onChange={e => setBForm(f => ({ ...f, account_number: e.target.value }))}
                        />
                      </div>
                      {bForm.type === "bank" && (
                        <div>
                          <label className="block text-xs text-muted mb-1.5">الآيبان (IBAN)</label>
                          <input
                            className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-line2 ltr text-right"
                            placeholder="SA0000000000000000000000"
                            value={bForm.iban}
                            onChange={e => setBForm(f => ({ ...f, iban: e.target.value }))}
                          />
                        </div>
                      )}
                      {bForm.type === "wallet" && (
                        <div>
                          <label className="block text-xs text-muted mb-1.5">رقم الجوال</label>
                          <input
                            type="tel"
                            className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-line2 ltr text-right"
                            placeholder="+966"
                            value={bForm.phone}
                            onChange={e => setBForm(f => ({ ...f, phone: e.target.value }))}
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs text-muted mb-1.5">الترتيب</label>
                        <input
                          type="number"
                          className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-line2"
                          placeholder="0"
                          value={bForm.display_order}
                          onChange={e => setBForm(f => ({ ...f, display_order: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={saveBank}
                        disabled={bSaving}
                        className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-4 py-2.5 text-sm font-semibold hover:bg-panel2 disabled:opacity-50 transition-all"
                      >
                        {bSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        حفظ
                      </button>
                      <button
                        onClick={() => setShowBankForm(false)}
                        className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink hover:border-line2 transition-all"
                      >
                        إلغاء
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {bLoading ? (
              <div className="flex items-center justify-center py-16 text-muted2">
                <RefreshCw size={18} className="animate-spin ml-2" />جاري التحميل...
              </div>
            ) : banks.length === 0 ? (
              <div className="rounded-2xl border border-line bg-panel p-12 text-center">
                <Building2 size={32} className="mx-auto mb-3 text-muted" />
                <p className="text-muted2">لا توجد حسابات بنكية بعد</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {banks.map((acc, i) => (
                  <motion.div
                    key={acc.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-2xl border border-line bg-panel p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-panel2 shrink-0">
                          {acc.type === "bank" ? <Building2 size={16} className="text-ink" /> : <Wallet size={16} className="text-ink" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="font-semibold text-ink text-sm">{acc.name}</span>
                            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                              {acc.type === "bank" ? "بنك" : "محفظة"}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${acc.is_active ? "border-line2 bg-panel2 text-ink" : "border-slate-700 text-muted2"}`}>
                              {acc.is_active ? "نشط" : "متوقف"}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {acc.account_number && (
                              <div className="text-xs text-muted">رقم الحساب: <span className="text-ink2 font-mono">{acc.account_number}</span></div>
                            )}
                            {acc.iban && (
                              <div className="text-xs text-muted">الآيبان: <span className="text-ink2 font-mono">{acc.iban}</span></div>
                            )}
                            {acc.phone && (
                              <div className="text-xs text-muted">الجوال: <span className="text-ink2 font-mono">{acc.phone}</span></div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleBankActive(acc)}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-ink hover:border-line2 transition-all"
                        >
                          {acc.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                        <button
                          onClick={() => deleteBank(acc.id)}
                          disabled={bDeletingId === acc.id}
                          className="rounded-lg border border-danger-border px-3 py-1.5 text-xs text-danger hover:bg-danger-bg transition-all disabled:opacity-50"
                        >
                          {bDeletingId === acc.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── DISCOUNT CODES TAB ─── */}
        {tab === "discounts" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{discounts.length} كود</span>
              <button
                onClick={() => { setDForm(EMPTY_DISCOUNT); setShowDiscountForm(true); setDMsg(""); }}
                className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-4 py-2 text-sm font-semibold hover:bg-panel2 transition-all"
              >
                <Plus size={15} />
                إضافة كود
              </button>
            </div>

            {dMsg && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${dMsgType === "ok" ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
                {dMsg}
              </div>
            )}

            {/* Add form */}
            <AnimatePresence>
              {showDiscountForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <motion.div className="rounded-2xl border border-line bg-panel p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-ink text-sm">إضافة كود خصم</h3>
                      <button onClick={() => setShowDiscountForm(false)} className="text-muted2 hover:text-ink"><X size={16} /></button>
                    </div>

                    {/* Type selector */}
                    <div className="flex gap-2">
                      {[
                        { v: "percent" as const, label: "نسبة %", icon: Percent },
                        { v: "fixed"   as const, label: "مبلغ ثابت", icon: DollarSign },
                      ].map(({ v, label, icon: Icon }) => (
                        <button
                          key={v}
                          onClick={() => setDForm(f => ({ ...f, discount_type: v }))}
                          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${dForm.discount_type === v ? "border-line2 bg-panel2 text-ink" : "border-line text-muted hover:text-ink"}`}
                        >
                          <Icon size={14} />
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted mb-1.5">الكود *</label>
                        <input
                          className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-line2 uppercase"
                          placeholder="WELCOME10"
                          value={dForm.code}
                          onChange={e => setDForm(f => ({ ...f, code: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1.5">
                          {dForm.discount_type === "percent" ? "النسبة (%) *" : "المبلغ (ر.س) *"}
                        </label>
                        <input
                          type="number"
                          className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-line2"
                          placeholder={dForm.discount_type === "percent" ? "10" : "20"}
                          value={dForm.discount_value}
                          onChange={e => setDForm(f => ({ ...f, discount_value: e.target.value }))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-muted mb-1.5">المنتجات المسموحة (اتركه فاضي = كل المنتجات)</label>
                        <div className="flex flex-wrap gap-2">
                          {products.filter(p => p.is_active).map(p => {
                            const checked = dForm.product_ids.includes(p.id);
                            return (
                              <button type="button" key={p.id}
                                onClick={() => setDForm(f => ({
                                  ...f,
                                  product_ids: checked
                                    ? f.product_ids.filter(x => x !== p.id)
                                    : [...f.product_ids, p.id],
                                }))}
                                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${checked ? "border-line2 bg-panel2 text-ink" : "border-line text-muted hover:text-ink"}`}
                              >
                                {checked ? "✓ " : ""}{p.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-muted mb-1.5">طرق الدفع المسموحة (اتركه فاضي = كل الطرق)</label>
                        <div className="flex flex-wrap gap-2">
                          {GATEWAY_OPTIONS.map(g => {
                            const checked = dForm.gateways.includes(g.v);
                            return (
                              <button type="button" key={g.v}
                                onClick={() => setDForm(f => ({
                                  ...f,
                                  gateways: checked
                                    ? f.gateways.filter(x => x !== g.v)
                                    : [...f.gateways, g.v],
                                }))}
                                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${checked ? "border-line2 bg-panel2 text-ink" : "border-line text-muted hover:text-ink"}`}
                              >
                                {checked ? "✓ " : ""}{g.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1.5">حد الاستخدام (اختياري)</label>
                        <input
                          type="number"
                          className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-line2"
                          placeholder="بدون حد"
                          value={dForm.usage_limit}
                          onChange={e => setDForm(f => ({ ...f, usage_limit: e.target.value }))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-muted mb-1.5">تاريخ الانتهاء (اختياري)</label>
                        <input
                          type="datetime-local"
                          className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-line2"
                          value={dForm.expires_at}
                          onChange={e => setDForm(f => ({ ...f, expires_at: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={saveDiscount}
                        disabled={dSaving}
                        className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-4 py-2.5 text-sm font-semibold hover:bg-panel2 disabled:opacity-50 transition-all"
                      >
                        {dSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        حفظ
                      </button>
                      <button
                        onClick={() => setShowDiscountForm(false)}
                        className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink hover:border-line2 transition-all"
                      >
                        إلغاء
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {dLoading ? (
              <div className="flex items-center justify-center py-16 text-muted2">
                <RefreshCw size={18} className="animate-spin ml-2" />جاري التحميل...
              </div>
            ) : discounts.length === 0 ? (
              <div className="rounded-2xl border border-line bg-panel p-12 text-center">
                <Tag size={32} className="mx-auto mb-3 text-muted" />
                <p className="text-muted2">لا توجد أكواد خصم بعد</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {discounts.map((d, i) => {
                  const expired = d.expires_at && new Date(d.expires_at).getTime() < Date.now();
                  const exhausted = d.usage_limit != null && d.usage_count >= d.usage_limit;
                  return (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-2xl border border-line bg-panel p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-panel2 shrink-0">
                            {d.discount_type === "percent" ? <Percent size={15} className="text-ink" /> : <DollarSign size={15} className="text-ink" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="font-bold text-ink text-sm font-mono uppercase">{d.code}</span>
                              <span className="rounded-full border border-line2 bg-panel2 px-2 py-0.5 text-xs text-ink font-bold">
                                {d.discount_type === "percent" ? `${d.discount_value}%` : `${d.discount_value} ر.س`}
                              </span>
                              <span className={`rounded-full border px-2 py-0.5 text-xs ${d.is_active && !expired && !exhausted ? "border-line2 bg-panel2 text-ink" : "border-slate-700 text-muted2"}`}>
                                {!d.is_active ? "متوقف" : expired ? "منتهي" : exhausted ? "مستنفد" : "نشط"}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                              <span>📦 {(d.products && d.products.length > 0)
                                ? d.products.map(p => p.name).join("، ")
                                : "كل المنتجات"}</span>
                              <span>💳 {(d.gateways && d.gateways.length > 0)
                                ? d.gateways.map(g => GATEWAY_OPTIONS.find(o => o.v === g)?.label || g).join("، ")
                                : "كل طرق الدفع"}</span>
                              <span>
                                🔢 {d.usage_count}{d.usage_limit != null ? ` / ${d.usage_limit}` : ""} طلب مدفوع
                              </span>
                              {d.sales && d.sales.paid_orders > 0 && (
                                <span>💰 إيرادات {d.sales.revenue.toFixed(2)} ر.س • خصم {d.sales.total_discount.toFixed(2)} ر.س</span>
                              )}
                              {d.expires_at && (
                                <span>⏰ ينتهي {fmt(d.expires_at)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => toggleDiscountActive(d)}
                            className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-ink hover:border-line2 transition-all"
                          >
                            {d.is_active ? "إيقاف" : "تفعيل"}
                          </button>
                          <button
                            onClick={() => deleteDiscount(d.id)}
                            disabled={dDeletingId === d.id}
                            className="rounded-lg border border-danger-border px-3 py-1.5 text-xs text-danger hover:bg-danger-bg transition-all disabled:opacity-50"
                          >
                            {dDeletingId === d.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── SETTINGS (BANNER) TAB ─── */}
        {tab === "settings" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="rounded-2xl border border-line bg-panel p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-ink flex items-center gap-2">
                    <ImageIcon size={16} />
                    بنر أعلى المتجر
                  </h2>
                  <p className="text-xs text-muted2 mt-1">يظهر للزوار في أعلى صفحة المتجر — يمكنك إضافة صورة أو نص أو الاثنين معاً.</p>
                </div>
                <button
                  onClick={async () => {
                    const next = !settings.banner_enabled;
                    setSettings(s => ({ ...s, banner_enabled: next }));
                    try {
                      await fetch(`${API_BASE}/api/admin/store/settings`, {
                        method: "PUT", credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ banner_enabled: next }),
                      });
                      setStMsg(next ? "البنر يظهر الآن في المتجر ✓" : "تم إخفاء البنر"); setStMsgType("ok");
                    } catch {
                      setStMsg("فشل التحديث"); setStMsgType("err");
                    }
                  }}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${
                    settings.banner_enabled ? "border-line2 bg-panel2 text-ink" : "border-line bg-panel text-ink"
                  }`}
                  type="button"
                >
                  {settings.banner_enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                  {settings.banner_enabled ? "ظاهر" : "مخفي — اضغط لتفعيله"}
                </button>
              </div>

              {stMsg && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${stMsgType === "ok" ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
                  {stMsg}
                </div>
              )}

              {stLoading ? (
                <div className="flex items-center justify-center py-10 text-muted2">
                  <RefreshCw size={16} className="animate-spin ml-2" /> جاري التحميل...
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">نص البنر</label>
                    <textarea
                      value={settings.banner_text || ""}
                      onChange={(e) => setSettings(s => ({ ...s, banner_text: e.target.value }))}
                      rows={3}
                      placeholder="اكتب النص الذي يظهر في البنر..."
                      className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">صورة البنر</label>
                    {settings.banner_image_url ? (
                      <div className="space-y-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={settings.banner_image_url} alt="banner" className="w-full max-h-56 object-cover rounded-xl border border-line" />
                        <div className="flex gap-2">
                          <label className={`flex items-center gap-2 rounded-xl border border-line bg-panel2 px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-panel transition-all ${bannerUploading ? "opacity-60 pointer-events-none" : ""}`}>
                            <Upload size={13} />
                            {bannerUploading ? "جاري الرفع..." : "تغيير الصورة"}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f); e.currentTarget.value = ""; }} />
                          </label>
                          <button
                            onClick={() => setSettings(s => ({ ...s, banner_image_url: "" }))}
                            className="flex items-center gap-2 rounded-xl border border-danger-border bg-danger-bg text-danger px-3 py-2 text-xs font-semibold hover:opacity-90 transition-all"
                            type="button"
                          >
                            <Trash2 size={13} />
                            حذف الصورة
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-panel2 py-8 text-sm text-muted cursor-pointer hover:border-line2 hover:text-ink transition-all ${bannerUploading ? "opacity-60 pointer-events-none" : ""}`}>
                        <Upload size={16} />
                        {bannerUploading ? "جاري الرفع..." : "اسحب صورة هنا أو اضغط للاختيار (حد أقصى 5MB)"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f); e.currentTarget.value = ""; }} />
                      </label>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={saveSettings}
                      disabled={stSaving}
                      className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60"
                    >
                      {stSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                      حفظ
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </Shell>
  );
}
