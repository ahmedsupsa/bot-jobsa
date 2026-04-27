import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store, max-age=0, must-revalidate" };

export async function GET(req: Request) {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: "Supabase env not configured", products: [] },
      { status: 500, headers: HEADERS }
    );
  }

  const { searchParams } = new URL(req.url);
  const includeSecret = searchParams.get("key") === "admin";

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Try full query including is_secret (may not exist in older schemas)
  type ProductRow = Record<string, unknown>;
  let rows: ProductRow[] | null = null;
  let queryError: { message: string } | null = null;

  const full = await supabase
    .from("store_products")
    .select("id, name, description, price, duration_days, streampay_product_id, is_active, is_secret, created_at")
    .order("duration_days", { ascending: true });

  if (full.error && /is_secret/i.test(full.error.message)) {
    // is_secret column doesn't exist in this DB — retry without it
    const fallback = await supabase
      .from("store_products")
      .select("id, name, description, price, duration_days, streampay_product_id, is_active, created_at")
      .order("duration_days", { ascending: true });
    rows = (fallback.data as ProductRow[] | null);
    queryError = fallback.error;
  } else {
    rows = (full.data as ProductRow[] | null);
    queryError = full.error;
  }

  const data = rows;
  const error = queryError;

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, products: [] },
      { status: 500, headers: HEADERS }
    );
  }

  // Filter active + optionally hide secret products from public
  const products = (data || [])
    .filter((p) => p.is_active === true)
    .filter((p) => includeSecret ? true : (p as Record<string, unknown>).is_secret !== true)
    .map(({ is_active: _ia, created_at: _ca, ...rest }) => rest);

  return NextResponse.json(
    { ok: true, products, count: products.length, ts: Date.now() },
    { headers: HEADERS }
  );
}
