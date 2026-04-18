import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MIN_WITHDRAW = 20;

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUserId(req: Request): Promise<string | null> {
  const token = extractToken(req);
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.user_id || null;
}

export async function POST(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });
  const supabase = freshClient();

  const { data: aff } = await supabase
    .from("affiliates")
    .select("bank_name, iban, account_holder")
    .eq("user_id", uid)
    .single();

  if (!aff?.iban || !aff?.bank_name || !aff?.account_holder) {
    return NextResponse.json({ ok: false, error: "أضف بيانات حسابك البنكي أولاً" }, { status: 400 });
  }

  // Get available pending referrals (not linked to any withdrawal)
  const { data: pending } = await supabase
    .from("affiliate_referrals")
    .select("id, commission")
    .eq("affiliate_user_id", uid)
    .eq("status", "pending")
    .is("withdrawal_id", null);

  const available = (pending || []).reduce((s, r) => s + Number(r.commission || 0), 0);
  if (available < MIN_WITHDRAW) {
    return NextResponse.json({ ok: false, error: `الحد الأدنى للسحب ${MIN_WITHDRAW} ريال (رصيدك ${available.toFixed(2)})` }, { status: 400 });
  }

  // Create withdrawal request
  const { data: wd, error: wdErr } = await supabase
    .from("affiliate_withdrawals")
    .insert({
      user_id: uid,
      amount: available,
      bank_name: aff.bank_name,
      iban: aff.iban,
      account_holder: aff.account_holder,
      status: "pending",
    })
    .select()
    .single();
  if (wdErr || !wd) return NextResponse.json({ ok: false, error: wdErr?.message || "فشل إنشاء طلب السحب" }, { status: 500 });

  // Link all pending referrals to this withdrawal
  const ids = (pending || []).map((r) => r.id);
  if (ids.length > 0) {
    await supabase
      .from("affiliate_referrals")
      .update({ withdrawal_id: wd.id })
      .in("id", ids);
  }

  return NextResponse.json({ ok: true, withdrawal: wd });
}

export async function GET(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });
  const supabase = freshClient();
  const { data, error } = await supabase
    .from("affiliate_withdrawals")
    .select("id, amount, status, proof_url, notes, created_at, paid_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, withdrawals: data || [] });
}
