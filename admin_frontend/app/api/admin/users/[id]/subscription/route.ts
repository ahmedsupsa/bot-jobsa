import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const _denied_ = enforcePermission("users"); if (_denied_) return _denied_;
  const { days } = await req.json().catch(() => ({}));
  if (!days || isNaN(Number(days))) return NextResponse.json({ error: "أدخل عدد الأيام" }, { status: 400 });

  const ends_at = new Date(Date.now() + Number(days) * 86400000).toISOString();
  const { error } = await supabase.from("users").update({ subscription_ends_at: ends_at }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, subscription_ends_at: ends_at });
}
