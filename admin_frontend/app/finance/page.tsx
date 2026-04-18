"use client";

import Shell from "@/components/shell";
import { useEffect, useState } from "react";
import { TrendingUp, DollarSign, ShoppingCart, Clock, BarChart3, RefreshCw, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

type Summary = {
  totalRevenue: number;
  monthlyRevenue: number;
  lastMonthRevenue: number;
  paidCount: number;
  pendingCount: number;
  avgOrder: number;
};

type ProductStat = { name: string; revenue: number; count: number };
type ChartPoint = { month: string; revenue: number; count: number };
type Order = {
  id: string;
  user_name?: string;
  user_email?: string;
  amount?: number;
  paid_at?: string;
  store_products?: { name: string; duration_days: number };
};

function fmt(n: number) {
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

function StatCard({ label, value, sub, icon: Icon, trend }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  const trendColor = trend === "up" ? "#4ade80" : trend === "down" ? "#f87171" : "#888";
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 16, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#666", fontSize: 13 }}>{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color="#888" />
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>{value}</div>
      {sub && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <TrendIcon size={13} color={trendColor} />
          <span style={{ color: trendColor, fontSize: 12 }}>{sub}</span>
        </div>
      )}
    </div>
  );
}

function RevenueChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(...data.map(d => d.revenue), 1);
  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 16, padding: "24px" }}>
      <h3 style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 24px" }}>الإيرادات الشهرية (آخر 6 أشهر)</h3>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 140 }}>
        {data.map((d, i) => {
          const h = Math.max((d.revenue / max) * 120, d.revenue > 0 ? 8 : 2);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#666", fontSize: 11 }}>{d.revenue > 0 ? `${fmt(d.revenue)}` : ""}</span>
              <div
                title={`${d.month}: ${fmt(d.revenue)} ر.س`}
                style={{
                  width: "100%", height: h, borderRadius: 6,
                  background: d.revenue > 0 ? "linear-gradient(180deg,#a78bfa,#6d28d9)" : "#1a1a1a",
                  transition: "height 0.3s",
                }}
              />
              <span style={{ color: "#555", fontSize: 10, textAlign: "center" }}>{d.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FinancePage() {
  const [data, setData] = useState<{ summary: Summary; byProduct: ProductStat[]; chart: ChartPoint[]; recentOrders: Order[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/finance", { credentials: "include" })
      .then(r => r.json())
      .then(j => { if (j.ok) setData(j); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const monthChange = data
    ? data.summary.lastMonthRevenue > 0
      ? (((data.summary.monthlyRevenue - data.summary.lastMonthRevenue) / data.summary.lastMonthRevenue) * 100).toFixed(1)
      : null
    : null;

  return (
    <Shell>
      <div dir="rtl" style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: 0 }}>المالية</h1>
            <p style={{ color: "#555", fontSize: 13, margin: "4px 0 0" }}>ملخص الإيرادات والطلبات المدفوعة</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "8px 14px", color: "#888", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            تحديث
          </button>
        </div>

        {loading && !data ? (
          <div style={{ color: "#555", textAlign: "center", padding: 80 }}>جاري التحميل...</div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
              <StatCard
                label="إجمالي الإيرادات"
                value={`${fmt(data.summary.totalRevenue)} ر.س`}
                sub={`${data.summary.paidCount} طلب مدفوع`}
                icon={DollarSign}
                trend="neutral"
              />
              <StatCard
                label="إيرادات هذا الشهر"
                value={`${fmt(data.summary.monthlyRevenue)} ر.س`}
                sub={
                  monthChange !== null
                    ? `${parseFloat(monthChange) >= 0 ? "+" : ""}${monthChange}% مقارنة بالشهر الماضي`
                    : "لا يوجد بيانات الشهر الماضي"
                }
                icon={TrendingUp}
                trend={monthChange !== null ? (parseFloat(monthChange) >= 0 ? "up" : "down") : "neutral"}
              />
              <StatCard
                label="متوسط قيمة الطلب"
                value={`${fmt(data.summary.avgOrder)} ر.س`}
                sub={`${data.summary.pendingCount} طلب معلّق`}
                icon={ShoppingCart}
                trend="neutral"
              />
              <StatCard
                label="الشهر الماضي"
                value={`${fmt(data.summary.lastMonthRevenue)} ر.س`}
                icon={Clock}
                trend="neutral"
              />
            </div>

            {/* Chart + By Product */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, marginBottom: 24, alignItems: "start" }}>
              <RevenueChart data={data.chart} />
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 16, padding: "24px", minWidth: 240 }}>
                <h3 style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 18px", display: "flex", alignItems: "center", gap: 8 }}>
                  <BarChart3 size={16} color="#a78bfa" /> حسب المنتج
                </h3>
                {data.byProduct.length === 0 ? (
                  <p style={{ color: "#555", fontSize: 13 }}>لا يوجد بيانات</p>
                ) : data.byProduct.map((p, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#ccc", fontSize: 13 }}>{p.name}</span>
                      <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{fmt(p.revenue)} ر.س</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: "#555", fontSize: 11 }}>{p.count} طلب</span>
                    </div>
                    <div style={{ height: 4, background: "#1a1a1a", borderRadius: 2 }}>
                      <div style={{ height: "100%", borderRadius: 2, background: "#6d28d9", width: `${(p.revenue / (data.byProduct[0]?.revenue || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Paid Orders */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 16, padding: "24px" }}>
              <h3 style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 18px" }}>الطلبات المدفوعة</h3>
              {data.recentOrders.length === 0 ? (
                <p style={{ color: "#555", fontSize: 14, textAlign: "center", padding: 32 }}>لا يوجد طلبات مدفوعة بعد</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: "#555", borderBottom: "1px solid #222" }}>
                        <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 500 }}>العميل</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 500 }}>البريد</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 500 }}>المنتج</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 500 }}>المبلغ</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 500 }}>تاريخ الدفع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentOrders.map(o => (
                        <tr key={o.id} style={{ borderBottom: "1px solid #1a1a1a", transition: "background 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#161616")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "10px 12px", color: "#fff" }}>{o.user_name || "—"}</td>
                          <td style={{ padding: "10px 12px", color: "#888" }}>{o.user_email || "—"}</td>
                          <td style={{ padding: "10px 12px", color: "#ccc" }}>{o.store_products?.name || "—"}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ color: "#4ade80", fontWeight: 700 }}>{fmt(o.amount || 0)} ر.س</span>
                          </td>
                          <td style={{ padding: "10px 12px", color: "#555" }}>{o.paid_at ? fmtDate(o.paid_at) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: "#f87171", textAlign: "center" }}>تعذّر تحميل البيانات</p>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Shell>
  );
}
