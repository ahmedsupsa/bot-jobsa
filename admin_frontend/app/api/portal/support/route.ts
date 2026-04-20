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

const SELECT_COLS =
  "id, sender, content, created_at, read_at, attachment_url, attachment_name, attachment_type, attachment_size, meta";

export async function GET(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });
  const supabase = freshClient();

  const { data, error } = await supabase
    .from("support_messages")
    .select(SELECT_COLS)
    .eq("user_id", uid)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

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
  const body = await req.json();
  const content = (body.content || "").toString().trim();
  const attachment = body.attachment || null;
  const meta = body.meta || null;

  if (!content && !attachment && !meta) {
    return NextResponse.json({ ok: false, error: "الرسالة فارغة" }, { status: 400 });
  }

  const supabase = freshClient();
  const insert: Record<string, unknown> = {
    user_id: uid,
    sender: "user",
    content: content || "",
  };
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
    .select(SELECT_COLS)
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: data });
}
