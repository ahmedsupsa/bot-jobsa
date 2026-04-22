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
  const denied = enforcePermission("store"); if (denied) return denied;
  const supabase = freshClient();
  const { data, error } = await supabase
    .from("store_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    settings: data || { banner_enabled: false, banner_text: null, banner_image_url: null },
  });
}

export async function PUT(req: Request) {
  const denied = enforcePermission("store"); if (denied) return denied;
  const supabase = freshClient();
  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.banner_enabled !== undefined) updates.banner_enabled = !!body.banner_enabled;
  if (body.banner_text !== undefined) updates.banner_text = body.banner_text || null;
  if (body.banner_image_url !== undefined) updates.banner_image_url = body.banner_image_url || null;

  const { error } = await supabase
    .from("store_settings")
    .upsert({ id: 1, ...updates }, { onConflict: "id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
