import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || "";
const JOB_CHANNEL = process.env.TELEGRAM_JOB_CHANNEL_ID || "";

export async function GET() {
  const _d = enforcePermission("jobs"); if (_d) return _d;

  const results: Record<string, unknown> = { channel_id: JOB_CHANNEL };

  // ── عدد المشتركين ──────────────────────────────────────────────────
  if (BOT_TOKEN && JOB_CHANNEL) {
    try {
      const r = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getChatMembersCount?chat_id=${encodeURIComponent(JOB_CHANNEL)}`,
        { next: { revalidate: 0 } }
      );
      const d = await r.json();
      results.subscribers = d.ok ? d.result : null;
    } catch { results.subscribers = null; }

    // ── معلومات القناة ────────────────────────────────────────────────
    try {
      const r = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${encodeURIComponent(JOB_CHANNEL)}`,
        { next: { revalidate: 0 } }
      );
      const d = await r.json();
      if (d.ok) {
        results.channel_title      = d.result.title;
        results.channel_username   = d.result.username;
        results.channel_photo      = d.result.photo?.small_file_id ?? null;
        results.linked_chat_id     = d.result.linked_chat_id ?? null;
      }
    } catch {}
  }

  // ── آخر 20 منشور في القناة (من DB) ──────────────────────────────────
  const { data: posts } = await supabase
    .from("admin_jobs")
    .select("id, title_ar, company, application_email, tg_message_id, tg_views, created_at, source_account")
    .not("tg_message_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  results.recent_posts = posts || [];

  // ── إجمالي المنشورات في القناة ────────────────────────────────────
  const { count } = await supabase
    .from("admin_jobs")
    .select("*", { count: "exact", head: true })
    .not("tg_message_id", "is", null);
  results.total_posts = count ?? 0;

  // ── إجمالي المشاهدات ────────────────────────────────────────────────
  const { data: viewSum } = await supabase
    .from("admin_jobs")
    .select("tg_views")
    .not("tg_message_id", "is", null);
  results.total_views = viewSum?.reduce((s, r) => s + (r.tg_views || 0), 0) ?? 0;

  return NextResponse.json({ ok: true, ...results });
}
