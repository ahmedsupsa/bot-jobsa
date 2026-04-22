import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();

  const [
    { data: jobs },
    { data: orders },
    { data: recentApps },
    { data: recentUsers },
  ] = await Promise.all([
    supabase.from("admin_jobs").select("id,is_active"),
    supabase.from("store_orders").select("amount,status,payment_gateway"),
    supabase
      .from("applications")
      .select("user_id,job_title,applied_at")
      .order("applied_at", { ascending: false })
      .limit(12),
    supabase
      .from("users")
      .select("id,full_name,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const paidOrders = (orders || []).filter((o: any) => o.status === "paid");
  const totalRevenue = paidOrders.reduce(
    (sum: number, o: any) => sum + (Number(o.amount) || 0),
    0
  );
  // "pending" now means bank-transfer awaiting admin confirmation only.
  const pendingOrders = (orders || []).filter((o: any) => o.status === "pending").length;

  const appItems = await Promise.all(
    (recentApps || []).map(async (r: any) => {
      const { data: uRows } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", r.user_id)
        .limit(1);
      return {
        user_name: uRows?.[0]?.full_name || "—",
        job_title: r.job_title || "—",
        applied_at: r.applied_at || "—",
      };
    })
  );

  return NextResponse.json({
    ok: true,
    stats: {
      jobs_total: jobs?.length || 0,
      jobs_active: (jobs || []).filter((j: any) => j.is_active).length,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      paid_orders: paidOrders.length,
      pending_orders: pendingOrders,
    },
    recent_applications: appItems,
    recent_users: (recentUsers || []).map((u: any) => ({
      name: u.full_name || "—",
      created_at: u.created_at || "—",
    })),
  });
}
