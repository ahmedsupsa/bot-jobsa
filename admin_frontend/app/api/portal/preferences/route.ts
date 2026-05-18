import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;
  const supabase = freshClient();

  const [{ data: prefs, error: prefsErr }, { data: fields, error: fieldsErr }, { data: settingsRows }] = await Promise.all([
    supabase.from("user_job_preferences").select("job_field_id").eq("user_id", uid),
    supabase.from("job_fields").select("*").order("name_ar"),
    supabase.from("user_settings").select("allow_tamheer,allow_cooperative").eq("user_id", uid).limit(1),
  ]);

  if (prefsErr) console.error("prefs GET error:", JSON.stringify(prefsErr));
  if (fieldsErr) console.error("fields GET error:", JSON.stringify(fieldsErr));

  const settings = settingsRows?.[0] || {};

  return NextResponse.json({
    selected_ids: (prefs || []).map((p: any) => String(p.job_field_id)),
    all_fields: (fields || []).map((f: any) => ({ ...f, id: String(f.id) })),
    allow_tamheer: settings.allow_tamheer ?? false,
    allow_cooperative: settings.allow_cooperative ?? false,
  });
}

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;
  const supabase = freshClient();

  const body = await req.json().catch(() => ({}));
  const ids: string[] = (body.field_ids || [])
    .map((id: any) => String(id).trim())
    .filter((id: string) => id.length > 0);

  const allow_tamheer    = body.allow_tamheer    === true;
  const allow_cooperative = body.allow_cooperative === true;

  const { error: delErr } = await supabase
    .from("user_job_preferences")
    .delete()
    .eq("user_id", uid);

  if (delErr) {
    console.error("prefs DELETE error:", JSON.stringify(delErr));
    return NextResponse.json({ error: `فشل حذف التفضيلات القديمة: ${delErr.message}` }, { status: 500 });
  }

  if (ids.length > 0) {
    const { error: insErr } = await supabase
      .from("user_job_preferences")
      .insert(ids.map((fid) => ({ user_id: uid, job_field_id: fid })));

    if (insErr) {
      console.error("prefs INSERT error:", JSON.stringify(insErr));
      return NextResponse.json({ error: `فشل حفظ التفضيلات: ${insErr.message}` }, { status: 500 });
    }
  }

  // حفظ إعدادات البرامج في user_settings
  const { data: existing } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("user_id", uid)
    .maybeSingle();

  if (existing) {
    await supabase.from("user_settings").update({ allow_tamheer, allow_cooperative }).eq("user_id", uid);
  } else {
    await supabase.from("user_settings").insert({ user_id: uid, allow_tamheer, allow_cooperative });
  }

  return NextResponse.json({ status: "ok", count: ids.length });
}
