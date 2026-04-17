import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!requireAdminSession()) return unauthorizedResponse();

  const [{ data: prefs }, { data: fields }] = await Promise.all([
    supabase.from("user_job_preferences").select("field_id").eq("user_id", params.id),
    supabase.from("job_fields").select("id,name_ar").order("name_ar"),
  ]);

  return NextResponse.json({
    ok: true,
    selected_ids: (prefs || []).map((p: any) => String(p.field_id)),
    all_fields: fields || [],
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!requireAdminSession()) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const ids: string[] = (body.field_ids || []).map(String);

  await supabase.from("user_job_preferences").delete().eq("user_id", params.id);
  if (ids.length > 0) {
    await supabase.from("user_job_preferences").insert(
      ids.map((fid) => ({ user_id: params.id, field_id: fid }))
    );
  }

  return NextResponse.json({ ok: true, count: ids.length });
}
