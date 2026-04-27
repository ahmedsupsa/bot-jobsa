import { NextResponse } from "next/server";
import { getAdminSession, unauthorizedResponse } from "@/lib/admin-auth";
import { db } from "@/lib/local-db";

export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();
  if (!session.isSuper) {
    return NextResponse.json({ ok: false, error: "للمدير العام فقط" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const query = String(body.query || "").trim();

  if (!query) return NextResponse.json({ ok: false, error: "الاستعلام فارغ" }, { status: 400 });

  const MAX_LEN = 8000;
  if (query.length > MAX_LEN) {
    return NextResponse.json({ ok: false, error: `الاستعلام أطول من ${MAX_LEN} حرف` }, { status: 400 });
  }

  // Block some dangerous operations in production
  const upper = query.toUpperCase();
  const BLOCKED = ["DROP DATABASE", "DROP SCHEMA", "TRUNCATE", "DROP ROLE", "ALTER ROLE"];
  for (const b of BLOCKED) {
    if (upper.includes(b)) {
      return NextResponse.json({ ok: false, error: `العملية "${b}" غير مسموحة` }, { status: 400 });
    }
  }

  try {
    const start = Date.now();
    const rows = await db.unsafe(query);
    const elapsed = Date.now() - start;

    const count = Array.isArray(rows) ? rows.length : 0;
    const columns = count > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];

    return NextResponse.json({
      ok: true,
      rows: rows as unknown[],
      columns,
      count,
      elapsed_ms: elapsed,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
