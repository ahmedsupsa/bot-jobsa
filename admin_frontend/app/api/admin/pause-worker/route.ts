import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();
  const supabase = freshClient();

  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "applications_pause")
    .single();

  if (!data) return NextResponse.json({ ok: true, paused: false, until: null, reason: "" });
  const val = data.value as { paused: boolean; until: string | null; reason: string; paused_at: string };
  return NextResponse.json({ ok: true, ...val });
}

export async function POST(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const supabase = freshClient();
  const body = await req.json();

  const { paused, until, reason } = body as {
    paused: boolean;
    until?: string | null;
    reason?: string;
  };

  const value = {
    paused: Boolean(paused),
    until: until || null,
    reason: reason || "",
    paused_at: paused ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from("system_settings")
    .upsert({ key: "applications_pause", value }, { onConflict: "key" });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...value });
}
