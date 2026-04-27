import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken, makeToken } from "@/lib/auth";

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

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
    email_connected: settings.email_connected ?? false,
    smtp_email: settings.smtp_email || "",
  });
  if (refreshedToken) res.headers.set("X-Refresh-Token", refreshedToken);
  return res;
}

export async function PATCH(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 }); }

  const allowed = ["full_name", "phone", "city", "age"] as const;
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) {
      const val = body[key];
      if (key === "age") {
        const n = val ? parseInt(String(val), 10) : null;
        updates[key] = n && n > 0 && n < 100 ? n : null;
      } else if (key === "full_name") {
        const s = String(val ?? "").trim();
        if (!s) return NextResponse.json({ error: "الاسم الكامل مطلوب" }, { status: 400 });
        updates[key] = s;
      } else {
        updates[key] = String(val ?? "").trim() || null;
      }
    }
  }

  if (!Object.keys(updates).length)
    return NextResponse.json({ error: "لا توجد بيانات للتحديث" }, { status: 400 });

  const { error } = await supabase.from("users").update(updates).eq("id", uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
