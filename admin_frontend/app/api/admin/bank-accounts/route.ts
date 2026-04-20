import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const denied = enforcePermission("store");
  if (denied) return denied;

  const supabase = freshClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, accounts: data || [] });
}

export async function POST(req: Request) {
  const denied = enforcePermission("store");
  if (denied) return denied;

  const body = await req.json();
  const { type, name, account_number, iban, phone, display_order } = body;

  if (!type || !name?.trim()) {
    return NextResponse.json({ ok: false, error: "النوع والاسم مطلوبان" }, { status: 400 });
  }

  if (type === "bank" && !account_number?.trim() && !iban?.trim()) {
    return NextResponse.json({ ok: false, error: "رقم الحساب أو الآيبان مطلوب للبنك" }, { status: 400 });
  }

  if (type === "wallet" && !phone?.trim() && !account_number?.trim()) {
    return NextResponse.json({ ok: false, error: "رقم الجوال أو رقم الحساب مطلوب للمحفظة" }, { status: 400 });
  }

  const supabase = freshClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      type,
      name: name.trim(),
      account_number: account_number?.trim() || null,
      iban: iban?.trim() || null,
      phone: phone?.trim() || null,
      display_order: Number(display_order) || 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, account: data });
}
