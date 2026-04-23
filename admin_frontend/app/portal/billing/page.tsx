"use client";

import { useEffect, useState, useCallback } from "react";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch } from "@/lib/portal-auth";
import { useTheme } from "@/contexts/theme-context";
import {
  Receipt, Loader2, CheckCircle2, Clock, XCircle, AlertCircle, RotateCcw, Send, X,
} from "lucide-react";

interface Order {
  id: string;
  status: string;
  amount: number | null;
  paid_at: string | null;
  created_at: string;
  payment_gateway: string | null;
  refund_status: string | null;
  refund_reason: string | null;
  refund_admin_notes: string | null;
  refund_requested_at: string | null;
  refund_processed_at: string | null;
  store_products: { name: string; duration_days: number } | null;
}

const GATEWAY_LABEL: Record<string, string> = {
  tamara: "تمارا (تقسيط)",
  streampay: "بطاقة (Mada / Visa / Mastercard)",
  bank_transfer: "تحويل بنكي",
};

const REFUND_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  requested: { text: "قيد المراجعة", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  approved:  { text: "تمت الموافقة", color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  rejected:  { text: "مرفوض",       color: "#ef4444", bg: "rgba(239,68,68,.12)" },
  refunded:  { text: "تم الاسترجاع ✓", color: "#10b981", bg: "rgba(16,185,129,.12)" },
};

function fmt(s: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return s; }
}

export default function BillingPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const t = {
    bg: dark ? "#0a0a0a" : "#f4f4f5",
    panel: dark ? "#0f0f0f" : "#fff",
    border: dark ? "#1f1f1f" : "#e4e4e7",
    border2: dark ? "#2a2a2a" : "#d4d4d8",
    text: dark ? "#fff" : "#09090b",
    text2: dark ? "#a1a1aa" : "#52525b",
    muted: dark ? "#71717a" : "#71717a",
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await portalFetch("/refunds");
      const j = await r.json();
      if (j.ok) setOrders(j.orders);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submitRefund = async () => {
    if (!openOrder) return;
    setErr(""); setSubmitting(true);
    try {
      const r = await portalFetch("/refunds", {
        method: "POST",
        body: JSON.stringify({ order_id: openOrder.id, reason }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الإرسال");
      setOpenOrder(null); setReason("");
      setOkMsg("تم استلام طلب الاسترجاع — سيراجعه فريق الإدارة قريباً");
      setTimeout(() => setOkMsg(""), 5000);
      await load();
    } catch (e) { setErr(String(e).replace("Error: ", "")); }
    setSubmitting(false);
  };

  return (
    <PortalShell>
      <div style={{ maxWidth: 900, margin: "0 auto", direction: "rtl" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: t.panel, border: `1px solid ${t.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Receipt size={20} color={t.text} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: t.text, margin: 0 }}>الفواتير والاسترجاع</h1>
            <p style={{ fontSize: 12, color: t.muted, margin: "4px 0 0" }}>
              مدفوعاتك، حالة الاشتراك، وطلبات استرجاع المبلغ
            </p>
          </div>
        </div>

        {okMsg && (
          <div style={{
            padding: "12px 14px", borderRadius: 12, marginBottom: 14,
            background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.3)",
            color: "#10b981", fontSize: 13, fontWeight: 600,
          }}>
            ✓ {okMsg}
          </div>
        )}

        <div style={{
          padding: 14, borderRadius: 12, marginBottom: 18,
          background: t.panel, border: `1px solid ${t.border}`,
          fontSize: 12, color: t.text2, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, color: t.text, marginBottom: 6 }}>قبل طلب الاسترجاع:</div>
          • سياسة الاسترجاع تطبّق على الطلبات المدفوعة فقط.<br />
          • يراجع فريقنا الطلب يدوياً للتأكد من الأهلية، وقد يستغرق ذلك حتى 3 أيام عمل.<br />
          • في حال الموافقة، يُعاد المبلغ لنفس وسيلة الدفع المستخدمة.
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", padding: 40, color: t.muted }}>
            <Loader2 size={18} className="animate-spin" /> جاري التحميل...
          </div>
        ) : orders.length === 0 ? (
          <div style={{
            padding: 40, borderRadius: 12, textAlign: "center",
            background: t.panel, border: `1px solid ${t.border}`, color: t.muted, fontSize: 13,
          }}>
            لا يوجد فواتير سابقة
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {orders.map(o => {
              const refund = o.refund_status ? REFUND_LABEL[o.refund_status] : null;
              const canRequestRefund = o.status === "paid" && (!o.refund_status || o.refund_status === "rejected");
              return (
                <div key={o.id} style={{
                  padding: 14, borderRadius: 12,
                  background: t.panel, border: `1px solid ${t.border}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, color: t.text, fontSize: 14 }}>
                          {o.store_products?.name || "اشتراك"}
                        </span>
                        <StatusBadge status={o.status} />
                        {refund && (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                            background: refund.bg, color: refund.color,
                          }}>
                            استرجاع: {refund.text}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 12, color: t.muted, flexWrap: "wrap" }}>
                        <span style={{ color: t.text, fontWeight: 700 }}>{o.amount} ر.س</span>
                        {o.payment_gateway && <span>• {GATEWAY_LABEL[o.payment_gateway] || o.payment_gateway}</span>}
                        <span>• {fmt(o.paid_at || o.created_at)}</span>
                      </div>
                      {o.refund_reason && (
                        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: t.bg, fontSize: 12, color: t.text2 }}>
                          <strong style={{ color: t.text }}>سببك:</strong> {o.refund_reason}
                        </div>
                      )}
                      {o.refund_admin_notes && (
                        <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8, background: t.bg, fontSize: 12, color: t.text2 }}>
                          <strong style={{ color: t.text }}>رد الإدارة:</strong> {o.refund_admin_notes}
                        </div>
                      )}
                    </div>
                    {canRequestRefund && (
                      <button
                        onClick={() => { setOpenOrder(o); setReason(""); setErr(""); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "8px 12px", borderRadius: 10,
                          background: dark ? "#1a1a1a" : "#f4f4f5",
                          border: `1px solid ${t.border2}`,
                          color: t.text, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        <RotateCcw size={13} /> طلب استرجاع
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {openOrder && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={() => setOpenOrder(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 480, background: t.panel,
            borderRadius: 16, border: `1px solid ${t.border}`, padding: 18, direction: "rtl",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ color: t.text, fontWeight: 800, fontSize: 16, margin: 0 }}>طلب استرجاع المبلغ</h3>
              <button onClick={() => setOpenOrder(null)} style={{
                width: 30, height: 30, borderRadius: 8, background: "transparent",
                border: "none", cursor: "pointer", color: t.muted,
              }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: t.bg, fontSize: 12, color: t.text2 }}>
              <div><strong style={{ color: t.text }}>الطلب:</strong> {openOrder.store_products?.name}</div>
              <div><strong style={{ color: t.text }}>المبلغ:</strong> {openOrder.amount} ر.س</div>
            </div>
            <label style={{ display: "block", fontSize: 12, color: t.text2, fontWeight: 700, marginBottom: 6 }}>
              سبب طلب الاسترجاع *
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              placeholder="اشرح سبب رغبتك في الاسترجاع بشكل واضح..."
              style={{
                width: "100%", padding: 12, borderRadius: 10,
                background: t.bg, border: `1px solid ${t.border}`, color: t.text,
                fontSize: 13, resize: "none", fontFamily: "inherit",
              }}
            />
            {err && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{err}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={() => setOpenOrder(null)} style={{
                padding: "10px 14px", borderRadius: 10,
                background: "transparent", border: `1px solid ${t.border}`,
                color: t.text2, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>إلغاء</button>
              <button onClick={submitRefund} disabled={submitting || reason.trim().length < 10} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 16px", borderRadius: 10,
                background: dark ? "#fff" : "#09090b",
                color: dark ? "#0a0a0a" : "#fff",
                border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
                opacity: submitting || reason.trim().length < 10 ? 0.5 : 1,
              }}>
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                إرسال الطلب
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { text: string; color: string; bg: string; icon: any }> = {
    paid:      { text: "مدفوع",   color: "#10b981", bg: "rgba(16,185,129,.12)", icon: CheckCircle2 },
    pending:   { text: "قيد الدفع", color: "#f59e0b", bg: "rgba(245,158,11,.12)", icon: Clock },
    cancelled: { text: "ملغي",    color: "#71717a", bg: "rgba(113,113,122,.15)", icon: XCircle },
    failed:    { text: "فشل",     color: "#ef4444", bg: "rgba(239,68,68,.12)", icon: AlertCircle },
    refunded:  { text: "مسترجع",  color: "#3b82f6", bg: "rgba(59,130,246,.12)", icon: RotateCcw },
  };
  const e = m[status] || m.pending;
  const Icon = e.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
      background: e.bg, color: e.color,
    }}>
      <Icon size={11} /> {e.text}
    </span>
  );
}
