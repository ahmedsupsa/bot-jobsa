import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";

export async function GET() {
  const _denied_ = enforcePermission("users"); if (_denied_) return _denied_;

  const { data: users } = await supabase
    .from("users")
    .select("id,full_name,phone,created_at,subscription_ends_at,activation_code_id")
    .order("created_at", { ascending: false })
    .limit(200);

  const list = users || [];
  const codeIds = Array.from(new Set(list.map((u: any) => u.activation_code_id).filter(Boolean)));
  const userIds = list.map((u: any) => u.id);

  const [{ data: codes }, { data: settings }] = await Promise.all([
    codeIds.length > 0
      ? supabase.from("activation_codes").select("id,code").in("id", codeIds)
      : Promise.resolve({ data: [] as any[] }),
    userIds.length > 0
      ? supabase.from("user_settings").select("user_id,email").in("user_id", userIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const codeMap = new Map((codes || []).map((c: any) => [c.id, c.code]));
  const emailMap = new Map((settings || []).map((s: any) => [s.user_id, s.email]));

  const result = list.map((u: any) => ({
    ...u,
    email: emailMap.get(u.id) || "",
    activation_code: u.activation_code_id ? codeMap.get(u.activation_code_id) || null : null,
  }));

  return NextResponse.json({ ok: true, users: result });
}
