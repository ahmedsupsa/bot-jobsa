import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { getAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const withUser = searchParams.get("with");
  if (!withUser) return NextResponse.json({ ok: false, error: "missing 'with'" }, { status: 400 });

  const me = session.username;

  const { data, error } = await supabase
    .from("admin_chat_messages")
    .select("*")
    .or(
      `and(sender.eq.${me},receiver.eq.${withUser}),and(sender.eq.${withUser},receiver.eq.${me})`
    )
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const messages = await Promise.all(
    (data || []).map(async (msg) => {
      if (msg.file_path) {
        const { data: urlData } = await supabase.storage
          .from("admin-chat-files")
          .createSignedUrl(msg.file_path, 3600);
        return { ...msg, file_url: urlData?.signedUrl ?? null };
      }
      return { ...msg, file_url: null };
    })
  );

  return NextResponse.json({ ok: true, messages });
}

export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const receiver = String(body.receiver || "").trim();
  const msgBody = String(body.body || "").trim() || null;
  const filePath = body.file_path ? String(body.file_path) : null;
  const fileName = body.file_name ? String(body.file_name) : null;
  const fileSize = body.file_size != null ? Number(body.file_size) : null;
  const fileType = body.file_type ? String(body.file_type) : null;

  if (!receiver)
    return NextResponse.json({ ok: false, error: "receiver مطلوب" }, { status: 400 });
  if (!msgBody && !filePath)
    return NextResponse.json({ ok: false, error: "نص أو ملف مطلوب" }, { status: 400 });

  const { data, error } = await supabase
    .from("admin_chat_messages")
    .insert({
      sender: session.username,
      receiver,
      body: msgBody,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: data });
}

export async function PATCH(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const from = String(body.from || "").trim();
  if (!from) return NextResponse.json({ ok: false, error: "from مطلوب" }, { status: 400 });

  await supabase
    .from("admin_chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("receiver", session.username)
    .eq("sender", from)
    .is("read_at", null);

  return NextResponse.json({ ok: true });
}
