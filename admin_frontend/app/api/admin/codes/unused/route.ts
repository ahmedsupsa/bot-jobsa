import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";

export async function DELETE() {
  const _denied_ = enforcePermission("codes"); if (_denied_) return _denied_;

  const { data: rows, error: countErr } = await supabase
    .from("activation_codes")
    .select("id")
    .eq("used", false);

  if (countErr) return NextResponse.json({ ok: false, error: countErr.message }, { status: 500 });

  const total = (rows || []).length;
  if (total === 0) return NextResponse.json({ ok: true, deleted: 0 });

  const { error } = await supabase
    .from("activation_codes")
    .delete()
    .eq("used", false);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: total });
}
