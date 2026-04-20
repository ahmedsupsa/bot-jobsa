import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const _denied_ = enforcePermission("support"); if (_denied_) return _denied_;
  const supabase = freshClient();

  // Get all support messages
  const { data: msgs, error } = await supabase
    .from("support_messages")
    .select("id, user_id, sender, content, created_at, read_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Group by user_id
  const byUser = new Map<string, {
    user_id: string;
    last_message: string;
    last_at: string;
    last_sender: string;
    unread_count: number;
  }>();

  for (const m of msgs || []) {
    const existing = byUser.get(m.user_id);
    if (!existing) {
      byUser.set(m.user_id, {
        user_id: m.user_id,
        last_message: m.content,
        last_at: m.created_at,
        last_sender: m.sender,
        unread_count: m.sender === "user" && !m.read_at ? 1 : 0,
      });
    } else if (m.sender === "user" && !m.read_at) {
      existing.unread_count += 1;
    }
  }

  const userIds = Array.from(byUser.keys());
  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, conversations: [] });
  }

  // Fetch user info
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, phone")
    .in("id", userIds);

  const userMap = new Map((users || []).map((u) => [u.id, u]));

  const conversations = Array.from(byUser.values())
    .map((c) => {
      const u = userMap.get(c.user_id);
      return {
        ...c,
        full_name: u?.full_name || "مستخدم",
        phone: u?.phone || "",
      };
    })
    .sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());

  return NextResponse.json({ ok: true, conversations });
}
