import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const COMMISSION_RATE = 0.10;

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

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function GET(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });
  const supabase = freshClient();

  const { data: user } = await supabase
    .from("users")
    .select("id, subscription_ends_at, full_name")
    .eq("id", uid)
    .single();

  const subActive = user?.subscription_ends_at && new Date(user.subscription_ends_at) > new Date();

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (!affiliate) {
    return NextResponse.json({
      ok: true,
      joined: false,
      eligible: !!subActive,
      commission_rate: COMMISSION_RATE,
      min_withdraw: 20,
    });
  }

  const { data: referrals } = await supabase
    .from("affiliate_referrals")
    .select("id, amount, commission, status, withdrawal_id, created_at")
    .eq("affiliate_user_id", uid)
    .order("created_at", { ascending: false });

  const totalEarnings = (referrals || []).reduce((s, r) => s + Number(r.commission || 0), 0);
  // Available = pending AND not linked to any withdrawal
  const availableBalance = (referrals || [])
    .filter((r) => r.status === "pending" && !r.withdrawal_id)
    .reduce((s, r) => s + Number(r.commission || 0), 0);
  // Requested = pending but linked to a withdrawal (awaiting admin)
  const requestedBalance = (referrals || [])
    .filter((r) => r.status === "pending" && r.withdrawal_id)
    .reduce((s, r) => s + Number(r.commission || 0), 0);
  const paidEarnings = (referrals || [])
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + Number(r.commission || 0), 0);

  const { data: withdrawals } = await supabase
    .from("affiliate_withdrawals")
    .select("id, amount, status, proof_url, notes, created_at, paid_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    ok: true,
    joined: true,
    eligible: !!subActive,
    code: affiliate.code,
    payout_method: affiliate.payout_method || "",
    bank_name: affiliate.bank_name || "",
    iban: affiliate.iban || "",
    account_holder: affiliate.account_holder || "",
    wallet_provider: affiliate.wallet_provider || "",
    wallet_number: affiliate.wallet_number || "",
    user_full_name: user?.full_name || "",
    total_earnings: totalEarnings,
    available_balance: availableBalance,
    requested_balance: requestedBalance,
    paid_earnings: paidEarnings,
    referrals_count: referrals?.length || 0,
    referrals: referrals || [],
    withdrawals: withdrawals || [],
    commission_rate: COMMISSION_RATE,
    min_withdraw: 20,
  });
}

export async function POST(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });
  const supabase = freshClient();

  const { data: user } = await supabase
    .from("users")
    .select("subscription_ends_at")
    .eq("id", uid)
    .single();

  const subActive = user?.subscription_ends_at && new Date(user.subscription_ends_at) > new Date();
  if (!subActive) {
    return NextResponse.json({ ok: false, error: "تحتاج اشتراك نشط للانضمام لبرنامج الربح" }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("affiliates")
    .select("code")
    .eq("user_id", uid)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, code: existing.code, already: true });

  let code = "";
  for (let i = 0; i < 10; i++) {
    const candidate = genCode();
    const { data: clash } = await supabase
      .from("affiliates")
      .select("code")
      .eq("code", candidate)
      .maybeSingle();
    if (!clash) { code = candidate; break; }
  }
  if (!code) return NextResponse.json({ ok: false, error: "تعذّر توليد كود فريد" }, { status: 500 });

  const { error } = await supabase.from("affiliates").insert({ user_id: uid, code });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, code });
}
