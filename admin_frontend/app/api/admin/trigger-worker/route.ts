import { NextResponse } from "next/server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function POST() {
  if (!requireAdminSession()) return unauthorizedResponse();

  const CRON_SECRET = process.env.CRON_SECRET || "";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.jobbots.org";

  try {
    const r = await fetch(`${baseUrl}/api/cron/worker`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(290000),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
