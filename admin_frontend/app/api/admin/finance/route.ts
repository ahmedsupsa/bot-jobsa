import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const COMMISSION_RATE = 0.10;

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

type OrderRow = {
  id: string;
  user_name?: string;
  user_email?: string;
  amount?: number;
  status: string;
  ref_code?: string | null;
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
  const supabase = freshClient();

  const { data: rawOrders } = await supabase
    .from("store_orders")
    .select("id, user_name, user_email, amount, status, ref_code, created_at, paid_at, store_products(name, duration_days)")
    .order("created_at", { ascending: false });

  const all: OrderRow[] = (rawOrders || []) as OrderRow[];
  const paid = all.filter(o => o.status === "paid");

  // Split direct vs affiliate
  const directOrders = paid.filter(o => !o.ref_code);
  const affiliateOrders = paid.filter(o => !!o.ref_code);

  // Get commission rows + affiliate names for affiliate orders
  const orderIds = affiliateOrders.map(o => o.id);
  let referralsByOrder: Record<string, { commission: number; status: string; affiliate_user_id: string }> = {};
  let affiliateNames: Record<string, string> = {};

  if (orderIds.length > 0) {
    const { data: refs } = await supabase
      .from("affiliate_referrals")
      .select("order_id, commission, status, affiliate_user_id")
      .in("order_id", orderIds);
    (refs || []).forEach(r => {
      referralsByOrder[r.order_id] = {
        commission: Number(r.commission || 0),
        status: r.status,
        affiliate_user_id: r.affiliate_user_id,
      };
    });

    const affUserIds = Array.from(new Set((refs || []).map(r => r.affiliate_user_id)));
    if (affUserIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", affUserIds);
      (users || []).forEach(u => { affiliateNames[u.id] = u.full_name || ""; });
    }
  }

  // Withdrawals (commission actually paid out)
  const { data: withdrawals } = await supabase
    .from("affiliate_withdrawals")
    .select("id, user_id, amount, status, created_at, processed_at, method")
    .order("created_at", { ascending: false });

  const wList = withdrawals || [];
  const paidOut = wList.filter(w => w.status === "paid").reduce((s, w) => s + Number(w.amount || 0), 0);
  const pendingPayout = wList.filter(w => w.status === "pending").reduce((s, w) => s + Number(w.amount || 0), 0);

  // Sums
  const grossRevenue = paid.reduce((s, o) => s + (o.amount || 0), 0);
  const directRevenue = directOrders.reduce((s, o) => s + (o.amount || 0), 0);
  const affiliateRevenue = affiliateOrders.reduce((s, o) => s + (o.amount || 0), 0);
  const totalCommissionsAccrued = Object.values(referralsByOrder).reduce((s, r) => s + r.commission, 0);
  const pendingCommissions = Object.values(referralsByOrder).filter(r => r.status === "pending").reduce((s, r) => s + r.commission, 0);
  const paidCommissions = Object.values(referralsByOrder).filter(r => r.status === "paid").reduce((s, r) => s + r.commission, 0);
  const netRevenue = grossRevenue - totalCommissionsAccrued;

  // Monthly chart
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const monthlyGross = paid.filter(o => new Date(o.paid_at || o.created_at) >= thisMonthStart).reduce((s, o) => s + (o.amount || 0), 0);
  const lastMonthGross = paid.filter(o => {
    const d = new Date(o.paid_at || o.created_at);
    return d >= lastMonthStart && d < thisMonthStart;
  }).reduce((s, o) => s + (o.amount || 0), 0);

  const chart: { month: string; direct: number; affiliate: number; commissions: number; net: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = d.toLocaleDateString("ar-SA", { month: "short", year: "numeric" });
    const monthPaid = paid.filter(o => {
      const od = new Date(o.paid_at || o.created_at);
      return od >= d && od < end;
    });
    const direct = monthPaid.filter(o => !o.ref_code).reduce((s, o) => s + (o.amount || 0), 0);
    const affiliate = monthPaid.filter(o => !!o.ref_code).reduce((s, o) => s + (o.amount || 0), 0);
    const commissions = monthPaid.filter(o => !!o.ref_code).reduce((s, o) => s + (referralsByOrder[o.id]?.commission || 0), 0);
    chart.push({ month: label, direct, affiliate, commissions, net: direct + affiliate - commissions });
  }

  // By product (with split)
  const byProduct: Record<string, { name: string; direct: number; affiliate: number; commissions: number; count: number }> = {};
  paid.forEach(o => {
    const prod = getProduct(o);
    const name = prod?.name || "غير معروف";
    if (!byProduct[name]) byProduct[name] = { name, direct: 0, affiliate: 0, commissions: 0, count: 0 };
    if (o.ref_code) {
      byProduct[name].affiliate += o.amount || 0;
      byProduct[name].commissions += referralsByOrder[o.id]?.commission || 0;
    } else {
      byProduct[name].direct += o.amount || 0;
    }
    byProduct[name].count += 1;
  });

  const directList = directOrders.slice(0, 100).map(o => ({
    id: o.id,
    user_name: o.user_name,
    user_email: o.user_email,
    amount: o.amount,
    paid_at: o.paid_at,
    product_name: getProduct(o)?.name || "—",
  }));

  const affiliateList = affiliateOrders.slice(0, 100).map(o => {
    const ref = referralsByOrder[o.id];
    return {
      id: o.id,
      user_name: o.user_name,
      user_email: o.user_email,
      amount: o.amount,
      paid_at: o.paid_at,
      product_name: getProduct(o)?.name || "—",
      ref_code: o.ref_code,
      commission: ref?.commission || 0,
      commission_status: ref?.status || "—",
      affiliate_user_id: ref?.affiliate_user_id,
      affiliate_name: ref ? (affiliateNames[ref.affiliate_user_id] || "—") : "—",
      net: (o.amount || 0) - (ref?.commission || 0),
    };
  });

  return NextResponse.json({
    ok: true,
    summary: {
      grossRevenue,
      directRevenue,
      affiliateRevenue,
      totalCommissionsAccrued,
      pendingCommissions,
      paidCommissions,
      netRevenue,
      monthlyGross,
      lastMonthGross,
      paidCount: paid.length,
      directCount: directOrders.length,
      affiliateCount: affiliateOrders.length,
      pendingOrdersCount: all.filter(o => o.status === "pending").length,
      avgOrder: paid.length ? grossRevenue / paid.length : 0,
      paidOut,
      pendingPayout,
      commissionRate: COMMISSION_RATE,
    },
    byProduct: Object.values(byProduct).sort((a, b) => (b.direct + b.affiliate) - (a.direct + a.affiliate)),
    chart,
    directOrders: directList,
    affiliateOrders: affiliateList,
  });
}
