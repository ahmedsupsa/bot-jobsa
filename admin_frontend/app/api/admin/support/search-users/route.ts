import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const _denied_ = enforcePermission("support"); if (_denied_) return _denied_;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q || q.length < 2) return NextResponse.json({ ok: true, users: [] });

  const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "",
    { auth: { persistSession: false } }
  );

  // البحث بالاسم أو الجوال
  const { data: byName } = await supabase
    .from("users")
    .select("id, full_name, phone")
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(10);

  // البحث بالإيميل في user_settings
  const { data: byEmail } = await supabase
    .from("user_settings")
    .select("user_id, email")
    .ilike("email", `%${q}%`)
    .limit(10);

  const emailUserIds = (byEmail || []).map((r) => r.user_id);
  let emailUsers: any[] = [];
  if (emailUserIds.length > 0) {
    const { data } = await supabase
      .from("users")
      .select("id, full_name, phone")
      .in("id", emailUserIds);
    emailUsers = data || [];
  }

  // دمج بدون تكرار
  const seen = new Set<string>();
  const merged: { id: string; full_name: string; phone: string; email?: string }[] = [];

  for (const u of [...(byName || []), ...emailUsers]) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    const emailRow = (byEmail || []).find((e) => e.user_id === u.id);
    merged.push({ ...u, email: emailRow?.email || "" });
  }

  return NextResponse.json({ ok: true, users: merged });
}
