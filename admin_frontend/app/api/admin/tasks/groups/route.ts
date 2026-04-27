import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { getAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET() {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const { data, error } = await supabase
    .from("admin_task_groups")
    .select("*")
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, groups: data || [] });
}

export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const color = String(body.color || "#6366f1").trim();
  if (!name) return NextResponse.json({ ok: false, error: "اسم المجموعة مطلوب" }, { status: 400 });

  const { data: maxPos } = await supabase
    .from("admin_task_groups")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("admin_task_groups")
    .insert({ name, color, position, created_by: session.username })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, group: data });
}

export async function PATCH(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id مطلوب" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.color !== undefined) updates.color = String(body.color).trim();
  if (body.position !== undefined) updates.position = Number(body.position);

  const { data, error } = await supabase
    .from("admin_task_groups")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, group: data });
}

export async function DELETE(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id مطلوب" }, { status: 400 });

  await supabase.from("admin_tasks").delete().eq("group_id", id);
  const { error } = await supabase.from("admin_task_groups").delete().eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
