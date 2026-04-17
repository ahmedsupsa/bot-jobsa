import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!requireAdminSession()) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: false, error: "أدخل إيميلاً" }, { status: 400 });

  const { data: existing } = await supabase
    .from("user_settings")
    .select("id")
    .eq("user_id", params.id)
    .limit(1);

  if (existing?.[0]) {
    await supabase.from("user_settings").update({ email }).eq("user_id", params.id);
  } else {
    await supabase.from("user_settings").insert({ user_id: params.id, email });
  }

  return NextResponse.json({ ok: true });
}
