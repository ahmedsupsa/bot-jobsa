import { NextResponse } from "next/server";
import { db } from "@/lib/local-db";
import { getAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("group_id");

  try {
    const rows = groupId
      ? await db`SELECT * FROM admin_tasks WHERE group_id = ${Number(groupId)} ORDER BY position ASC, id ASC`
      : await db`SELECT * FROM admin_tasks ORDER BY position ASC, id ASC`;

    return NextResponse.json({ ok: true, tasks: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const group_id = Number(body.group_id);
  if (!title) return NextResponse.json({ ok: false, error: "عنوان المهمة مطلوب" }, { status: 400 });
  if (!group_id) return NextResponse.json({ ok: false, error: "group_id مطلوب" }, { status: 400 });

  try {
    const [maxPos] = await db`
      SELECT COALESCE(MAX(position), 0) AS pos FROM admin_tasks WHERE group_id = ${group_id}
    `;
    const position = Number(maxPos.pos) + 1;

    const [row] = await db`
      INSERT INTO admin_tasks (title, description, group_id, priority, assigned_to, due_date, created_by, position, status)
      VALUES (
        ${title},
        ${body.description ? String(body.description).trim() : null},
        ${group_id},
        ${body.priority || "medium"},
        ${body.assigned_to ? String(body.assigned_to).trim() : null},
        ${body.due_date || null},
        ${session.username},
        ${position},
        'todo'
      )
      RETURNING *
    `;
    return NextResponse.json({ ok: true, task: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id مطلوب" }, { status: 400 });

  try {
    const cols: string[] = ["updated_at"];
    const vals: (string | number | null)[] = [new Date().toISOString()];

    if (body.title !== undefined) { cols.push("title"); vals.push(String(body.title).trim()); }
    if (body.description !== undefined) { cols.push("description"); vals.push(body.description ? String(body.description).trim() : null); }
    if (body.status !== undefined) { cols.push("status"); vals.push(body.status); }
    if (body.priority !== undefined) { cols.push("priority"); vals.push(body.priority); }
    if (body.assigned_to !== undefined) { cols.push("assigned_to"); vals.push(body.assigned_to || null); }
    if (body.due_date !== undefined) { cols.push("due_date"); vals.push(body.due_date || null); }
    if (body.group_id !== undefined) { cols.push("group_id"); vals.push(Number(body.group_id)); }
    if (body.position !== undefined) { cols.push("position"); vals.push(Number(body.position)); }

    const setClauses = cols.map((col, i) => `${col} = $${i + 1}`).join(", ");
    const [row] = await db.unsafe(
      `UPDATE admin_tasks SET ${setClauses} WHERE id = $${cols.length + 1} RETURNING *`,
      [...vals, id]
    );
    return NextResponse.json({ ok: true, task: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id مطلوب" }, { status: 400 });

  try {
    await db`DELETE FROM admin_tasks WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
