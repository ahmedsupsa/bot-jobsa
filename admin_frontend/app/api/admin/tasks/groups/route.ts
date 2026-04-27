import { NextResponse } from "next/server";
import { db } from "@/lib/local-db";
import { getAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET() {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  try {
    const rows = await db`
      SELECT * FROM admin_task_groups ORDER BY position ASC, id ASC
    `;
    return NextResponse.json({ ok: true, groups: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const color = String(body.color || "#6366f1").trim();
  if (!name) return NextResponse.json({ ok: false, error: "اسم المجموعة مطلوب" }, { status: 400 });

  try {
    const [maxPos] = await db`
      SELECT COALESCE(MAX(position), 0) AS pos FROM admin_task_groups
    `;
    const position = Number(maxPos.pos) + 1;

    const [row] = await db`
      INSERT INTO admin_task_groups (name, color, position, created_by)
      VALUES (${name}, ${color}, ${position}, ${session.username})
      RETURNING *
    `;
    return NextResponse.json({ ok: true, group: row });
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
    const sets: string[] = [];
    const vals: (string | number)[] = [];

    if (body.name !== undefined) { sets.push("name"); vals.push(String(body.name).trim()); }
    if (body.color !== undefined) { sets.push("color"); vals.push(String(body.color).trim()); }
    if (body.position !== undefined) { sets.push("position"); vals.push(Number(body.position)); }

    if (sets.length === 0) return NextResponse.json({ ok: false, error: "لا يوجد بيانات للتحديث" }, { status: 400 });

    const setClauses = sets.map((col, i) => `${col} = $${i + 1}`).join(", ");
    const [row] = await db.unsafe(
      `UPDATE admin_task_groups SET ${setClauses} WHERE id = $${sets.length + 1} RETURNING *`,
      [...vals, id]
    );
    return NextResponse.json({ ok: true, group: row });
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
    await db`DELETE FROM admin_tasks WHERE group_id = ${id}`;
    await db`DELETE FROM admin_task_groups WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
