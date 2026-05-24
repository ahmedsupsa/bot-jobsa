"use client";

import Shell from "@/components/shell";
import { API_BASE } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Package, ClipboardList, Plus, Pencil, Trash2,
  CheckCircle2, XCircle, Clock, RefreshCw, X, Save, Zap,
  Building2, Wallet, Copy, CheckCheck, Tag, Percent, DollarSign,
  ImagePlus, Trash, ChevronLeft, ArrowUpDown, SortAsc, SortDesc,
  User, Mail, Phone, CreditCard, Calendar, FileText, ExternalLink,
} from "lucide-react";
import Image from "next/image";

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_days: number;
  streampay_product_id?: string;
  is_active: boolean;
  is_secret?: boolean;
  image_url?: string | null;
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
  tamara_order_id?: string;
  refund_status?: "requested" | "approved" | "rejected" | "refunded" | null;
  refund_reason?: string | null;
  refund_admin_notes?: string | null;
  refund_requested_at?: string | null;
  refund_processed_at?: string | null;
  refund_method?: string | null;
  store_products?: { name: string; price: number; duration_days: number };
  discount_code?: string | null;
  original_amount?: number | null;
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

const EMPTY_PRODUCT = { name: "", description: "", price: "", duration_days: "", is_secret: false, image_url: "" };
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

function GatewayBadge({ gateway }: { gateway?: string }) {
  if (!gateway) return null;
  const map: Record<string, { label: string; color: string }> = {
    bank_transfer: { label: "تحويل بنكي", color: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" },
    tamara:        { label: "تمارا",       color: "border-purple-500/30 bg-purple-500/10 text-purple-400" },
    streampay:     { label: "بطاقة",       color: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  };
  const g = map[gateway];
  if (!g) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${g.color}`}>
      {g.label}
    </span>
  );
}

export default function StoreAdminPage() {
  const [tab, setTab] = useState<"products" | "orders" | "banks" | "discounts">("products");

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [pLoading, setPLoading] = useState(false);
  const [pMsg, setPMsg] = useState("");
  const [pMsgType, setPMsgType] = useState<"ok" | "err">("ok");
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [pForm, setPForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [oLoading, setOLoading] = useState(false);
  const [oFilter, setOFilter] = useState("all");
  const [oSort, setOSort] = useState<"newest" | "oldest" | "amount_desc">("newest");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [oForm, setOForm] = useState({ user_name: "", user_email: "", product_id: "", amount: "", notes: "" });
  const [oSaving, setOSaving] = useState(false);
  const [oMsg, setOMsg] = useState("");
  const [oMsgType, setOMsgType] = useState<"ok" | "err">("ok");
  const [notifyTestGw, setNotifyTestGw] = useState<"tamara" | "streampay" | "bank_transfer">("tamara");
  const [notifyTesting, setNotifyTesting] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState("");
  const [notifyMsgType, setNotifyMsgType] = useState<"ok" | "err">("ok");

  const sendTestNotification = async () => {
    setNotifyTesting(true); setNotifyMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/store/notify-test`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway: notifyTestGw }),
      });
      const j = await r.json();
      if (j.ok) { setNotifyMsg(j.message || "تم الإرسال ✅"); setNotifyMsgType("ok"); }
      else { setNotifyMsg(j.error || "فشل الإرسال"); setNotifyMsgType("err"); }
    } catch (e) {
      setNotifyMsg("خطأ في الشبكة"); setNotifyMsgType("err");
    }
    setNotifyTesting(false);
    setTimeout(() => setNotifyMsg(""), 6000);
  };

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
      fetch("/api/admin/store/orders/mark-seen", { method: "POST", credentials: "include" }).catch(() => {});
    }
  }, [tab, loadOrders]);
  useEffect(() => { if (tab === "banks") loadBanks(); }, [tab, loadBanks]);
  useEffect(() => { if (tab === "discounts") loadDiscounts(); }, [tab, loadDiscounts]);

  // Sync selectedOrder when orders reload
  useEffect(() => {
    if (selectedOrder) {
      const updated = orders.find(o => o.id === selectedOrder.id);
      if (updated) setSelectedOrder(updated);
    }
  }, [orders]);

  const openAddProduct = () => {
    setEditProduct(null);
    setPForm(EMPTY_PRODUCT);
    setImgPreview(null);
    setShowForm(true);
  };

  const handleImageUpload = async (file: File, productId: string) => {
    setImgUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("product_id", productId);
      const r = await fetch(`${API_BASE}/api/admin/store/products/upload-image`, {
        method: "POST", credentials: "include", body: fd,
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل رفع الصورة");
      setImgPreview(j.image_url);
      setPForm(s => ({ ...s, image_url: j.image_url }));
      setPMsg("تم رفع الصورة ✓"); setPMsgType("ok");
      await loadProducts();
    } catch (e) {
      setPMsg(String(e).replace("Error: ", "")); setPMsgType("err");
    }
    setImgUploading(false);
  };

  const handleRemoveImage = async (productId: string) => {
    if (!confirm("حذف صورة المنتج؟")) return;
    setImgUploading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/store/products/upload-image`, {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الحذف");
      setImgPreview(null);
      setPForm(s => ({ ...s, image_url: "" }));
      setPMsg("تم حذف الصورة"); setPMsgType("ok");
      await loadProducts();
    } catch (e) {
      setPMsg(String(e).replace("Error: ", "")); setPMsgType("err");
    }
    setImgUploading(false);
  };

  const openEditProduct = (p: Product) => {
    setEditProduct(p);
    setPForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      duration_days: String(p.duration_days),
      is_secret: !!p.is_secret,
      image_url: p.image_url || "",
    });
    setImgPreview(p.image_url || null);
    setPMsg("");
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
    setSelectedOrder(null);
    await loadOrders();
  };

  const verifyPayment = async (id: string) => {
    setUpdatingId(id);
    try {
      const r = await fetch(`${API_BASE}/api/admin/store/orders/${id}/verify-payment`, {
        method: "POST", credentials: "include",
      });
      const j = await r.json();
      const lines = [
        `حالة البوابة: ${j.gateway_status || "—"}`,
        `المبلغ في البوابة: ${j.gateway_amount ?? "—"} ${j.gateway_currency || "SAR"}`,
        `المبلغ في قاعدة البيانات: ${j.db_amount ?? "—"} SAR`,
        `تطابق المبلغ: ${j.amount_match === true ? "✅ نعم" : j.amount_match === false ? "❌ لا" : "—"}`,
        j.captured_at ? `وقت الدفع: ${fmt(j.captured_at)}` : "",
        j.error ? `خطأ: ${j.error}` : "",
      ].filter(Boolean).join("\n");
      alert(lines);
    } catch (e: any) {
      alert("فشل التحقق: " + (e?.message || e));
    }
    setUpdatingId(null);
  };

  const processRefund = async (id: string, action: "approve" | "reject") => {
    const promptText = action === "approve"
      ? "موافقة على استرجاع المبلغ — سنحاول تنفيذه عبر بوابة الدفع تلقائياً.\nملاحظات (اختياري):"
      : "رفض طلب الاسترجاع.\nسبب الرفض (سيُعرض للعميل):";
    const notes = window.prompt(promptText, "");
    if (notes === null) return;
    setUpdatingId(id);
    try {
      const r = await fetch(`${API_BASE}/api/admin/store/orders/${id}/refund`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes, try_gateway: true }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل");
      if (action === "approve") {
        if (j.method === "gateway_auto") {
          alert("✅ تم الاسترجاع تلقائياً عبر بوابة الدفع");
        } else {
          alert("⚠️ تم تسجيل الاسترجاع كـ يدوي" + (j.gateway_error ? `\n\nخطأ البوابة: ${j.gateway_error}\n\nنفّذ الاسترجاع يدوياً من لوحة البوابة.` : ""));
        }
      } else {
        alert("✅ تم رفض الطلب");
      }
      await loadOrders();
    } catch (e: any) {
      alert("فشل: " + (e?.message || e));
    }
    setUpdatingId(null);
  };

  const sendReminder = async (id: string, email: string) => {
    if (!confirm(`إرسال تذكير إلى ${email}؟`)) return;
    setRemindingId(id);
    try {
      const r = await fetch(`${API_BASE}/api/admin/store/orders/${id}/remind`, {
        method: "POST", credentials: "include",
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      alert(`✅ تم إرسال التذكير إلى ${j.sent_to}`);
    } catch (e: any) {
      alert("فشل إرسال التذكير: " + (e?.message || e));
    }
    setRemindingId(null);
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
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (oSort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (oSort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (oSort === "amount_desc") return (b.amount || 0) - (a.amount || 0);
    return 0;
  });

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
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as "products" | "orders" | "banks" | "discounts")}
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
                      {p.image_url && (
                        <div className="relative flex-shrink-0 rounded-xl overflow-hidden border border-line" style={{ width: 60, height: 60 }}>
                          <Image src={p.image_url} alt={p.name} fill className="object-cover" unoptimized />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-ink text-sm">{p.name}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${p.is_active ? "border-line2 bg-panel2 text-ink" : "border-slate-600 bg-slate-700/50 text-muted"}`}>
                              {p.is_active ? "نشط" : "متوقف"}
                          </span>
                          {p.is_secret && (
                            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-400">
                              🔒 سري
                            </span>
                          )}
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
          </motion.div>
        )}

        {/* ─── ORDERS TAB ─── */}
        {tab === "orders" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Filter + Sort bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Status filters */}
                <div className="flex gap-1 rounded-xl border border-line bg-panel p-1 flex-wrap">
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
                <div className="flex items-center gap-2 flex-wrap">
                  {/* تجربة إشعار البريد */}
                  <div className="flex items-center gap-1.5 rounded-xl border border-line bg-panel px-2 py-1">
                    <Mail size={12} className="text-muted shrink-0" />
                    <select
                      value={notifyTestGw}
                      onChange={e => setNotifyTestGw(e.target.value as any)}
                      className="bg-transparent text-xs text-muted focus:outline-none cursor-pointer"
                    >
                      <option value="tamara">تمارا</option>
                      <option value="streampay">ستريم باي</option>
                      <option value="bank_transfer">تحويل بنكي</option>
                    </select>
                    <button
                      onClick={sendTestNotification}
                      disabled={notifyTesting}
                      className="flex items-center gap-1 rounded-lg border border-line2 bg-panel2 px-2.5 py-1 text-xs font-medium text-ink hover:bg-panel transition-all disabled:opacity-50"
                    >
                      {notifyTesting ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
                      اختبار الإشعار
                    </button>
                  </div>
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
                {notifyMsg && (
                  <div className={`text-xs px-3 py-2 rounded-lg border ${notifyMsgType === "ok" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                    {notifyMsg}
                  </div>
                )}
              </div>

              {/* Sort buttons */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted2 flex items-center gap-1"><ArrowUpDown size={11} />ترتيب:</span>
                {[
                  { k: "newest",      l: "الأحدث",      icon: SortDesc },
                  { k: "oldest",      l: "الأقدم",       icon: SortAsc },
                  { k: "amount_desc", l: "الأعلى مبلغاً", icon: DollarSign },
                ].map(({ k, l, icon: Icon }) => (
                  <button
                    key={k}
                    onClick={() => setOSort(k as typeof oSort)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-all ${
                      oSort === k ? "border-line2 bg-panel2 text-ink" : "border-line text-muted hover:text-ink hover:border-line2"
                    }`}
                  >
                    <Icon size={11} />
                    {l}
                  </button>
                ))}
                <span className="mr-auto text-xs text-muted2">{sortedOrders.length} طلب</span>
              </div>
            </div>

            {oMsg && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${oMsgType === "ok" ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
                {oMsg}
              </div>
            )}

            {oLoading ? (
              <div className="flex items-center justify-center py-16 text-muted2"><RefreshCw size={18} className="animate-spin ml-2" />جاري التحميل...</div>
            ) : sortedOrders.length === 0 ? (
              <div className="rounded-2xl border border-line bg-panel p-12 text-center">
                <ClipboardList size={32} className="mx-auto mb-3 text-muted" />
                <p className="text-muted2">لا توجد طلبات</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedOrders.map((o, i) => (
                  <motion.button
                    key={o.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setSelectedOrder(o)}
                    className={`w-full text-right rounded-2xl border bg-panel px-4 py-3.5 transition-all hover:border-line2 hover:bg-panel2 ${
                      selectedOrder?.id === o.id ? "border-line2 bg-panel2" : "border-line"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Status badge */}
                      <Badge status={o.status} />

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {o.user_name && (
                            <span className="text-sm font-semibold text-ink">{o.user_name}</span>
                          )}
                          {o.store_products && (
                            <span className="text-xs text-muted bg-bg border border-line rounded-full px-2 py-0.5">
                              {o.store_products.name}
                            </span>
                          )}
                          <GatewayBadge gateway={o.payment_gateway} />
                          {o.refund_status === "requested" && (
                            <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-400 font-bold">
                              ⚠️ طلب استرجاع
                            </span>
                          )}
                        </div>
                        {o.user_email && (
                          <p className="text-xs text-muted2 mt-0.5 truncate" dir="ltr">{o.user_email}</p>
                        )}
                      </div>

                      {/* Amount + date */}
                      <div className="text-left shrink-0 space-y-0.5">
                        {o.amount && (
                          <p className="text-sm font-bold text-ink">{o.amount} ر.س</p>
                        )}
                        <p className="text-xs text-muted2">{fmt(o.created_at)}</p>
                      </div>

                      {/* Arrow */}
                      <ChevronLeft size={15} className="text-muted2 shrink-0" />
                    </div>
                  </motion.button>
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
                          className="rounded-lg border border-line p-1.5 text-muted hover:text-danger hover:border-danger-border disabled:opacity-50 transition-all"
                        >
                          {bDeletingId === acc.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── DISCOUNTS TAB ─── */}
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

            {/* Add Discount Form */}
            <AnimatePresence>
              {showDiscountForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="rounded-2xl border border-line bg-panel p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-ink text-sm">إضافة كود خصم جديد</h3>
                      <button onClick={() => setShowDiscountForm(false)} className="text-muted2 hover:text-ink"><X size={16} /></button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs text-muted mb-1.5">الكود *</label>
                        <input
                          className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink font-mono uppercase placeholder:text-muted focus:outline-none focus:border-line2"
                          placeholder="SAVE20"
                          value={dForm.code}
                          onChange={e => setDForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-muted mb-1.5">نوع الخصم *</label>
                        <div className="flex gap-2">
                          {[{ v: "percent", label: "نسبة %", icon: Percent }, { v: "fixed", label: "مبلغ ثابت", icon: DollarSign }].map(({ v, label, icon: Icon }) => (
                            <button
                              key={v}
                              onClick={() => setDForm(f => ({ ...f, discount_type: v as "percent" | "fixed" }))}
                              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${dForm.discount_type === v ? "border-line2 bg-panel2 text-ink" : "border-line text-muted hover:text-ink"}`}
                            >
                              <Icon size={12} />
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-muted mb-1.5">القيمة *</label>
                        <input
                          type="number"
                          className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-line2"
                          placeholder={dForm.discount_type === "percent" ? "20" : "50"}
                          value={dForm.discount_value}
                          onChange={e => setDForm(f => ({ ...f, discount_value: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-muted mb-1.5">حد الاستخدام (اتركه فارغاً للامحدود)</label>
                        <input
                          type="number"
                          className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-line2"
                          placeholder="100"
                          value={dForm.usage_limit}
                          onChange={e => setDForm(f => ({ ...f, usage_limit: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-muted mb-1.5">تاريخ الانتهاء (اختياري)</label>
                        <input
                          type="date"
                          className="w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-line2"
                          value={dForm.expires_at}
                          onChange={e => setDForm(f => ({ ...f, expires_at: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-muted mb-1.5">المنتجات المشمولة (اتركه فارغاً لجميع المنتجات)</label>
                      <div className="flex flex-wrap gap-2">
                        {products.map(p => (
                          <button
                            key={p.id}
                            onClick={() => setDForm(f => ({
                              ...f,
                              product_ids: f.product_ids.includes(p.id)
                                ? f.product_ids.filter(id => id !== p.id)
                                : [...f.product_ids, p.id],
                            }))}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                              dForm.product_ids.includes(p.id) ? "border-line2 bg-panel2 text-ink" : "border-line text-muted hover:text-ink"
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-muted mb-1.5">بوابات الدفع المشمولة (اتركه فارغاً لجميع البوابات)</label>
                      <div className="flex gap-2 flex-wrap">
                        {GATEWAY_OPTIONS.map(g => (
                          <button
                            key={g.v}
                            onClick={() => setDForm(f => ({
                              ...f,
                              gateways: f.gateways.includes(g.v)
                                ? f.gateways.filter(x => x !== g.v)
                                : [...f.gateways, g.v],
                            }))}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                              dForm.gateways.includes(g.v) ? "border-line2 bg-panel2 text-ink" : "border-line text-muted hover:text-ink"
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
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
                  </div>
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
                {discounts.map((d, i) => (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-2xl border border-line bg-panel p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="font-mono font-bold text-ink text-base tracking-wider">{d.code}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${d.is_active ? "border-line2 bg-panel2 text-ink" : "border-slate-600 text-muted"}`}>
                            {d.is_active ? "نشط" : "متوقف"}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${d.discount_type === "percent" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-blue-500/30 bg-blue-500/10 text-blue-400"}`}>
                            {d.discount_type === "percent" ? `${d.discount_value}%` : `${d.discount_value} ر.س`}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-muted2">
                          <span>الاستخدام: {d.usage_count} {d.usage_limit ? `/ ${d.usage_limit}` : "(غير محدود)"}</span>
                          {d.expires_at && <span>ينتهي: {new Date(d.expires_at).toLocaleDateString("ar-SA")}</span>}
                          {d.applies_to_all_products ? (
                            <span>المنتجات: جميعها</span>
                          ) : d.products && d.products.length > 0 ? (
                            <span>المنتجات: {d.products.map(p => p.name).join("، ")}</span>
                          ) : null}
                          {d.applies_to_all_gateways ? (
                            <span>البوابات: جميعها</span>
                          ) : d.gateways && d.gateways.length > 0 ? (
                            <span>البوابات: {d.gateways.join("، ")}</span>
                          ) : null}
                          {d.sales && d.sales.paid_orders > 0 && (
                            <span className="col-span-2 text-ink/80">
                              📊 {d.sales.paid_orders} طلب مدفوع — توفير {d.sales.total_discount} ر.س — إيرادات {d.sales.revenue} ر.س
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleDiscountActive(d)}
                          className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink hover:border-line2 transition-all"
                        >
                          {d.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                        <button
                          onClick={() => deleteDiscount(d.id)}
                          disabled={dDeletingId === d.id}
                          className="rounded-lg border border-line p-1.5 text-muted hover:text-danger hover:border-danger-border disabled:opacity-50 transition-all"
                        >
                          {dDeletingId === d.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          ORDER SIDE PANEL
      ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setSelectedOrder(null)}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-panel border-r border-line shadow-2xl flex flex-col"
              dir="rtl"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-panel2 transition-all"
                  >
                    <X size={16} />
                  </button>
                  <div>
                    <h2 className="font-bold text-ink text-sm">تفاصيل الطلب</h2>
                    <p className="text-[10px] text-muted2 font-mono">{selectedOrder.id.slice(0, 16)}…</p>
                  </div>
                </div>
                <Badge status={selectedOrder.status} />
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Customer info */}
                <div className="rounded-2xl border border-line bg-bg p-4 space-y-2.5">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">معلومات العميل</h3>
                  {selectedOrder.user_name && (
                    <div className="flex items-center gap-3">
                      <User size={14} className="text-muted2 shrink-0" />
                      <span className="text-sm text-ink">{selectedOrder.user_name}</span>
                    </div>
                  )}
                  {selectedOrder.user_email && (
                    <div className="flex items-center gap-3">
                      <Mail size={14} className="text-muted2 shrink-0" />
                      <span className="text-sm text-ink" dir="ltr">{selectedOrder.user_email}</span>
                    </div>
                  )}
                  {selectedOrder.user_phone && (
                    <div className="flex items-center gap-3">
                      <Phone size={14} className="text-muted2 shrink-0" />
                      <span className="text-sm text-ink" dir="ltr">{selectedOrder.user_phone}</span>
                    </div>
                  )}
                </div>

                {/* Order info */}
                <div className="rounded-2xl border border-line bg-bg p-4 space-y-2.5">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">تفاصيل الطلب</h3>
                  {selectedOrder.store_products && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted2">المنتج</span>
                      <span className="text-sm font-semibold text-ink">{selectedOrder.store_products.name}</span>
                    </div>
                  )}
                  {selectedOrder.amount && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted2">المبلغ المدفوع</span>
                      <span className="text-base font-bold text-ink">{selectedOrder.amount} ر.س</span>
                    </div>
                  )}
                  {selectedOrder.original_amount && selectedOrder.original_amount !== selectedOrder.amount && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted2">المبلغ الأصلي</span>
                      <span className="text-sm text-muted2 line-through">{selectedOrder.original_amount} ر.س</span>
                    </div>
                  )}
                  {selectedOrder.discount_code && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted2">كود الخصم</span>
                      <span className="font-mono text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">{selectedOrder.discount_code}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted2">طريقة الدفع</span>
                    <GatewayBadge gateway={selectedOrder.payment_gateway} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted2">تاريخ الطلب</span>
                    <span className="text-xs text-ink">{fmt(selectedOrder.created_at)}</span>
                  </div>
                  {selectedOrder.paid_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted2">تاريخ الدفع</span>
                      <span className="text-xs text-ink">{fmt(selectedOrder.paid_at)}</span>
                    </div>
                  )}
                  {selectedOrder.notes && (
                    <div className="pt-2 border-t border-line">
                      <p className="text-xs text-muted2 mb-1">ملاحظات</p>
                      <p className="text-sm text-ink">{selectedOrder.notes}</p>
                    </div>
                  )}
                </div>

                {/* Invoice IDs */}
                {(selectedOrder.streampay_invoice_id || selectedOrder.streampay_payment_id || selectedOrder.tamara_order_id) && (
                  <div className="rounded-2xl border border-line bg-bg p-4 space-y-2">
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">معرّفات البوابة</h3>
                    {selectedOrder.streampay_invoice_id && (
                      <div>
                        <p className="text-[10px] text-muted2 mb-0.5">Invoice ID</p>
                        <p className="font-mono text-xs text-ink break-all">{selectedOrder.streampay_invoice_id}</p>
                      </div>
                    )}
                    {selectedOrder.streampay_payment_id && (
                      <div>
                        <p className="text-[10px] text-muted2 mb-0.5">Payment ID</p>
                        <p className="font-mono text-xs text-ink break-all">{selectedOrder.streampay_payment_id}</p>
                      </div>
                    )}
                    {selectedOrder.tamara_order_id && (
                      <div>
                        <p className="text-[10px] text-muted2 mb-0.5">Tamara Order ID</p>
                        <p className="font-mono text-xs text-ink break-all">{selectedOrder.tamara_order_id}</p>
                      </div>
                    )}
                    {selectedOrder.streampay_payment_link_id && (
                      <div>
                        <p className="text-[10px] text-muted2 mb-0.5">Payment Link ID</p>
                        <p className="font-mono text-xs text-ink break-all">{selectedOrder.streampay_payment_link_id}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Receipt */}
                {selectedOrder.receipt_url && (
                  <div className="rounded-2xl border border-line bg-bg p-4">
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">إيصال التحويل</h3>
                    <a
                      href={selectedOrder.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors mb-2"
                    >
                      <ExternalLink size={12} />
                      فتح الإيصال
                    </a>
                    {/\.(jpe?g|png|webp|gif)$/i.test(selectedOrder.receipt_url) && (
                      <a href={selectedOrder.receipt_url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedOrder.receipt_url}
                          alt="إيصال"
                          className="w-full max-h-48 rounded-xl object-cover border border-line hover:opacity-90 transition-opacity"
                        />
                      </a>
                    )}
                  </div>
                )}

                {selectedOrder.payment_gateway === "bank_transfer" && !selectedOrder.receipt_url && selectedOrder.status === "pending" && (
                  <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-400/80">
                    ⏳ لم يُرفع إيصال التحويل بعد
                  </div>
                )}

                {/* Refund section */}
                {selectedOrder.refund_status && (
                  <div className="rounded-2xl border border-line bg-bg p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-muted uppercase tracking-wider">طلب استرجاع</span>
                      <span className={
                        selectedOrder.refund_status === "requested" ? "rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400 font-bold" :
                        selectedOrder.refund_status === "refunded" ? "rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-400 font-bold" :
                        selectedOrder.refund_status === "rejected" ? "rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-400 font-bold" :
                        "rounded-full border border-line2 bg-bg px-2 py-0.5 text-xs text-ink font-bold"
                      }>
                        {selectedOrder.refund_status === "requested" ? "قيد المراجعة" :
                         selectedOrder.refund_status === "refunded" ? `تم الاسترجاع (${selectedOrder.refund_method === "gateway_auto" ? "تلقائي" : "يدوي"})` :
                         selectedOrder.refund_status === "rejected" ? "مرفوض" : selectedOrder.refund_status}
                      </span>
                    </div>
                    {selectedOrder.refund_requested_at && (
                      <p className="text-xs text-muted2">تاريخ الطلب: {fmt(selectedOrder.refund_requested_at)}</p>
                    )}
                    {selectedOrder.refund_reason && (
                      <div className="text-sm text-ink/80"><b className="text-muted2">سبب العميل:</b> {selectedOrder.refund_reason}</div>
                    )}
                    {selectedOrder.refund_admin_notes && (
                      <div className="text-sm text-ink/80"><b className="text-muted2">ملاحظات الإدارة:</b> {selectedOrder.refund_admin_notes}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Panel footer — Action buttons */}
              <div className="border-t border-line p-4 shrink-0 space-y-2">
                {/* Refund actions */}
                {selectedOrder.refund_status === "requested" && (
                  <div className="flex gap-2">
                    <button
                      disabled={updatingId === selectedOrder.id}
                      onClick={() => processRefund(selectedOrder.id, "approve")}
                      className="flex-1 rounded-xl border border-green-500/30 py-2.5 text-sm text-green-400 hover:bg-green-500/10 disabled:opacity-50 transition-all font-medium"
                    >
                      ✓ موافقة على الاسترجاع
                    </button>
                    <button
                      disabled={updatingId === selectedOrder.id}
                      onClick={() => processRefund(selectedOrder.id, "reject")}
                      className="flex-1 rounded-xl border border-red-500/30 py-2.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-all font-medium"
                    >
                      ✗ رفض
                    </button>
                  </div>
                )}

                {/* Gateway verify */}
                {selectedOrder.status === "paid" && (selectedOrder.payment_gateway === "tamara" || selectedOrder.payment_gateway === "streampay") && (
                  <button
                    disabled={updatingId === selectedOrder.id}
                    onClick={() => verifyPayment(selectedOrder.id)}
                    className="w-full rounded-xl border border-blue-500/30 py-2.5 text-sm text-blue-400 hover:bg-blue-500/10 disabled:opacity-50 transition-all font-medium"
                  >
                    🔍 تحقق من البوابة
                  </button>
                )}

                {/* Pending actions */}
                {selectedOrder.status === "pending" && (
                  <div className="flex gap-2">
                    {selectedOrder.payment_gateway === "bank_transfer" && selectedOrder.user_email && (
                      <button
                        disabled={remindingId === selectedOrder.id}
                        onClick={() => sendReminder(selectedOrder.id, selectedOrder.user_email!)}
                        className="rounded-xl border border-yellow-500/30 px-4 py-2.5 text-sm text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50 transition-all font-medium"
                      >
                        {remindingId === selectedOrder.id ? "جاري الإرسال..." : "📧 تذكير"}
                      </button>
                    )}
                    <button
                      disabled={updatingId === selectedOrder.id}
                      onClick={() => updateOrderStatus(selectedOrder.id, "paid")}
                      className="flex-1 rounded-xl border border-line2 bg-panel2 py-2.5 text-sm text-ink hover:bg-bg disabled:opacity-50 transition-all font-medium"
                    >
                      {updatingId === selectedOrder.id ? <RefreshCw size={13} className="animate-spin mx-auto" /> : "✓ تأكيد الدفع"}
                    </button>
                    <button
                      disabled={updatingId === selectedOrder.id}
                      onClick={() => updateOrderStatus(selectedOrder.id, "cancelled")}
                      className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink hover:border-line2 disabled:opacity-50 transition-all font-medium"
                    >
                      إلغاء
                    </button>
                  </div>
                )}

                {/* Reactivate */}
                {(selectedOrder.status === "failed" || selectedOrder.status === "cancelled") && (
                  <button
                    disabled={updatingId === selectedOrder.id}
                    onClick={() => updateOrderStatus(selectedOrder.id, "pending")}
                    className="w-full rounded-xl border border-yellow-500/30 py-2.5 text-sm text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50 transition-all font-medium"
                  >
                    إعادة تفعيل الطلب
                  </button>
                )}

                {/* Delete */}
                <button
                  onClick={() => deleteOrder(selectedOrder.id)}
                  className="w-full rounded-xl border border-line py-2.5 text-sm text-danger hover:bg-danger-bg hover:border-danger-border transition-all font-medium"
                >
                  حذف الطلب
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          PRODUCT SIDE PANEL (Add / Edit)
      ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-panel border-r border-line shadow-2xl flex flex-col"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowForm(false)}
                    className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-panel2 transition-all"
                  >
                    <X size={16} />
                  </button>
                  <h2 className="font-bold text-ink">{editProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</h2>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="block text-xs text-muted mb-1.5">اسم المنتج *</label>
                  <input
                    value={pForm.name}
                    onChange={e => setPForm(s => ({ ...s, name: e.target.value }))}
                    placeholder="مثال: خطة شهرية"
                    className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1.5">الوصف</label>
                  <textarea
                    value={pForm.description}
                    onChange={e => setPForm(s => ({ ...s, description: e.target.value }))}
                    placeholder="وصف مختصر للخطة..."
                    rows={3}
                    className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1.5">السعر (ر.س) *</label>
                    <input
                      type="number"
                      value={pForm.price}
                      onChange={e => setPForm(s => ({ ...s, price: e.target.value }))}
                      placeholder="99"
                      className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1.5">المدة (أيام) *</label>
                    <input
                      type="number"
                      value={pForm.duration_days}
                      onChange={e => setPForm(s => ({ ...s, duration_days: e.target.value }))}
                      placeholder="30"
                      className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-line2 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Product Image */}
                <div>
                  <label className="block text-xs text-muted mb-1.5">صورة المنتج</label>
                  {imgPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-line bg-bg" style={{ height: 160 }}>
                      <Image src={imgPreview} alt="صورة المنتج" fill className="object-cover" unoptimized />
                      <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="cursor-pointer rounded-lg bg-white/90 text-gray-800 px-3 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-white transition-all">
                          <ImagePlus size={13} />
                          تغيير
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f && editProduct) handleImageUpload(f, editProduct.id);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {editProduct && (
                          <button
                            onClick={() => handleRemoveImage(editProduct.id)}
                            disabled={imgUploading}
                            className="rounded-lg bg-red-500/90 text-white px-3 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-red-500 transition-all"
                          >
                            <Trash size={13} />
                            حذف
                          </button>
                        )}
                      </div>
                      {imgUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <RefreshCw size={20} className="text-white animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : editProduct ? (
                    <label className="cursor-pointer flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line hover:border-line2 bg-bg transition-all py-8 text-muted2 hover:text-muted">
                      {imgUploading ? (
                        <RefreshCw size={22} className="animate-spin" />
                      ) : (
                        <>
                          <ImagePlus size={22} />
                          <span className="text-xs">اضغط لرفع صورة</span>
                          <span className="text-[10px] text-muted2">JPG · PNG · WebP (حد أقصى 5MB)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f && editProduct) handleImageUpload(f, editProduct.id);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-bg py-6 text-muted2">
                      <ImagePlus size={20} />
                      <span className="text-xs">احفظ المنتج أولاً ثم ارفع الصورة</span>
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-line bg-bg px-3 py-2.5 hover:border-line2 transition-all">
                  <input
                    type="checkbox"
                    checked={!!pForm.is_secret}
                    onChange={e => setPForm(s => ({ ...s, is_secret: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-ink">منتج سري (admin only)</div>
                    <div className="text-[10px] text-muted2">يظهر في المتجر فقط عند البحث عن "admin"</div>
                  </div>
                </label>

                {editProduct?.streampay_product_id ? (
                  <div>
                    <label className="block text-xs text-muted mb-1.5">StreamPay Product ID</label>
                    <div className="w-full rounded-xl border border-line2 bg-panel2 px-3 py-2.5 text-xs text-ink/80 font-mono flex items-center gap-2" dir="ltr">
                      <CheckCircle2 size={12} className="flex-shrink-0 text-green-400" />
                      <span className="truncate">{editProduct.streampay_product_id}</span>
                    </div>
                  </div>
                ) : !editProduct ? (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 text-xs text-blue-300 flex items-center gap-2">
                    <Zap size={13} className="flex-shrink-0 text-blue-400" />
                    سيتم إنشاء المنتج تلقائياً في StreamPay عند الحفظ
                  </div>
                ) : null}

                {pMsg && (
                  <div className={`rounded-xl border px-3 py-2.5 text-sm ${pMsgType === "ok" ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
                    {pMsg}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-line p-4 shrink-0 flex gap-2">
                <button
                  onClick={saveProduct}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-fg py-2.5 text-sm font-semibold hover:bg-panel2 disabled:opacity-50 transition-all"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {editProduct ? "حفظ التغييرات" : "إضافة المنتج"}
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
    </Shell>
  );
}
