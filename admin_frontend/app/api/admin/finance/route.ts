import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  user_name?: string;
  user_email?: string;
  amount?: number;
  status: string;
  created_at: string;
  paid_at?: string;
  store_products?: { name: string; duration_days: number } | { name: string; duration_days: number }[] | null;
};

function getProduct(o: OrderRow): { name: string; duration_days: number } | null {
  if (!o.store_products) return null;
  if (Array.isArray(o.store_products)) return o.store_products[0] ?? null;
  return o.store_products;
}

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();

  const { data: rawOrders } = await supabase
    .from("store_orders")
    .select("id, user_name, user_email, amount, status, created_at, paid_at, store_products(name, duration_days)")
    .order("created_at", { ascending: false });

  const all: OrderRow[] = (rawOrders || []) as OrderRow[];
  const paid = all.filter(o => o.status === "paid");

  const totalRevenue = paid.reduce((s, o) => s + (o.amount || 0), 0);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenue = paid
    .filter(o => new Date(o.paid_at || o.created_at) >= thisMonthStart)
    .reduce((s, o) => s + (o.amount || 0), 0);

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthRevenue = paid
    .filter(o => {
      const d = new Date(o.paid_at || o.created_at);
      return d >= lastMonthStart && d < thisMonthStart;
    })
    .reduce((s, o) => s + (o.amount || 0), 0);

  const byProduct: Record<string, { name: string; revenue: number; count: number }> = {};
  paid.forEach(o => {
    const prod = getProduct(o);
    const name = prod?.name || "غير معروف";
    if (!byProduct[name]) byProduct[name] = { name, revenue: 0, count: 0 };
    byProduct[name].revenue += o.amount || 0;
    byProduct[name].count += 1;
  });

  const chart: { month: string; revenue: number; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = d.toLocaleDateString("ar-SA", { month: "short", year: "numeric" });
    const monthPaid = paid.filter(o => {
      const od = new Date(o.paid_at || o.created_at);
      return od >= d && od < end;
    });
    chart.push({ month: label, revenue: monthPaid.reduce((s, o) => s + (o.amount || 0), 0), count: monthPaid.length });
  }

  const recentOrders = paid.slice(0, 50).map(o => ({
    ...o,
    store_products: getProduct(o),
  }));

  return NextResponse.json({
    ok: true,
    summary: {
      totalRevenue,
      monthlyRevenue,
      lastMonthRevenue,
      paidCount: paid.length,
      pendingCount: all.filter(o => o.status === "pending").length,
      avgOrder: paid.length ? totalRevenue / paid.length : 0,
    },
    byProduct: Object.values(byProduct).sort((a, b) => b.revenue - a.revenue),
    chart,
    recentOrders,
  });
}
