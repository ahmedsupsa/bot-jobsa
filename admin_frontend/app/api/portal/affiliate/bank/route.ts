import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

  const body = await req.json();
  const method = (body.payout_method || "bank") as "bank" | "wallet";
  const account_holder = (body.account_holder || "").trim();
  if (!account_holder) {
    return NextResponse.json({ ok: false, error: "اسم صاحب الحساب مطلوب" }, { status: 400 });
  }

  const update: Record<string, any> = {
    payout_method: method,
    account_holder,
  };

  if (method === "bank") {
    const bank_name = (body.bank_name || "").trim();
    const iban = (body.iban || "").replace(/\s/g, "").toUpperCase();
    if (!bank_name) return NextResponse.json({ ok: false, error: "اسم البنك مطلوب" }, { status: 400 });
    if (!/^SA\d{22}$/.test(iban)) {
      return NextResponse.json({ ok: false, error: "رقم الآيبان غير صحيح (يبدأ بـ SA و24 رقم)" }, { status: 400 });
    }
    update.bank_name = bank_name;
    update.iban = iban;
    update.wallet_provider = null;
    update.wallet_number = null;
  } else if (method === "wallet") {
    const wallet_provider = (body.wallet_provider || "").trim();
    const wallet_number = (body.wallet_number || "").replace(/\s/g, "");
    if (!wallet_provider) return NextResponse.json({ ok: false, error: "اختر نوع المحفظة" }, { status: 400 });
    if (!/^(05|009665|\+9665)\d{8}$/.test(wallet_number)) {
      return NextResponse.json({ ok: false, error: "رقم الجوال غير صحيح" }, { status: 400 });
    }
    update.wallet_provider = wallet_provider;
    update.wallet_number = wallet_number;
    update.bank_name = null;
    update.iban = null;
  } else {
    return NextResponse.json({ ok: false, error: "طريقة دفع غير صالحة" }, { status: 400 });
  }

  const supabase = freshClient();
  const { error } = await supabase.from("affiliates").update(update).eq("user_id", uid);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
