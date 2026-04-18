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
    .select("payout_method, bank_name, iban, account_holder, wallet_provider, wallet_number")
    .eq("user_id", uid)
    .single();

  if (!aff?.payout_method || !aff?.account_holder) {
    return NextResponse.json({ ok: false, error: "أضف بيانات حسابك أولاً" }, { status: 400 });
  }
  if (aff.payout_method === "bank" && (!aff.iban || !aff.bank_name)) {
    return NextResponse.json({ ok: false, error: "بيانات البنك ناقصة" }, { status: 400 });
  }
  if (aff.payout_method === "wallet" && (!aff.wallet_provider || !aff.wallet_number)) {
    return NextResponse.json({ ok: false, error: "بيانات المحفظة ناقصة" }, { status: 400 });
  }

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

  const { data: wd, error: wdErr } = await supabase
    .from("affiliate_withdrawals")
    .insert({
      user_id: uid,
      amount: available,
      method: aff.payout_method,
      bank_name: aff.bank_name || null,
      iban: aff.iban || null,
      account_holder: aff.account_holder,
      wallet_provider: aff.wallet_provider || null,
      wallet_number: aff.wallet_number || null,
      status: "pending",
    })
    .select()
    .single();
  if (wdErr || !wd) return NextResponse.json({ ok: false, error: wdErr?.message || "فشل إنشاء طلب السحب" }, { status: 500 });

  const ids = (pending || []).map((r) => r.id);
  if (ids.length > 0) {
    await supabase
      .from("affiliate_referrals")
      .update({ withdrawal_id: wd.id })
      .in("id", ids);
  }

  return NextResponse.json({ ok: true, withdrawal: wd });
}
