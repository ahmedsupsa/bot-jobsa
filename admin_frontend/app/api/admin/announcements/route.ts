import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";

export async function GET() {
  const _denied_ = enforcePermission("notifications"); if (_denied_) return _denied_;
  const { data } = await supabase
    .from("admin_announcements")
    .select("*")
    .order("created_at", { ascending: false });
  return NextResponse.json({ ok: true, announcements: data || [] });
}

export async function POST(req: Request) {
  const _denied_ = enforcePermission("notifications"); if (_denied_) return _denied_;
  const body = await req.json().catch(() => ({}));
  const { error } = await supabase.from("admin_announcements").insert({
    text_ar: body.text_ar || "",
    text_en: body.text_en || "",
    is_active: true,
    created_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const _denied_ = enforcePermission("notifications"); if (_denied_) return _denied_;
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await supabase.from("admin_announcements").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
