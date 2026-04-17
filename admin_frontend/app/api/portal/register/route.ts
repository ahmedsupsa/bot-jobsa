import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { makeToken } from "@/lib/auth";

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

  const { data: codeRows } = await supabase
    .from("activation_codes")
    .select("*")
    .eq("id", code_id)
    .limit(1);

  const codeRow = codeRows?.[0];
  if (!codeRow || codeRow.used) {
    return NextResponse.json({ error: "كود التفعيل غير صالح أو مستخدم مسبقاً" }, { status: 400 });
  }

  const subscription_days = codeRow.subscription_days || 30;
  const ends_at = new Date(Date.now() + subscription_days * 86400000).toISOString();

  const { data: userRows, error: userErr } = await supabase
    .from("users")
    .insert({
      telegram_id: 0,
      activation_code_id: code_id,
      subscription_ends_at: ends_at,
      full_name,
      phone,
      age: age || null,
      city,
    })
    .select("*");

  if (userErr || !userRows?.[0]) {
    return NextResponse.json({ error: "فشل إنشاء الحساب، حاول لاحقاً" }, { status: 500 });
  }

  const user = userRows[0];
  await supabase
    .from("activation_codes")
    .update({ used: true, used_at: new Date().toISOString(), used_by_user_id: user.id })
    .eq("id", code_id);

  const token = await makeToken(String(user.id));
  return NextResponse.json({ status: "ok", token, user_id: String(user.id) });
}
