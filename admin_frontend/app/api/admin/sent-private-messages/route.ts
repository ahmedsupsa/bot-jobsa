import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const denied = enforcePermission("email-test"); if (denied) return denied;

  const supabase = freshClient();
  const { data, error } = await supabase
    .from("sent_private_messages")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
