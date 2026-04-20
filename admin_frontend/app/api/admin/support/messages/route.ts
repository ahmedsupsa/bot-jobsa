import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";
import webpush from "web-push";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

function initVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@jobbots.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY || ""
  );
}

export async function GET(req: Request) {
  const _denied_ = enforcePermission("support"); if (_denied_) return _denied_;
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ ok: false, error: "user_id مطلوب" }, { status: 400 });

  const supabase = freshClient();

  const { data: messages, error } = await supabase
    .from("support_messages")
    .select("id, sender, content, created_at, read_at, attachment_url, attachment_name, attachment_type, attachment_size, meta")
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
  const _denied_ = enforcePermission("support"); if (_denied_) return _denied_;
  const body = await req.json();
  const { user_id, attachment, meta } = body;
  const content = (body.content || "").toString().trim();
  if (!user_id || (!content && !attachment && !meta)) {
    return NextResponse.json({ ok: false, error: "user_id والمحتوى مطلوبان" }, { status: 400 });
  }
  const supabase = freshClient();

  const insert: Record<string, unknown> = { user_id, sender: "admin", content };
  if (attachment?.url) {
    insert.attachment_url = attachment.url;
    insert.attachment_name = attachment.name || null;
    insert.attachment_type = attachment.type || null;
    insert.attachment_size = attachment.size || null;
  }
  if (meta) insert.meta = meta;

  const { data, error } = await supabase
    .from("support_messages")
    .insert(insert)
    .select("id, sender, content, created_at, read_at, attachment_url, attachment_name, attachment_type, attachment_size, meta")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // إرسال إشعار push للمستخدم
  try {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", user_id);

    if (subs && subs.length > 0) {
      initVapid();
      const payload = JSON.stringify({
        title: "رسالة جديدة من الدعم",
        body: content.trim().slice(0, 100),
        url: "/portal/support",
      });
      await Promise.allSettled(
        subs.map(async (row) => {
          try {
            const sub = JSON.parse(row.subscription);
            await webpush.sendNotification(sub, payload);
          } catch {}
        })
      );
    }
  } catch {}

  return NextResponse.json({ ok: true, message: data });
}
