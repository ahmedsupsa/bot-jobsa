"use client";

import Shell from "@/components/shell";
import { useEffect, useState } from "react";
import {
  TrendingUp, DollarSign, ShoppingCart, BarChart3, RefreshCw,
  ArrowUpRight, ArrowDownRight, Minus, Users, Wallet,
  PieChart, FileSpreadsheet, AlertCircle, CheckCircle2, Clock, Target, FileDown,
} from "lucide-react";

type Summary = {
  grossRevenue: number; directRevenue: number; affiliateRevenue: number;
  totalCommissionsAccrued: number; pendingCommissions: number; paidCommissions: number;
  netRevenue: number; monthlyGross: number; lastMonthGross: number;
  paidCount: number; directCount: number; affiliateCount: number; pendingOrdersCount: number;
  avgOrder: number; paidOut: number; pendingPayout: number; commissionRate: number;
  tamaraGross: number; tamaraFees: number; tamaraNet: number; tamaraCount: number;
  tamaraVariable: number; tamaraFixed: number; tamaraVat: number;
  tamaraVariableRate: number; tamaraFixedFee: number; tamaraVatRate: number;
  bankCount: number; bankGross: number; streampayCount: number; streampayGross: number;
};
type TamaraOrder = {
  id: string; user_name?: string; user_email?: string; amount: number; paid_at?: string;
  product_name: string; fee_variable: number; fee_fixed: number; fee_vat: number;
  fee_total: number; net_received: number;
};

type ProductStat = { name: string; direct: number; affiliate: number; commissions: number; count: number };
type ChartPoint = { month: string; direct: number; affiliate: number; commissions: number; net: number };
type DirectOrder = { id: string; user_name?: string; user_email?: string; amount?: number; paid_at?: string; product_name: string; payment_gateway?: string | null };
type AffOrder = DirectOrder & { ref_code?: string; commission: number; commission_status: string; affiliate_name: string; net: number };

const GATEWAY_AR: Record<string, string> = { tamara: "تمارا", streampay: "StreamPay", bank_transfer: "تحويل بنكي" };

function buildInvoiceUrl(o: { id: string; user_name?: string; user_email?: string; product_name: string; amount?: number; paid_at?: string; payment_gateway?: string | null }) {
  const year = o.paid_at ? new Date(o.paid_at).getFullYear() : new Date().getFullYear();
  const invNum = `JBT-${year}-${o.id.slice(0, 8).toUpperCase()}`;
  const gw = GATEWAY_AR[o.payment_gateway || ""] || o.payment_gateway || "";
  const params = new URLSearchParams({
    client:  o.user_name  || "",
    email:   o.user_email || "",
    inv:     invNum,
    date:    o.paid_at ? o.paid_at.split("T")[0] : new Date().toISOString().split("T")[0],
    plan:    o.product_name,
    amount:  String(o.amount ?? ""),
    gateway: gw,
  });
  return `/invoice.html?${params.toString()}`;
}

function fmt(n: number) {
  return Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

async function patchOrderAmount(id: string, amount: number): Promise<boolean> {
  try {
    const r = await fetch(`/api/admin/store/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ amount }),
    });
    const j = await r.json();
    return j.ok === true;
  } catch {
    return false;
  }
}

function AmountCell({ id, amount, onSaved }: { id: string; amount: number; onSaved: (id: string, newAmount: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(amount));
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) { setVal(String(amount)); setEditing(false); return; }
    if (n === amount) { setEditing(false); return; }
    setSaving(true);
    const ok = await patchOrderAmount(id, n);
    setSaving(false);
    if (ok) onSaved(id, n);
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          autoFocus
          type="number"
          step="0.01"
          min="0"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(String(amount)); setEditing(false); } }}
          onBlur={save}
          disabled={saving}
          style={{
            width: 90, padding: "3px 7px", fontSize: 12, fontWeight: 700,
            border: "1px solid var(--border2)", borderRadius: 6,
            background: "var(--surface2)", color: "var(--text)",
            outline: "none",
          }}
        />
        <span style={{ fontSize: 10, color: "var(--text4)" }}>ر.س</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setVal(String(amount)); setEditing(true); }}
      title="انقر لتعديل المبلغ"
      style={{
        background: "none", border: "none", cursor: "pointer", padding: 0,
        display: "flex", alignItems: "center", gap: 5, color: "var(--text)", fontWeight: 700,
      }}
    >
      {fmt(amount)}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        style={{ color: "var(--text4)", flexShrink: 0 }}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
  );
}

function StatCard({ label, value, sub, icon: Icon, trend, big = false }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  trend?: "up" | "down" | "neutral"; big?: boolean;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor = trend === "up" ? "var(--success-fg)" : trend === "down" ? "var(--alert-fg)" : "var(--text4)";
  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: 16, padding: "20px 22px",
      display: "flex", flexDirection: "column", gap: 12,
      boxShadow: "var(--shadow)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "var(--text3)", fontSize: 12, fontWeight: 500 }}>{label}</span>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: "var(--surface2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={17} color="var(--text3)" />
        </div>
      </div>
      <div style={{ fontSize: big ? 30 : 24, fontWeight: 900, color: "var(--text)", lineHeight: 1.1 }}>{value}</div>
      {sub && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {trend && <TrendIcon size={12} color={trendColor} />}
          <span style={{ color: trend ? trendColor : "var(--text4)", fontSize: 11 }}>{sub}</span>
        </div>
      )}
    </div>
  );
}

function StackedBarChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(...data.map(d => d.direct + d.affiliate), 1);
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <h3 style={{ color: "var(--text)", fontSize: 15, fontWeight: 700, margin: 0 }}>الإيرادات الشهرية (آخر 6 أشهر)</h3>
        <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text3)" }}>
            <span style={{ width: 10, height: 10, background: "var(--text)", borderRadius: 2 }} /> مبيعات مباشرة
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text3)" }}>
            <span style={{ width: 10, height: 10, background: "var(--text3)", borderRadius: 2 }} /> مع عمولة
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 160 }}>
        {data.map((d, i) => {
          const total = d.direct + d.affiliate;
          const totalH = Math.max((total / max) * 140, total > 0 ? 12 : 2);
          const directH = total > 0 ? (d.direct / total) * totalH : 0;
          const affH = total > 0 ? (d.affiliate / total) * totalH : 0;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--text3)", fontSize: 10, fontWeight: 700 }}>{total > 0 ? fmt(total) : ""}</span>
              <div title={`${d.month}: مباشر ${fmt(d.direct)} + عمولة ${fmt(d.affiliate)} ر.س`}
                style={{ width: "100%", height: totalH, borderRadius: 6, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div style={{ height: affH, background: "var(--text3)" }} />
                <div style={{ height: directH, background: "var(--text)" }} />
                {total === 0 && <div style={{ height: "100%", background: "var(--surface2)" }} />}
              </div>
              <span style={{ color: "var(--text4)", fontSize: 10 }}>{d.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FinancePage() {
  const [data, setData] = useState<{ summary: Summary; byProduct: ProductStat[]; chart: ChartPoint[]; directOrders: DirectOrder[]; affiliateOrders: AffOrder[]; tamaraOrders: TamaraOrder[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "direct" | "affiliate" | "tamara">("overview");
  const [exporting, setExporting] = useState(false);
  const [amountOverrides, setAmountOverrides] = useState<Record<string, number>>({});

  function handleAmountSaved(id: string, newAmount: number) {
    setAmountOverrides(prev => ({ ...prev, [id]: newAmount }));
  }

  function resolveAmount(id: string, original?: number): number {
    return amountOverrides[id] ?? (original || 0);
  }

  const load = () => {
    setLoading(true);
    fetch("/api/admin/finance", { credentials: "include" })
      .then(r => r.json())
      .then(j => { if (j.ok) setData(j); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/finance/export", { credentials: "include" });
      if (!res.ok) { alert("فشل تصدير الملف"); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jobbots-financial-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch { alert("خطأ في الاتصال"); }
    finally { setExporting(false); }
  }

  const monthChange = data && data.summary.lastMonthGross > 0
    ? (((data.summary.monthlyGross - data.summary.lastMonthGross) / data.summary.lastMonthGross) * 100).toFixed(1)
    : null;

  return (
    <Shell>
      <div dir="rtl" style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ color: "var(--text)", fontSize: 24, fontWeight: 900, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <Wallet size={22} color="var(--text)" /> المركز المالي
            </h1>
            <p style={{ color: "var(--text4)", fontSize: 13, margin: "5px 0 0" }}>تفصيل المبيعات والعمولات بشفافية كاملة</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleExport} disabled={exporting || !data}
              style={{
                background: "var(--accent)", color: "var(--accent-fg)", border: "none",
                borderRadius: 10, padding: "10px 16px", cursor: exporting ? "wait" : "pointer",
                display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700,
                opacity: exporting || !data ? 0.6 : 1,
              }}>
              {exporting ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <FileSpreadsheet size={14} />}
              {exporting ? "جاري التصدير..." : "تصدير Excel (English)"}
            </button>
            <button onClick={load} disabled={loading}
              style={{
                background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 10,
                padding: "10px 14px", color: "var(--text3)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, fontSize: 13,
              }}>
              <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              تحديث
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div style={{ color: "var(--text4)", textAlign: "center", padding: "60px 20px" }}>جاري التحميل...</div>
        ) : data ? (
          <>
            {/* Top: Net Revenue Hero Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 14 }}>
              <StatCard
                label="إجمالي المبيعات (Gross)"
                value={`${fmt(data.summary.grossRevenue)} ر.س`}
                sub={`${data.summary.paidCount} طلب مدفوع`}
                icon={DollarSign} big
              />
              <StatCard
                label="صافي الإيراد بعد العمولة (Net)"
                value={`${fmt(data.summary.netRevenue)} ر.س`}
                sub="ما تبقّى لجوبوتس"
                icon={Target} big
              />
              <StatCard
                label="إجمالي العمولات المستحقة"
                value={`${fmt(data.summary.totalCommissionsAccrued)} ر.س`}
                sub={`${(data.summary.commissionRate * 100).toFixed(0)}% من المبيعات بعمولة`}
                icon={Wallet} big
              />
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid var(--border)" }}>
              {[
                { k: "overview", l: "نظرة عامة", i: PieChart },
                { k: "direct", l: `مبيعات مباشرة (${data.summary.directCount})`, i: CheckCircle2 },
                { k: "affiliate", l: `مبيعات بعمولة (${data.summary.affiliateCount})`, i: Users },
                { k: "tamara", l: `تمارا (${data.summary.tamaraCount})`, i: Wallet },
              ].map(({ k, l, i: I }) => (
                <button key={k} onClick={() => setTab(k as any)}
                  style={{
                    background: "transparent", border: "none",
                    color: tab === k ? "var(--text)" : "var(--text4)",
                    padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                    borderBottom: tab === k ? "2px solid var(--text)" : "2px solid transparent",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                  <I size={14} /> {l}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <>
                {/* Secondary stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 18 }}>
                  <StatCard label="مبيعات مباشرة (بدون عمولة)" value={`${fmt(data.summary.directRevenue)} ر.س`}
                    sub={`${data.summary.directCount} طلب — تبقى 100%`} icon={CheckCircle2} />
                  <StatCard label="مبيعات عبر مسوّقين" value={`${fmt(data.summary.affiliateRevenue)} ر.س`}
                    sub={`${data.summary.affiliateCount} طلب`} icon={Users} />
                  <StatCard label="إيراد هذا الشهر" value={`${fmt(data.summary.monthlyGross)} ر.س`}
                    sub={monthChange !== null ? `${parseFloat(monthChange) >= 0 ? "+" : ""}${monthChange}% عن الشهر الماضي` : "—"}
                    icon={TrendingUp}
                    trend={monthChange !== null ? (parseFloat(monthChange) >= 0 ? "up" : "down") : "neutral"} />
                  <StatCard label="متوسط قيمة الطلب" value={`${fmt(data.summary.avgOrder)} ر.س`}
                    sub={`${data.summary.pendingOrdersCount} طلب معلّق`} icon={ShoppingCart} />
                </div>

                {/* Commission cashflow */}
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)",
                  borderRadius: 16, padding: 22, marginBottom: 18 }}>
                  <h3 style={{ color: "var(--text)", fontSize: 15, fontWeight: 700, margin: "0 0 16px",
                    display: "flex", alignItems: "center", gap: 8 }}>
                    <Wallet size={16} color="var(--text3)" /> الحركة المالية لبرنامج الربح
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                    <CashRow icon={<Clock size={14} color="var(--text3)" />} label="عمولات معلّقة (لم تُسحب)"
                      value={`${fmt(data.summary.pendingCommissions)} ر.س`} />
                    <CashRow icon={<CheckCircle2 size={14} color="var(--text3)" />} label="عمولات مدفوعة"
                      value={`${fmt(data.summary.paidCommissions)} ر.س`} />
                    <CashRow icon={<AlertCircle size={14} color="var(--text3)" />} label="طلبات سحب معلّقة"
                      value={`${fmt(data.summary.pendingPayout)} ر.س`} />
                    <CashRow icon={<DollarSign size={14} color="var(--text3)" />} label="إجمالي ما تم تحويله"
                      value={`${fmt(data.summary.paidOut)} ر.س`} />
                  </div>
                </div>

                {/* Chart + By Product */}
                <div className="finance-chart-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, marginBottom: 18, alignItems: "start" }}>
                  <StackedBarChart data={data.chart} />
                  <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
                    <h3 style={{ color: "var(--text)", fontSize: 15, fontWeight: 700, margin: "0 0 18px", display: "flex", alignItems: "center", gap: 8 }}>
                      <BarChart3 size={16} color="var(--text3)" /> حسب المنتج
                    </h3>
                    {data.byProduct.length === 0 ? (
                      <p style={{ color: "var(--text4)", fontSize: 13 }}>لا يوجد بيانات</p>
                    ) : data.byProduct.map((p, i) => {
                      const total = p.direct + p.affiliate;
                      const max = Math.max(...data.byProduct.map(x => x.direct + x.affiliate), 1);
                      return (
                        <div key={i} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ color: "var(--text2)", fontSize: 12 }}>{p.name}</span>
                            <span style={{ color: "var(--text)", fontSize: 12, fontWeight: 700 }}>{fmt(total)} ر.س</span>
                          </div>
                          <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--surface2)" }}>
                            <div style={{ background: "var(--text)", width: `${(p.direct / max) * 100}%` }} title={`مباشر ${fmt(p.direct)}`} />
                            <div style={{ background: "var(--text3)", width: `${(p.affiliate / max) * 100}%` }} title={`عمولة ${fmt(p.affiliate)}`} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 10, color: "var(--text4)" }}>
                            <span>{p.count} طلب</span>
                            {p.commissions > 0 && <span>− {fmt(p.commissions)} عمولة</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {tab === "direct" && (
              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <CheckCircle2 size={18} color="var(--text3)" />
                  <h3 style={{ color: "var(--text)", fontSize: 15, fontWeight: 700, margin: 0 }}>المبيعات المباشرة (بدون عمولة)</h3>
                </div>
                <p style={{ color: "var(--text4)", fontSize: 12, margin: "0 0 18px" }}>طلبات بدون كود إحالة — يحتفظ النظام بكامل المبلغ</p>
                <OrdersTable rows={data.directOrders.map(o => ({
                  id: o.id, user_name: o.user_name, user_email: o.user_email, product_name: o.product_name,
                  amount: resolveAmount(o.id, o.amount), paid_at: o.paid_at, invoiceUrl: buildInvoiceUrl(o),
                }))} totalLabel="إجمالي مباشر" totalValue={data.summary.directRevenue}
                onAmountSaved={handleAmountSaved} />
              </div>
            )}

            {tab === "tamara" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Tamara Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <StatCard label="إجمالي مبيعات تمارا"
                    value={`${fmt(data.summary.tamaraGross)} ر.س`}
                    sub={`${data.summary.tamaraCount} طلب مدفوع`}
                    icon={DollarSign} big />
                  <StatCard label="إجمالي رسوم تمارا (مع الضريبة)"
                    value={`${fmt(data.summary.tamaraFees)} ر.س`}
                    sub="تُخصم قبل التحويل لحسابك"
                    icon={Wallet} big />
                  <StatCard label="الصافي المستلم من تمارا"
                    value={`${fmt(data.summary.tamaraNet)} ر.س`}
                    sub="بعد خصم الرسوم والضريبة"
                    icon={Target} big />
                </div>

                {/* Fee Formula Explainer */}
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)",
                  borderRadius: 16, padding: 22 }}>
                  <h3 style={{ color: "var(--text)", fontSize: 15, fontWeight: 700, margin: "0 0 14px",
                    display: "flex", alignItems: "center", gap: 8 }}>
                    <PieChart size={16} color="var(--text3)" /> طريقة احتساب رسوم تمارا
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
                    <CashRow icon={<TrendingUp size={14} color="var(--text3)" />}
                      label={`رسوم متغيرة (${(data.summary.tamaraVariableRate * 100).toFixed(2)}%)`}
                      value={`${fmt(data.summary.tamaraVariable)} ر.س`} />
                    <CashRow icon={<DollarSign size={14} color="var(--text3)" />}
                      label={`رسوم ثابتة (${data.summary.tamaraFixedFee} ر.س / طلب)`}
                      value={`${fmt(data.summary.tamaraFixed)} ر.س`} />
                    <CashRow icon={<AlertCircle size={14} color="var(--text3)" />}
                      label={`ضريبة القيمة المضافة (${(data.summary.tamaraVatRate * 100).toFixed(0)}%)`}
                      value={`${fmt(data.summary.tamaraVat)} ر.س`} />
                  </div>
                  <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px",
                    fontSize: 12, color: "var(--text3)", lineHeight: 1.9 }}>
                    <span style={{ color: "var(--text)", fontWeight: 700 }}>الصيغة:</span>{" "}
                    الرسوم = (المبلغ × {(data.summary.tamaraVariableRate * 100).toFixed(2)}% + {data.summary.tamaraFixedFee}) × (1 + {(data.summary.tamaraVatRate * 100).toFixed(0)}%)
                    <br />
                    <span style={{ color: "var(--text3)" }}>أمثلة:</span>{" "}
                    <span style={{ color: "var(--text)" }}>50 ر.س → ~5.74 رسوم</span> ·{" "}
                    <span style={{ color: "var(--text)" }}>70 ر.س → ~7.35 رسوم</span> ·{" "}
                    <span style={{ color: "var(--text)" }}>90 ر.س → ~8.96 رسوم</span>
                  </div>
                </div>

                {/* Tamara Orders Table */}
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <Wallet size={18} color="var(--text3)" />
                    <h3 style={{ color: "var(--text)", fontSize: 15, fontWeight: 700, margin: 0 }}>تفصيل طلبات تمارا</h3>
                  </div>
                  <p style={{ color: "var(--text4)", fontSize: 12, margin: "0 0 18px" }}>
                    كل صف: المبلغ • رسوم متغيرة • رسوم ثابتة • ضريبة • إجمالي الرسوم • الصافي المستلم
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ color: "var(--text4)", borderBottom: "1px solid var(--border)" }}>
                          <th style={th}>العميل</th>
                          <th style={th}>المنتج</th>
                          <th style={{ ...th, textAlign: "left" }}>المبلغ</th>
                          <th style={{ ...th, textAlign: "left" }}>رسوم متغيرة</th>
                          <th style={{ ...th, textAlign: "left" }}>رسوم ثابتة</th>
                          <th style={{ ...th, textAlign: "left" }}>ضريبة</th>
                          <th style={{ ...th, textAlign: "left" }}>إجمالي رسوم</th>
                          <th style={{ ...th, textAlign: "left" }}>الصافي</th>
                          <th style={th}>تاريخ الدفع</th>
                          <th style={th}>فاتورة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.tamaraOrders.length === 0 ? (
                          <tr><td colSpan={10} style={{ color: "var(--text4)", textAlign: "center", padding: 32 }}>لا توجد طلبات تمارا مدفوعة بعد</td></tr>
                        ) : data.tamaraOrders.map(o => (
                          <tr key={o.id} style={{ borderBottom: "1px solid var(--border)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <td style={td}>{o.user_name || o.user_email || "—"}</td>
                            <td style={td}>{o.product_name}</td>
                            <td style={{ ...td, textAlign: "left" }}>
                              <AmountCell id={o.id} amount={resolveAmount(o.id, o.amount)} onSaved={handleAmountSaved} />
                            </td>
                            <td style={{ ...td, textAlign: "left", color: "var(--text3)" }}>− {fmt(o.fee_variable)}</td>
                            <td style={{ ...td, textAlign: "left", color: "var(--text3)" }}>− {fmt(o.fee_fixed)}</td>
                            <td style={{ ...td, textAlign: "left", color: "var(--text3)" }}>− {fmt(o.fee_vat)}</td>
                            <td style={{ ...td, textAlign: "left", color: "var(--text2)", fontWeight: 700 }}>− {fmt(o.fee_total)}</td>
                            <td style={{ ...td, textAlign: "left", color: "var(--text)", fontWeight: 800 }}>{fmt(o.net_received)}</td>
                            <td style={{ ...td, color: "var(--text4)" }}>{fmtDate(o.paid_at)}</td>
                            <td style={{ ...td, textAlign: "center" }}>
                              <a href={buildInvoiceUrl({ ...o, payment_gateway: "tamara" })} target="_blank" rel="noopener noreferrer"
                                title="تحميل الفاتورة"
                                style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 30, height: 30, borderRadius: 8,
                                  background: "var(--surface2)", border: "1px solid var(--border2)",
                                  color: "var(--text3)", textDecoration: "none",
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg2)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--text3)"; }}
                              >
                                <FileDown size={14} />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "var(--surface2)" }}>
                          <td colSpan={2} style={{ ...td, color: "var(--text)", fontWeight: 700 }}>الإجماليات</td>
                          <td style={{ ...td, textAlign: "left", color: "var(--text)", fontWeight: 800 }}>{fmt(data.summary.tamaraGross)}</td>
                          <td style={{ ...td, textAlign: "left", color: "var(--text3)", fontWeight: 800 }}>− {fmt(data.summary.tamaraVariable)}</td>
                          <td style={{ ...td, textAlign: "left", color: "var(--text3)", fontWeight: 800 }}>− {fmt(data.summary.tamaraFixed)}</td>
                          <td style={{ ...td, textAlign: "left", color: "var(--text3)", fontWeight: 800 }}>− {fmt(data.summary.tamaraVat)}</td>
                          <td style={{ ...td, textAlign: "left", color: "var(--text2)", fontWeight: 800 }}>− {fmt(data.summary.tamaraFees)}</td>
                          <td style={{ ...td, textAlign: "left", color: "var(--text)", fontWeight: 800 }}>{fmt(data.summary.tamaraNet)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === "affiliate" && (
              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <Users size={18} color="var(--text3)" />
                  <h3 style={{ color: "var(--text)", fontSize: 15, fontWeight: 700, margin: 0 }}>المبيعات عبر مسوّقين (مع عمولة 10%)</h3>
                </div>
                <p style={{ color: "var(--text4)", fontSize: 12, margin: "0 0 18px" }}>كل صف يبيّن: المبلغ • العمولة المخصومة • الصافي للنظام</p>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: "var(--text4)", borderBottom: "1px solid var(--border)" }}>
                        <th style={th}>العميل</th>
                        <th style={th}>المسوّق</th>
                        <th style={th}>الكود</th>
                        <th style={th}>المنتج</th>
                        <th style={{ ...th, textAlign: "left" }}>المبلغ</th>
                        <th style={{ ...th, textAlign: "left" }}>العمولة (10%)</th>
                        <th style={{ ...th, textAlign: "left" }}>الصافي</th>
                        <th style={th}>الحالة</th>
                        <th style={th}>تاريخ الدفع</th>
                        <th style={th}>فاتورة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.affiliateOrders.length === 0 ? (
                        <tr><td colSpan={10} style={{ color: "var(--text4)", textAlign: "center", padding: 32 }}>لا توجد مبيعات عبر مسوّقين بعد</td></tr>
                      ) : data.affiliateOrders.map(o => (
                        <tr key={o.id} style={{ borderBottom: "1px solid var(--border)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <td style={td}>{o.user_name || "—"}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{o.affiliate_name}</td>
                          <td style={td}><code style={{ background: "var(--surface2)", padding: "2px 6px", borderRadius: 4, color: "var(--text2)", fontSize: 11 }}>{o.ref_code}</code></td>
                          <td style={td}>{o.product_name}</td>
                          <td style={{ ...td, textAlign: "left" }}>
                            <AmountCell id={o.id} amount={resolveAmount(o.id, o.amount)} onSaved={handleAmountSaved} />
                          </td>
                          <td style={{ ...td, textAlign: "left", color: "var(--text3)", fontWeight: 700 }}>− {fmt(o.commission)}</td>
                          <td style={{ ...td, textAlign: "left", color: "var(--text)", fontWeight: 700 }}>{fmt(resolveAmount(o.id, o.amount) - o.commission)}</td>
                          <td style={td}>
                            <span style={{
                              padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                              background: o.commission_status === "paid" ? "var(--success-bg)" : "var(--alert-bg)",
                              color: o.commission_status === "paid" ? "var(--success-fg)" : "var(--alert-fg)",
                              border: `1px solid ${o.commission_status === "paid" ? "var(--success-border)" : "var(--alert-border)"}`,
                            }}>{o.commission_status === "paid" ? "مدفوعة" : "معلّقة"}</span>
                          </td>
                          <td style={{ ...td, color: "var(--text4)" }}>{fmtDate(o.paid_at)}</td>
                          <td style={{ ...td, textAlign: "center" }}>
                            <a href={buildInvoiceUrl(o)} target="_blank" rel="noopener noreferrer"
                              title="تحميل الفاتورة"
                              style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                width: 30, height: 30, borderRadius: 8,
                                background: "var(--surface2)", border: "1px solid var(--border2)",
                                color: "var(--text3)", textDecoration: "none",
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg2)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--text3)"; }}
                            >
                              <FileDown size={14} />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--surface2)" }}>
                        <td colSpan={4} style={{ ...td, color: "var(--text)", fontWeight: 700 }}>الإجماليات</td>
                        <td style={{ ...td, textAlign: "left", color: "var(--text)", fontWeight: 800 }}>{fmt(data.summary.affiliateRevenue)}</td>
                        <td style={{ ...td, textAlign: "left", color: "var(--text3)", fontWeight: 800 }}>− {fmt(data.summary.totalCommissionsAccrued)}</td>
                        <td style={{ ...td, textAlign: "left", color: "var(--text)", fontWeight: 800 }}>{fmt(data.summary.affiliateRevenue - data.summary.totalCommissionsAccrued)}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: "var(--text4)", textAlign: "center" }}>تعذّر تحميل البيانات</p>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .finance-chart-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </Shell>
  );
}

function CashRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", boxShadow: "var(--shadow)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text3)", fontSize: 11, marginBottom: 6, fontWeight: 600 }}>
        {icon} {label}
      </div>
      <div style={{ color: "var(--text)", fontSize: 17, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function OrdersTable({ rows, totalLabel, totalValue, onAmountSaved }: {
  rows: { id: string; user_name?: string; user_email?: string; product_name: string; amount?: number; paid_at?: string; invoiceUrl?: string }[];
  totalLabel: string; totalValue: number;
  onAmountSaved: (id: string, newAmount: number) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "var(--text4)", borderBottom: "1px solid var(--border)" }}>
            <th style={th}>العميل</th>
            <th style={th}>البريد</th>
            <th style={th}>المنتج</th>
            <th style={{ ...th, textAlign: "left" }}>المبلغ</th>
            <th style={th}>تاريخ الدفع</th>
            <th style={th}>فاتورة</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} style={{ color: "var(--text4)", textAlign: "center", padding: 32 }}>لا توجد طلبات</td></tr>
          ) : rows.map((o, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <td style={td}>{o.user_name || "—"}</td>
              <td style={{ ...td, color: "var(--text3)" }}>{o.user_email || "—"}</td>
              <td style={td}>{o.product_name}</td>
              <td style={{ ...td, textAlign: "left" }}>
                <AmountCell id={o.id} amount={o.amount || 0} onSaved={onAmountSaved} />
              </td>
              <td style={{ ...td, color: "var(--text4)" }}>{fmtDate(o.paid_at)}</td>
              <td style={{ ...td, textAlign: "center" }}>
                {o.invoiceUrl ? (
                  <a href={o.invoiceUrl} target="_blank" rel="noopener noreferrer"
                    title="تحميل الفاتورة"
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 30, height: 30, borderRadius: 8,
                      background: "var(--surface2)", border: "1px solid var(--border2)",
                      color: "var(--text3)", textDecoration: "none",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg2)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--text3)"; }}
                  >
                    <FileDown size={14} />
                  </a>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "var(--surface2)" }}>
            <td colSpan={3} style={{ ...td, color: "var(--text)", fontWeight: 700 }}>{totalLabel}</td>
            <td style={{ ...td, textAlign: "left", color: "var(--text)", fontWeight: 800, fontSize: 14 }}>{fmt(totalValue)} ر.س</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "right", padding: "10px 12px", fontWeight: 600, fontSize: 11 };
const td: React.CSSProperties = { padding: "10px 12px", color: "var(--text2)" };
