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

  const [{ data: codes }, { data: settings }, { data: prefs }, { data: fields }] = await Promise.all([
    codeIds.length > 0
      ? supabase.from("activation_codes").select("id,code").in("id", codeIds)
      : Promise.resolve({ data: [] as any[] }),
    userIds.length > 0
      ? supabase.from("user_settings").select("user_id,email,smtp_email,email_connected,smtp_host,last_email_test_at").in("user_id", userIds)
      : Promise.resolve({ data: [] as any[] }),
    userIds.length > 0
      ? supabase.from("user_job_preferences").select("user_id,job_field_id").in("user_id", userIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("job_fields").select("id,name_ar"),
  ]);

  const codeMap = new Map((codes || []).map((c: any) => [c.id, c.code]));
  const emailMap = new Map((settings || []).map((s: any) => [s.user_id, s.email]));
  const smtpMap = new Map((settings || []).map((s: any) => [s.user_id, {
    smtp_email: s.smtp_email || "",
    email_connected: s.email_connected || false,
    smtp_host: s.smtp_host || "",
    last_email_test_at: s.last_email_test_at || null,
  }]));
  const fieldNameMap = new Map((fields || []).map((f: any) => [String(f.id), f.name_ar]));
  const prefMap = new Map<string, string[]>();
  for (const p of prefs || []) {
    const name = fieldNameMap.get(String(p.job_field_id));
    if (!name) continue;
    if (!prefMap.has(p.user_id)) prefMap.set(p.user_id, []);
    prefMap.get(p.user_id)!.push(name);
  }

  const result = list.map((u: any) => ({
    ...u,
    email: emailMap.get(u.id) || "",
    activation_code: u.activation_code_id ? codeMap.get(u.activation_code_id) || null : null,
    preferences: prefMap.get(u.id) || [],
    ...(smtpMap.get(u.id) || { smtp_email: "", email_connected: false, smtp_host: "", last_email_test_at: null }),
  }));

  return NextResponse.json({ ok: true, users: result });
}
