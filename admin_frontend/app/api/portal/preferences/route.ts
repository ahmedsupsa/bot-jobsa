import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const [{ data: prefs, error: prefsErr }, { data: fields, error: fieldsErr }] = await Promise.all([
    supabase.from("user_job_preferences").select("job_field_id").eq("user_id", uid),
    supabase.from("job_fields").select("*").order("name_ar"),
  ]);

  if (prefsErr) console.error("prefs GET error:", JSON.stringify(prefsErr));
  if (fieldsErr) console.error("fields GET error:", JSON.stringify(fieldsErr));

  return NextResponse.json({
    selected_ids: (prefs || []).map((p: any) => String(p.job_field_id)),
    all_fields: (fields || []).map((f: any) => ({ ...f, id: String(f.id) })),
  });
}

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const body = await req.json().catch(() => ({}));
  const ids: string[] = (body.field_ids || [])
    .map((id: any) => String(id).trim())
    .filter((id: string) => id.length > 0);

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

  return NextResponse.json({ status: "ok", count: ids.length });
}
