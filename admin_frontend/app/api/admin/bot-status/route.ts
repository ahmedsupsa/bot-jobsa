import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: appsToday },
    { count: appsTotal },
    { data: lastApp },
    { count: usersTotal },
    { count: usersReady },
  ] = await Promise.all([
    supabase.from("applications").select("id", { count: "exact", head: true })
      .gte("applied_at", todayStart.toISOString()),
    supabase.from("applications").select("id", { count: "exact", head: true }),
    supabase.from("applications").select("applied_at").order("applied_at", { ascending: false }).limit(1),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("user_cvs").select("user_id", { count: "exact", head: true }),
  ]);

  const lastAppAt = lastApp?.[0]?.applied_at || null;
  const minutesSinceLast = lastAppAt
    ? Math.floor((Date.now() - new Date(lastAppAt).getTime()) / 60000)
    : null;
  const isActive = minutesSinceLast !== null && minutesSinceLast < 90;

  return NextResponse.json({
    ok: true,
    is_active: isActive,
    minutes_since_last: minutesSinceLast,
    last_application_at: lastAppAt,
    apps_today: appsToday || 0,
    apps_total: appsTotal || 0,
    users_total: usersTotal || 0,
    users_with_cv: usersReady || 0,
  });
}
