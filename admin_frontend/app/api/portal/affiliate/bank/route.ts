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
  const { bank_name, iban, account_holder } = await req.json();
  if (!bank_name?.trim() || !iban?.trim() || !account_holder?.trim()) {
    return NextResponse.json({ ok: false, error: "كل الحقول مطلوبة" }, { status: 400 });
  }
  const cleanIban = iban.replace(/\s/g, "").toUpperCase();
  if (!/^SA\d{22}$/.test(cleanIban)) {
    return NextResponse.json({ ok: false, error: "رقم الآيبان غير صحيح (يجب أن يبدأ بـ SA و24 رقم)" }, { status: 400 });
  }
  const supabase = freshClient();
  const { error } = await supabase
    .from("affiliates")
    .update({
      bank_name: bank_name.trim(),
      iban: cleanIban,
      account_holder: account_holder.trim(),
    })
    .eq("user_id", uid);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
