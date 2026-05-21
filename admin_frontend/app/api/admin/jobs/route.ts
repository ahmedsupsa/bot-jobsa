import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";
import { tg, postJobToChannel } from "@/lib/telegram";
import { geminiText } from "@/lib/gemini";

async function generateSpecializations(titleAr: string, descAr: string): Promise<string> {
  try {
    const prompt = `استخرج قائمة من 5-10 تخصصات ومسميات وظيفية مناسبة لهذه الوظيفة:
العنوان: ${titleAr}
الوصف: ${descAr.slice(0, 500)}
أرجع فقط الكلمات مفصولة بفاصلة، بدون شرح. مثال: تصميم جرافيك، تصميم بصري، فوتوشوب`;
    const text = await geminiText(prompt);
    return text || titleAr;
  } catch {
    return titleAr;
  }
}

export async function GET() {
  const _denied_ = enforcePermission("jobs"); if (_denied_) return _denied_;
  const { data: jobs, error } = await supabase
    .from("admin_jobs")
    .select("*")
    .or("is_active.eq.true,is_active.is.null")
    .order("created_at", { ascending: false });
  if (error) console.error("jobs GET error:", error.message);
  return NextResponse.json({ ok: true, jobs: jobs || [] });
}

export async function POST(req: Request) {
  const _denied_ = enforcePermission("jobs"); if (_denied_) return _denied_;
  const body = await req.json().catch(() => ({}));

  const titleAr = (body.title_ar || "").trim();
  const descAr = (body.description_ar || "").trim();
  const email = (body.application_email || "").trim();

  if (!titleAr || !email) {
    return NextResponse.json({ ok: false, error: "عنوان الوظيفة والبريد مطلوبان" }, { status: 400 });
  }

  const specializations = await generateSpecializations(titleAr, descAr);

  const { error, data } = await supabase.from("admin_jobs").insert({
    title_ar: titleAr,
    title_en: (body.title_en || "").trim(),
    company: (body.company || "").trim(),
    description_ar: descAr,
    application_email: email,
    specializations,
    is_active: true,
    created_at: new Date().toISOString(),
  }).select("id").single();

  if (error) {
    console.error("jobs INSERT error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  tg.jobAdded(titleAr, (body.company || "").trim(), email).catch(() => {});
  postJobToChannel({ title_ar: titleAr, description_ar: descAr, application_email: email })
    .then(async (msgId) => {
      if (msgId && data?.id) {
        await supabase.from("admin_jobs").update({ tg_message_id: msgId }).eq("id", data.id);
      }
    }).catch(() => {});
  return NextResponse.json({ ok: true, id: data?.id, specializations });
}

export async function DELETE(req: Request) {
  const _denied_ = enforcePermission("jobs"); if (_denied_) return _denied_;
  const body = await req.json().catch(() => ({}));

  // تعطيل الوظائف المنتهية (أكثر من 10 أيام) — soft delete لمنع إعادة الإضافة من Telegram
  if (body.mode === "expired") {
    const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const { error, count } = await supabase
      .from("admin_jobs")
      .update({ is_active: false }, { count: "exact" })
      .lt("created_at", cutoff)
      .eq("is_active", true);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: count || 0 });
  }

  // تعطيل المكررات (نفس الشركة + نفس المسمى) — soft delete لمنع إعادة الإضافة من Telegram
  if (body.mode === "dedupe") {
    const { data: allJobs, error: fetchErr } = await supabase
      .from("admin_jobs")
      .select("id, company, title_ar, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (fetchErr) return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });

    const seen = new Map<string, string>();
    const toDisable: string[] = [];
    for (const job of allJobs || []) {
      const key = `${(job.company || "").trim().toLowerCase()}|||${(job.title_ar || "").trim().toLowerCase()}`;
      if (!key.replace(/\|/g, "").trim()) continue;
      if (seen.has(key)) {
        toDisable.push(job.id);
      } else {
        seen.set(key, job.id);
      }
    }

    if (toDisable.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

    let disabledCount = 0;
    for (let i = 0; i < toDisable.length; i += 100) {
      const batch = toDisable.slice(i, i + 100);
      const { error, count } = await supabase
        .from("admin_jobs")
        .update({ is_active: false }, { count: "exact" })
        .in("id", batch);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      disabledCount += count || 0;
    }
    return NextResponse.json({ ok: true, deleted: disabledCount });
  }

  // تعطيل الوظائف بدون إيميل تقديم — soft delete لمنع إعادة الإضافة من Telegram
  if (body.mode === "no_email") {
    const { error, count } = await supabase
      .from("admin_jobs")
      .update({ is_active: false }, { count: "exact" })
      .or("application_email.is.null,application_email.eq.")
      .eq("is_active", true);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: count || 0 });
  }

  // حذف متعدد
  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const { error, count } = await supabase.from("admin_jobs").delete({ count: "exact" }).in("id", body.ids);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    for (const id of body.ids) tg.jobDeleted(id).catch(() => {});
    return NextResponse.json({ ok: true, deleted: count || 0 });
  }

  // حذف مفرد
  const { id } = body;
  if (!id) return NextResponse.json({ ok: false, error: "معرّف الوظيفة مطلوب" }, { status: 400 });
  const { error } = await supabase.from("admin_jobs").delete().eq("id", id);
  if (error) {
    const friendly = /foreign key|violates/i.test(error.message)
      ? "لا يمكن حذف الوظيفة لارتباطها بسجلات تقديم."
      : error.message;
    return NextResponse.json({ ok: false, error: friendly }, { status: 500 });
  }
  tg.jobDeleted(id).catch(() => {});
  return NextResponse.json({ ok: true });
}
