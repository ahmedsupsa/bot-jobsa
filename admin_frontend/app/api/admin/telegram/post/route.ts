import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || "";
const JOB_CHANNEL = process.env.TELEGRAM_JOB_CHANNEL_ID || "";

export async function POST(req: Request) {
  const _d = enforcePermission("jobs"); if (_d) return _d;

  const body = await req.json().catch(() => ({}));
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "النص مطلوب" }, { status: 400 });
  if (!BOT_TOKEN || !JOB_CHANNEL) return NextResponse.json({ ok: false, error: "إعدادات Telegram ناقصة" }, { status: 500 });

  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: JOB_CHANNEL,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const d = await r.json();
  if (!d.ok) return NextResponse.json({ ok: false, error: d.description }, { status: 500 });

  return NextResponse.json({ ok: true, message_id: d.result?.message_id });
}

// ── حذف منشور من القناة ────────────────────────────────────────────────
export async function DELETE(req: Request) {
  const _d = enforcePermission("jobs"); if (_d) return _d;
  const body = await req.json().catch(() => ({}));
  const msgId = body.message_id;
  if (!msgId) return NextResponse.json({ ok: false, error: "message_id مطلوب" }, { status: 400 });

  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: JOB_CHANNEL, message_id: msgId }),
  });
  const d = await r.json();

  // أزل message_id من DB
  if (d.ok) {
    await supabase.from("admin_jobs").update({ tg_message_id: null }).eq("tg_message_id", msgId);
  }
  return NextResponse.json({ ok: d.ok, description: d.description });
}
