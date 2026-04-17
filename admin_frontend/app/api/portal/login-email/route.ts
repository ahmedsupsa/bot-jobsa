import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { makeToken } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "أدخل البريد الإلكتروني" }, { status: 400 });

  const { data: settingsRows } = await supabase
    .from("user_settings")
    .select("user_id")
    .ilike("email", email)
    .limit(1);

  if (!settingsRows || settingsRows.length === 0)
    return NextResponse.json({ error: "لا يوجد حساب بهذا البريد الإلكتروني" }, { status: 404 });

  const userId = String(settingsRows[0].user_id);

  const { data: userRows } = await supabase
    .from("users")
    .select("subscription_ends_at")
    .eq("id", userId)
    .limit(1);

  const user = userRows?.[0];
  if (!user) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });

  const endsAt = user.subscription_ends_at;
  if (!endsAt || new Date(endsAt) < new Date())
    return NextResponse.json({ error: "انتهى اشتراكك — تواصل مع الدعم للتجديد" }, { status: 403 });

  const token = await makeToken(userId);
  return NextResponse.json({ status: "ok", token, user_id: userId });
}
