import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUserId(req: Request): Promise<string | null> {
  const token = extractToken(req);
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.user_id || null;
}

export async function GET(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const supabase = freshClient();

  const { data: settingsRows } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", uid)
    .limit(1);
  const settings = settingsRows?.[0] || {};

  const { count: prefs_count } = await supabase
    .from("user_preferences")
    .select("*", { count: "exact", head: true })
    .eq("user_id", uid);

  return NextResponse.json({
    email: settings.email || "",
    sender_email_alias: settings.sender_email_alias || "",
    template_type: settings.template_type || "",
    application_language: settings.application_language || "ar",
    job_preferences_count: prefs_count || 0,
  });
}

export async function POST(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });

  const body = await req.json();
  const update: Record<string, any> = {};
  if (body.application_language && ["ar", "en"].includes(body.application_language)) {
    update.application_language = body.application_language;
  }
  if (body.template_type && ["classic", "modern", "brief"].includes(body.template_type)) {
    update.template_type = body.template_type;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "لا يوجد تغيير" }, { status: 400 });
  }

  const supabase = freshClient();
  const { data: existing } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("user_id", uid)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("user_settings").update(update).eq("user_id", uid);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("user_settings").insert({ user_id: uid, ...update });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
