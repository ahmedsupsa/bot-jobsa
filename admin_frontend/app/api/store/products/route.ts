import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: "Supabase env not configured", products: [] },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("store_products")
    .select("id, name, description, price, duration_days, streampay_product_id, is_active, created_at")
    .order("duration_days", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, products: [] },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  // Filter active in JS (PostgREST .eq("is_active", true) is unreliable in this stack)
  const products = (data || [])
    .filter((p) => p.is_active === true)
    .map(({ is_active: _ia, created_at: _ca, ...rest }) => rest);

  return NextResponse.json(
    { ok: true, products, count: products.length, ts: Date.now() },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
  );
}
