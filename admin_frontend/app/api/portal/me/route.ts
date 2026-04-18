import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken, makeToken } from "@/lib/auth";

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  // Sliding session: re-issue a fresh 30-day token on every check-in
  const refreshedToken = await makeToken(uid).catch(() => null);

  const { data: userRows } = await supabase.from("users").select("*").eq("id", uid).limit(1);
  const user = userRows?.[0];
  if (!user) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

  const { data: settingsRows } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", uid)
    .limit(1);
  const settings = settingsRows?.[0] || {};

  const { count: apps_count } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", uid);

  const ends_at = user.subscription_ends_at || null;
  let days_left = 0;
  if (ends_at) {
    const diff = new Date(ends_at).getTime() - Date.now();
    days_left = Math.max(0, Math.floor(diff / 86400000));
  }
  const subscription_active = days_left > 0;

  const res = NextResponse.json({
    id: uid,
    full_name: user.full_name || "",
    phone: user.phone || "",
    age: user.age || null,
    city: user.city || "",
    subscription_active,
    subscription_ends_at: ends_at,
    days_left,
    email: settings.email || "",
    sender_email_alias: settings.sender_email_alias || "",
    applications_count: apps_count || 0,
  });
  if (refreshedToken) res.headers.set("X-Refresh-Token", refreshedToken);
  return res;
}
