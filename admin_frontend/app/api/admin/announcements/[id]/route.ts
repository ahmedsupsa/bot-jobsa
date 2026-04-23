import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const _denied_ = enforcePermission("notifications"); if (_denied_) return _denied_;
  const { id } = params;
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const { error } = await supabase.from("admin_announcements").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}