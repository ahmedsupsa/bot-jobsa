import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const _denied_ = enforcePermission("users"); if (_denied_) return _denied_;

  const userId = params.id;
  if (!userId) return NextResponse.json({ ok: false, error: "معرّف مستخدم غير صالح" }, { status: 400 });

  // Free the activation code so it can be re-used (set used=false, clear used_by_user_id/used_at)
  const { data: u } = await supabase
    .from("users")
    .select("activation_code_id")
    .eq("id", userId)
    .maybeSingle();

  if (u?.activation_code_id) {
    await supabase
      .from("activation_codes")
      .update({ used: false, used_at: null, used_by_user_id: null })
      .eq("id", u.activation_code_id);
  }

  // All other tables (user_settings, user_preferences, applications, push_subscriptions, etc.)
  // reference users(id) ON DELETE CASCADE — they will be removed automatically.
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
