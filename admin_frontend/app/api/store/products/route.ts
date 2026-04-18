import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("store_products")
    .select("id, name, description, price, duration_days, streampay_product_id, is_active")
    .order("price", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const products = (data || [])
    .filter((p) => p.is_active === true)
    .map(({ is_active: _, ...rest }) => rest);

  return NextResponse.json({ ok: true, products });
}
