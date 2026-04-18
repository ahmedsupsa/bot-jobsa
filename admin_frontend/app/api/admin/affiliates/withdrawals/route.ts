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

  const { data: withdrawals, error } = await supabase
    .from("affiliate_withdrawals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (!withdrawals || withdrawals.length === 0) {
    return NextResponse.json({ ok: true, withdrawals: [] });
  }

  const userIds = Array.from(new Set(withdrawals.map((w) => w.user_id)));
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, phone")
    .in("id", userIds);
  const userMap = new Map((users || []).map((u) => [u.id, u]));

  const result = withdrawals.map((w) => ({
    ...w,
    full_name: userMap.get(w.user_id)?.full_name || "",
    phone: userMap.get(w.user_id)?.phone || "",
  }));

  return NextResponse.json({ ok: true, withdrawals: result });
}

export async function POST(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { withdrawal_id, action, notes } = await req.json();
  if (!withdrawal_id) return NextResponse.json({ ok: false, error: "withdrawal_id مطلوب" }, { status: 400 });
  const supabase = freshClient();

  if (action === "reject") {
    // Unlink referrals so user can request again later
    await supabase
      .from("affiliate_referrals")
      .update({ withdrawal_id: null })
      .eq("withdrawal_id", withdrawal_id);
    await supabase
      .from("affiliate_withdrawals")
      .update({ status: "rejected", notes: notes || null })
      .eq("id", withdrawal_id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "action غير صالح" }, { status: 400 });
}
