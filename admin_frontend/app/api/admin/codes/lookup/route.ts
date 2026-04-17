import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ ok: false, error: "أدخل كوداً" }, { status: 400 });

  const { data: codeRows } = await supabase
    .from("activation_codes")
    .select("id,code,used,used_at,subscription_days,used_by_user_id")
    .eq("code", code)
    .limit(1);

  const row = codeRows?.[0];
  if (!row) return NextResponse.json({ ok: false, error: "الكود غير موجود" }, { status: 404 });

  if (!row.used) {
    return NextResponse.json({ ok: true, status: "unused", code: row.code, subscription_days: row.subscription_days });
  }

  const { data: userRows } = await supabase
    .from("users")
    .select("id,full_name,phone,city,age,subscription_ends_at")
    .eq("id", row.used_by_user_id)
    .limit(1);

  const { data: settingsRows } = await supabase
    .from("user_settings")
    .select("email")
    .eq("user_id", row.used_by_user_id)
    .limit(1);

  const user = userRows?.[0];
  return NextResponse.json({
    ok: true,
    status: "used",
    code: row.code,
    subscription_days: row.subscription_days,
    used_at: row.used_at,
    user: user ? {
      id: user.id,
      full_name: user.full_name,
      phone: user.phone,
      city: user.city,
      age: user.age,
      email: settingsRows?.[0]?.email || "",
      subscription_ends_at: user.subscription_ends_at,
    } : null,
  });
}
