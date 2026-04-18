import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ ok: false, error: "user_id مطلوب" }, { status: 400 });

  const supabase = freshClient();

  const { data: messages, error } = await supabase
    .from("support_messages")
    .select("id, sender, content, created_at, read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Mark user messages as read by admin
  await supabase
    .from("support_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("sender", "user")
    .is("read_at", null);

  const { data: userRow } = await supabase
    .from("users")
    .select("id, full_name, phone")
    .eq("id", userId)
    .single();

  return NextResponse.json({ ok: true, messages: messages || [], user: userRow || null });
}

export async function POST(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { user_id, content } = await req.json();
  if (!user_id || !content?.trim()) {
    return NextResponse.json({ ok: false, error: "user_id والمحتوى مطلوبان" }, { status: 400 });
  }
  const supabase = freshClient();
  const { data, error } = await supabase
    .from("support_messages")
    .insert({ user_id, sender: "admin", content: content.trim() })
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: data });
}
