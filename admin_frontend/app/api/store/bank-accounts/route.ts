import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("id, type, name, account_number, iban, phone, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ ok: true, accounts: data || [] });
  } catch (err) {
    console.error("bank-accounts GET:", err);
    return NextResponse.json({ ok: false, accounts: [] });
  }
}
