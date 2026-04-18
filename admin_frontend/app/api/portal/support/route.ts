import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUserId(req: Request): Promise<string | null> {
  const token = extractToken(req);
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.user_id || null;
}

export async function GET(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });
  const supabase = freshClient();

  const { data, error } = await supabase
    .from("support_messages")
    .select("id, sender, content, created_at, read_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Mark admin messages as read by user
  await supabase
    .from("support_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("sender", "admin")
    .is("read_at", null);

  return NextResponse.json({ ok: true, messages: data || [] });
}

export async function POST(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });
  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ ok: false, error: "الرسالة فارغة" }, { status: 400 });
  }
  const supabase = freshClient();
  const { data, error } = await supabase
    .from("support_messages")
    .insert({ user_id: uid, sender: "user", content: content.trim() })
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: data });
}
