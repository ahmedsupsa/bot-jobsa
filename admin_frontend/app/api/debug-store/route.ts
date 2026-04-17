import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.SUPABASE_KEY || "";
  const key = serviceKey || anonKey;

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: all, error: e1 } = await supabase.from("store_products").select("*");
  const { data: active, error: e2 } = await supabase.from("store_products").select("*").eq("is_active", true);

  return NextResponse.json({
    supabase_url_prefix: url.slice(0, 40),
    key_type: serviceKey ? "service_role" : "anon",
    all_products: { count: all?.length ?? 0, error: e1?.message, data: all },
    active_only: { count: active?.length ?? 0, error: e2?.message },
  });
}
