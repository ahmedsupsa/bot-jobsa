import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const denied = enforcePermission("jobs");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const dateFrom  = searchParams.get("date_from");
  const dateTo    = searchParams.get("date_to");
  const userId    = searchParams.get("user_id");
  const status    = searchParams.get("status");
  const limit     = Math.min(parseInt(searchParams.get("limit") || "200"), 500);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let query = supabase
    .from("applications")
    .select("id,user_id,job_id,job_title,applied_at,status,application_status,hidden_from_user,invalid_application,hidden_reason,match_score,skip_reason,decision_reasons,missing_skills,matched_skills,error_reason,provider_used")
    .order("applied_at", { ascending: false })
    .limit(limit);

  if (dateFrom) query = query.gte("applied_at", dateFrom);
  if (dateTo)   query = query.lte("applied_at", dateTo + "T23:59:59Z");
  if (userId)   query = query.eq("user_id", userId);
  if (status)   query = query.eq("status", status);

  const { data: apps, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((apps || []).map((a: any) => a.user_id).filter(Boolean))];
  const jobIds  = [...new Set((apps || []).map((a: any) => a.job_id).filter(Boolean))];

  const [{ data: users }, { data: jobs }, { data: cvs }] = await Promise.all([
    userIds.length > 0
      ? supabase.from("users").select("id,full_name,phone").in("id", userIds)
      : Promise.resolve({ data: [] as any[] }),
    jobIds.length > 0
      ? supabase.from("admin_jobs").select("id,title_ar,title_en,company,application_email").in("id", jobIds)
      : Promise.resolve({ data: [] as any[] }),
    userIds.length > 0
      ? supabase.from("user_cvs").select("user_id,cv_parsed_text,file_name").in("user_id", userIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const userMap = new Map((users || []).map((u: any) => [u.id, u]));
  const jobMap  = new Map((jobs  || []).map((j: any) => [j.id, j]));
  const cvMap   = new Map((cvs   || []).map((c: any) => [c.user_id, c]));

  const today = todayStart.toISOString();

  const enriched = (apps || []).map((a: any) => {
    const user = userMap.get(a.user_id);
    const job  = jobMap.get(a.job_id);
    const cv   = cvMap.get(a.user_id);
    return {
      ...a,
      user_name: user?.full_name || "غير معروف",
      user_phone: user?.phone || "",
      company: job?.company || a.company || "",
      job_title_display: job?.title_ar || job?.title_en || a.job_title || "—",
      application_email: job?.application_email || "",
      cv_parsed_text: cv?.cv_parsed_text || null,
      is_today: a.applied_at >= today,
    };
  });

  const stats = {
    total: enriched.length,
    sent:    enriched.filter((a: any) => a.status === "sent").length,
    skipped: enriched.filter((a: any) => a.status === "skipped").length,
    error:   enriched.filter((a: any) => a.status === "error").length,
    today_sent: enriched.filter((a: any) => a.is_today && a.status === "sent").length,
    today_skipped: enriched.filter((a: any) => a.is_today && a.status === "skipped").length,
  };

  return NextResponse.json({ ok: true, applications: enriched, stats });
}

export async function DELETE(req: Request) {
  const denied = enforcePermission("jobs");
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { mode, user_id } = body;

  if (mode !== "retry_skipped") {
    return NextResponse.json({ ok: false, error: "mode غير معروف" }, { status: 400 });
  }

  // حذف سجلات الـ skipped (غير المحظورة بالجنس) لإعادة معالجتها من الـ Worker
  let query = supabase
    .from("applications")
    .delete({ count: "exact" })
    .eq("status", "skipped")
    .neq("application_status", "invalid"); // نبقي حظر الجنس والحظر الصريح

  if (user_id) {
    query = (query as any).eq("user_id", user_id);
  }

  const { error, count } = await (query as any);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: count || 0 });
}
