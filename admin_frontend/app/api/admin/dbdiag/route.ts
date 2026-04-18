import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("x-admin-secret");
  if (auth !== process.env.ADMIN_SECRET) return NextResponse.json({ ok:false }, { status: 401 });

  const url = process.env.SUPABASE_URL || "";
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anon = process.env.SUPABASE_KEY || "";

  // test with service role
  const sbSvc = createClient(url, svc, { auth: { persistSession: false } });
  const { data: d1, error: e1 } = await sbSvc.from("store_products").select("id,name,is_active");

  // test with anon
  const sbAnon = createClient(url, anon, { auth: { persistSession: false } });
  const { data: d2, error: e2 } = await sbAnon.from("store_products").select("id,name,is_active");

  return NextResponse.json({
    has_svc_key: !!svc,
    has_anon_key: !!anon,
    svc_key_prefix: svc.slice(0,20),
    svc_results: d1?.length ?? e1?.message,
    anon_results: d2?.length ?? e2?.message,
    svc_rows: d1,
    anon_rows: d2
  });
}
