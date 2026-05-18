import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || "";
const JOB_CHANNEL = process.env.TELEGRAM_JOB_CHANNEL_ID || "";

// ── إرسال منشور جديد ────────────────────────────────────────────────────────
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

  const msgId = d.result?.message_id ?? null;

  // حفظ في DB تحت source_account = "broadcast" حتى يظهر في قائمة المنشورات
  const firstLine = text.replace(/<[^>]*>/g, "").split("\n").find((l: string) => l.trim()) || "منشور مخصص";
  const title = firstLine.slice(0, 120);
  const { data: inserted } = await supabase
    .from("admin_jobs")
    .insert({
      title_ar: title,
      description_ar: text,
      source_account: "broadcast",
      tweet_uid: `broadcast_${msgId}_${Date.now()}`,
      tg_message_id: msgId,
      tg_views: 0,
    })
    .select("id")
    .single();

  return NextResponse.json({ ok: true, message_id: msgId, job_id: inserted?.id });
}

// ── تعديل منشور موجود ────────────────────────────────────────────────────────
export async function PATCH(req: Request) {
  const _d = enforcePermission("jobs"); if (_d) return _d;

  const body = await req.json().catch(() => ({}));
  const { message_id, text, job_id } = body;
  if (!message_id || !text?.trim()) return NextResponse.json({ ok: false, error: "message_id والنص مطلوبان" }, { status: 400 });

  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: JOB_CHANNEL,
      message_id,
      text: text.trim(),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const d = await r.json();
  if (!d.ok) return NextResponse.json({ ok: false, error: d.description }, { status: 500 });

  // تحديث النص في DB إذا كان عندنا job_id
  if (job_id) {
    const firstLine = (text as string).replace(/<[^>]*>/g, "").split("\n").find((l: string) => l.trim()) || "منشور";
    await supabase.from("admin_jobs").update({
      title_ar: firstLine.slice(0, 120),
      description_ar: text.trim(),
    }).eq("id", job_id);
  }

  return NextResponse.json({ ok: true });
}

// ── حذف منشور من القناة ────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  const _d = enforcePermission("jobs"); if (_d) return _d;
  const body = await req.json().catch(() => ({}));
  const { message_id, job_id } = body;
  if (!message_id) return NextResponse.json({ ok: false, error: "message_id مطلوب" }, { status: 400 });

  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: JOB_CHANNEL, message_id }),
  });
  const d = await r.json();

  if (d.ok) {
    // إذا كان عندنا job_id نحذف السجل بالكامل (منشور مخصص)، وإلا نمسح message_id فقط
    if (job_id) {
      const { data: job } = await supabase.from("admin_jobs").select("source_account").eq("id", job_id).single();
      if (job?.source_account === "broadcast") {
        await supabase.from("admin_jobs").delete().eq("id", job_id);
      } else {
        await supabase.from("admin_jobs").update({ tg_message_id: null }).eq("id", job_id);
      }
    } else {
      await supabase.from("admin_jobs").update({ tg_message_id: null }).eq("tg_message_id", message_id);
    }
  }
  return NextResponse.json({ ok: d.ok, description: d.description });
}
