import { NextResponse } from "next/server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function POST() {
  if (!requireAdminSession()) return unauthorizedResponse();

  const workerUrl    = process.env.SUPABASE_WORKER_URL ?? "";
  const workerSecret = process.env.WORKER_SECRET ?? "";

  if (!workerUrl) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_WORKER_URL غير مضبوط في متغيرات البيئة" },
      { status: 500 }
    );
  }

  try {
    const r = await fetch(workerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workerSecret}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(290_000),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
