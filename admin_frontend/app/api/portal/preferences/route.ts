import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const { data: prefs } = await supabase
    .from("user_job_preferences")
    .select("field_id")
    .eq("user_id", uid);

  const { data: fields } = await supabase
    .from("job_fields")
    .select("*")
    .order("name_ar");

  return NextResponse.json({
    selected_ids: (prefs || []).map((p: { field_id: string }) => String(p.field_id)),
    all_fields: fields || [],
  });
}

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const body = await req.json().catch(() => ({}));
  const ids: string[] = (body.field_ids || []).map(String);

  await supabase.from("user_job_preferences").delete().eq("user_id", uid);

  if (ids.length > 0) {
    await supabase.from("user_job_preferences").insert(
      ids.map((fid) => ({ user_id: uid, field_id: fid }))
    );
  }

  return NextResponse.json({ status: "ok", count: ids.length });
}
