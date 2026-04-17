import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();

  const { data: users } = await supabase
    .from("users")
    .select("id,full_name,telegram_id,phone,created_at,subscription_ends_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const result = await Promise.all(
    (users || []).map(async (u: any) => {
      const { data: s } = await supabase
        .from("user_settings")
        .select("email")
        .eq("user_id", u.id)
        .limit(1);
      return { ...u, email: s?.[0]?.email || "" };
    })
  );

  return NextResponse.json({ ok: true, users: result });
}
