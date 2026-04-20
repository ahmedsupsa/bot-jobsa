import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  if (!url || !key) return NextResponse.json({ last_ran_at: null });

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data } = await supabase
    .from("worker_logs")
    .select("ran_at, applied_count, status")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    last_ran_at: data?.ran_at ?? null,
    last_applied: data?.applied_count ?? 0,
    last_status: data?.status ?? null,
  });
}
