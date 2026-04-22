import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const supabase = freshClient();
  const { data } = await supabase
    .from("store_settings")
    .select("banner_enabled, banner_text, banner_image_url")
    .eq("id", 1)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    settings: data || { banner_enabled: false, banner_text: null, banner_image_url: null },
  });
}
