import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function DELETE(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const supabase = freshClient();

  // Best-effort cleanup of related data (safe even if FK cascades exist)
  await Promise.allSettled([
    supabase.from("user_cvs").delete().eq("user_id", uid),
    supabase.from("user_preferences").delete().eq("user_id", uid),
    supabase.from("applications").delete().eq("user_id", uid),
    supabase.from("support_messages").delete().eq("user_id", uid),
    supabase.from("affiliates").delete().eq("user_id", uid),
    supabase.from("affiliate_referrals").delete().eq("affiliate_user_id", uid),
    supabase.from("affiliate_withdrawals").delete().eq("user_id", uid),
  ]);

  // Try storage cleanup
  try {
    const { data: files } = await supabase.storage.from("cvs").list(uid);
    if (files && files.length > 0) {
      await supabase.storage.from("cvs").remove(files.map((f) => `${uid}/${f.name}`));
    }
  } catch {}

  // Delete the user record
  const { error } = await supabase.from("users").delete().eq("id", uid);
  if (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
