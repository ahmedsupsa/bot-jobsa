import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";
export async function GET() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: all } = await sb.from("store_products").select("id,name,is_active,streampay_product_id");
  const { data: active } = await sb.from("store_products").select("id").eq("is_active", true);
  return NextResponse.json({ url_prefix: url.slice(0,35), total: all?.length??0, active: active?.length??0, rows: all });
}
