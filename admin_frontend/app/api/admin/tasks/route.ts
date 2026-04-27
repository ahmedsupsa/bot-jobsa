import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { getAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("group_id");

  let query = supabase
    .from("admin_tasks")
    .select("*")
    .order("position", { ascending: true });

  if (groupId) query = query.eq("group_id", Number(groupId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tasks: data || [] });
}

export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const group_id = Number(body.group_id);
  if (!title) return NextResponse.json({ ok: false, error: "عنوان المهمة مطلوب" }, { status: 400 });
  if (!group_id) return NextResponse.json({ ok: false, error: "group_id مطلوب" }, { status: 400 });

  const { data: maxPos } = await supabase
    .from("admin_tasks")
    .select("position")
    .eq("group_id", group_id)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("admin_tasks")
    .insert({
      title,
      description: body.description ? String(body.description).trim() : null,
      group_id,
      priority: body.priority || "medium",
      assigned_to: body.assigned_to ? String(body.assigned_to).trim() : null,
      due_date: body.due_date || null,
      created_by: session.username,
      position,
      status: "todo",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, task: data });
}

export async function PATCH(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id مطلوب" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.description !== undefined) updates.description = body.description ? String(body.description).trim() : null;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to || null;
  if (body.due_date !== undefined) updates.due_date = body.due_date || null;
  if (body.group_id !== undefined) updates.group_id = Number(body.group_id);
  if (body.position !== undefined) updates.position = Number(body.position);

  const { data, error } = await supabase
    .from("admin_tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, task: data });
}

export async function DELETE(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id مطلوب" }, { status: 400 });

  const { error } = await supabase.from("admin_tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
