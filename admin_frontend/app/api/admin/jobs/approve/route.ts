import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";
import { postJobToChannel } from "@/lib/telegram";

export async function POST(req: Request) {
  const _denied_ = enforcePermission("jobs"); if (_denied_) return _denied_;
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: "معرّف الوظيفة مطلوب" }, { status: 400 });

  const { data: job, error } = await supabase.from("admin_jobs").select("*").eq("id", id).single();
  if (error || !job) return NextResponse.json({ ok: false, error: "الوظيفة غير موجودة" }, { status: 404 });

  const { error: updateErr } = await supabase.from("admin_jobs").update({ is_active: true }).eq("id", id);
  if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });

  postJobToChannel({
    title_ar: job.title_ar,
    description_ar: job.description_ar || null,
    application_email: job.application_email || null,
    link_url: job.link_url || null,
  }).then(async (msgId) => {
    if (msgId) {
      await supabase.from("admin_jobs").update({ tg_message_id: msgId }).eq("id", id);
    }
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
