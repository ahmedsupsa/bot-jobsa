import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { getAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

const SUPER_ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();

export async function GET() {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();
  const me = session.username;

  const { data: accounts } = await supabase
    .from("admin_accounts")
    .select("username, is_super, disabled")
    .eq("disabled", false);

  let contacts: { username: string; isSuper: boolean }[] = [];

  if (session.isSuper) {
    contacts = (accounts || [])
      .filter((a) => a.username !== me)
      .map((a) => ({ username: a.username, isSuper: !!a.is_super }));
    if (SUPER_ADMIN_USERNAME !== me && !contacts.find((c) => c.username === SUPER_ADMIN_USERNAME)) {
      contacts.unshift({ username: SUPER_ADMIN_USERNAME, isSuper: true });
    }
  } else {
    const dbSuperAdmins = (accounts || [])
      .filter((a) => !!a.is_super && a.username !== me)
      .map((a) => ({ username: a.username, isSuper: true }));
    contacts = dbSuperAdmins;
    if (!contacts.find((c) => c.username === SUPER_ADMIN_USERNAME)) {
      contacts.unshift({ username: SUPER_ADMIN_USERNAME, isSuper: true });
    }
  }

  const { data: messages } = await supabase
    .from("admin_chat_messages")
    .select("id, sender, receiver, body, file_name, created_at, read_at")
    .or(`sender.eq.${me},receiver.eq.${me}`)
    .order("created_at", { ascending: false })
    .limit(500);

  const msgs = messages || [];

  const result = contacts.map((contact) => {
    const convo = msgs.filter(
      (m) =>
        (m.sender === me && m.receiver === contact.username) ||
        (m.sender === contact.username && m.receiver === me)
    );
    const last = convo[0] || null;
    const unread = convo.filter((m) => m.receiver === me && !m.read_at).length;
    return {
      ...contact,
      lastMessage: last
        ? {
            body: last.body,
            fileName: last.file_name,
            createdAt: last.created_at,
            isMine: last.sender === me,
          }
        : null,
      unread,
    };
  });

  result.sort((a, b) => {
    if (a.lastMessage && b.lastMessage)
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    if (a.lastMessage) return -1;
    if (b.lastMessage) return 1;
    return a.username.localeCompare(b.username);
  });

  return NextResponse.json({ ok: true, contacts: result, me });
}
