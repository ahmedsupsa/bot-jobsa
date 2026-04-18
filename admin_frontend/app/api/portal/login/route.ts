import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { makeToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = (body.code || "").trim();
  if (!code) return NextResponse.json({ error: "أدخل كود التفعيل" }, { status: 400 });

  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows } = await supabase
    .from("activation_codes")
    .select("*")
    .eq("code", code)
    .limit(1);

  const row = rows?.[0];
  if (!row) return NextResponse.json({ error: "كود التفعيل غير صحيح" }, { status: 400 });

  // Already registered user — log them in
  if (row.used && row.used_by_user_id) {
    const token = await makeToken(String(row.used_by_user_id));
    return NextResponse.json({ status: "ok", token, user_id: String(row.used_by_user_id) });
  }

  // Fresh code OR code assigned via payment (used=true but no user yet) — allow registration
  if (!row.used || (row.used && !row.used_by_user_id)) {
    return NextResponse.json({
      status: "needs_registration",
      code_id: String(row.id),
      subscription_days: row.subscription_days || 30,
    });
  }

  return NextResponse.json({ error: "كود التفعيل غير صالح" }, { status: 400 });
}
