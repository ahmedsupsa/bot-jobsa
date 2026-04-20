import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  if (!url || !key) return NextResponse.json({ last_ran_at: null, next_run_at: null });

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data } = await supabase
    .from("worker_status")
    .select("last_ran_at, next_run_at")
    .eq("id", "main")
    .maybeSingle();

  return NextResponse.json(
    {
      last_ran_at: data?.last_ran_at ?? null,
      next_run_at: data?.next_run_at ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
