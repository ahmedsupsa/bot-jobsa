import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();

  const { data: logs, error } = await supabase
    .from("worker_logs")
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const parsed = (logs || []).map((log) => ({
    ...log,
    errors: typeof log.errors === "string" ? JSON.parse(log.errors) : log.errors ?? [],
  }));

  return NextResponse.json({ ok: true, logs: parsed });
}
