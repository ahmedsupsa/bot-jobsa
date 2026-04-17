import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function GET() {
  const { data, error } = await supabase
    .from("store_products")
    .select("id, name, description, price, duration_days, streampay_product_id")
    .eq("is_active", true)
    .order("price", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, products: data || [] });
}
