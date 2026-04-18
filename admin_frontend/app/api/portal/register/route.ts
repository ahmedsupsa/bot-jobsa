import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { makeToken } from "@/lib/auth";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

function freshSupabase() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code_id = (body.code_id || "").trim();
  const full_name = (body.full_name || "").trim();
  const phone = (body.phone || "").trim();
  const city = (body.city || "").trim();
  const age = body.age ? parseInt(body.age) : null;

  if (!code_id || !full_name || !phone || !city) {
    return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 });
  }

  if (age !== null && age < 17) {
    const fakeToken = await makeToken(randomUUID());
    return NextResponse.json({ status: "ok", token: fakeToken });
  }

  const supabase = freshSupabase();

  const { data: codeRows } = await supabase
    .from("activation_codes")
    .select("*")
    .eq("id", code_id)
    .limit(1);

  const codeRow = codeRows?.[0];
  // Reject if: code not found, OR already fully used (used=true AND linked to a user)
  if (!codeRow || (codeRow.used && codeRow.used_by_user_id)) {
    return NextResponse.json({ error: "كود التفعيل غير صالح أو مستخدم مسبقاً" }, { status: 400 });
  }

  const subscription_days = codeRow.subscription_days || 30;
  const ends_at = new Date(Date.now() + subscription_days * 86400000).toISOString();

  const baseInsert = {
    activation_code_id: code_id,
    subscription_ends_at: ends_at,
    full_name,
    phone,
    age: age || null,
    city,
  };

  let { data: userRows, error: userErr } = await supabase
    .from("users")
    .insert(baseInsert)
    .select("*");

  // Fallback: if telegram_id column still exists and is NOT NULL, insert with a unique placeholder
  if (userErr && (userErr.message.includes("telegram_id") || userErr.message.includes("null value"))) {
    const fallback = await supabase
      .from("users")
      .insert({ ...baseInsert, telegram_id: -(Date.now() % 2147483647 + Math.floor(Math.random() * 99999)) })
      .select("*");
    userRows = fallback.data;
    userErr = fallback.error;
  }

  if (userErr || !userRows?.[0]) {
    console.error("Register insert error:", userErr?.message);
    return NextResponse.json({ error: "فشل إنشاء الحساب، حاول لاحقاً", detail: userErr?.message }, { status: 500 });
  }

  const user = userRows[0];
  await supabase
    .from("activation_codes")
    .update({ used: true, used_at: new Date().toISOString(), used_by_user_id: user.id })
    .eq("id", code_id);

  const token = await makeToken(String(user.id));
  return NextResponse.json({ status: "ok", token, user_id: String(user.id) });
}
