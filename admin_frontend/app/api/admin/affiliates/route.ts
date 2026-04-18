import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();
  const supabase = freshClient();

  const { data: affiliates, error } = await supabase
    .from("affiliates")
    .select("user_id, code, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (!affiliates || affiliates.length === 0) {
    return NextResponse.json({ ok: true, affiliates: [] });
  }

  const userIds = affiliates.map((a) => a.user_id);
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, phone")
    .in("id", userIds);
  const userMap = new Map((users || []).map((u) => [u.id, u]));

  const { data: refs } = await supabase
    .from("affiliate_referrals")
    .select("affiliate_user_id, amount, commission, status");

  const refsByUser = new Map<string, { count: number; total: number; pending: number; paid: number }>();
  for (const r of refs || []) {
    const cur = refsByUser.get(r.affiliate_user_id) || { count: 0, total: 0, pending: 0, paid: 0 };
    cur.count += 1;
    cur.total += Number(r.commission || 0);
    if (r.status === "pending") cur.pending += Number(r.commission || 0);
    if (r.status === "paid") cur.paid += Number(r.commission || 0);
    refsByUser.set(r.affiliate_user_id, cur);
  }

  const result = affiliates.map((a) => {
    const u = userMap.get(a.user_id);
    const stats = refsByUser.get(a.user_id) || { count: 0, total: 0, pending: 0, paid: 0 };
    return {
      user_id: a.user_id,
      code: a.code,
      created_at: a.created_at,
      full_name: u?.full_name || "",
      phone: u?.phone || "",
      referrals_count: stats.count,
      total_earnings: stats.total,
      pending_earnings: stats.pending,
      paid_earnings: stats.paid,
    };
  });

  return NextResponse.json({ ok: true, affiliates: result });
}

export async function POST(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { user_id, action } = await req.json();
  if (!user_id || action !== "mark_paid") {
    return NextResponse.json({ ok: false, error: "user_id و action مطلوبان" }, { status: 400 });
  }
  const supabase = freshClient();
  const { error } = await supabase
    .from("affiliate_referrals")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("affiliate_user_id", user_id)
    .eq("status", "pending");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
