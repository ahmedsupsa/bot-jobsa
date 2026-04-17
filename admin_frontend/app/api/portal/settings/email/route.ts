import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const body = await req.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "أدخل إيميلاً صحيحاً" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("user_settings")
    .select("id")
    .eq("user_id", uid)
    .limit(1);

  if (existing?.[0]) {
    await supabase.from("user_settings").update({ email }).eq("user_id", uid);
  } else {
    await supabase.from("user_settings").insert({ user_id: uid, email });
  }

  return NextResponse.json({ status: "ok" });
}
