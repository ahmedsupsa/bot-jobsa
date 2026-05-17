import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";

export async function GET(
  _req: Request,
  { params }: { params: { userId: string } }
) {
  const denied = enforcePermission("jobs");
  if (denied) return denied;

  const userId = params.userId;

  const [
    { data: user },
    { data: apps },
    { data: cv },
    { data: prefs },
    { data: fields },
    { data: settings },
  ] = await Promise.all([
    supabase.from("users").select("id,full_name,phone,subscription_ends_at,created_at").eq("id", userId).single(),
    supabase.from("applications")
      .select("id,job_id,job_title,applied_at,status,match_score,skip_reason,decision_reasons,missing_skills,matched_skills,error_reason,provider_used")
      .eq("user_id", userId)
      .order("applied_at", { ascending: false })
      .limit(300),
    supabase.from("user_cvs").select("user_id,file_name,cv_parsed_text,cv_parsed_at").eq("user_id", userId).single(),
    supabase.from("user_job_preferences").select("job_field_id").eq("user_id", userId),
    supabase.from("job_fields").select("id,name_ar"),
    supabase.from("user_settings").select("email,smtp_email,email_connected,application_language").eq("user_id", userId).single(),
  ]);

  const fieldMap  = new Map((fields || []).map((f: any) => [String(f.id), f.name_ar]));
  const prefNames = (prefs || []).map((p: any) => fieldMap.get(String(p.job_field_id))).filter(Boolean);

  const jobIds = [...new Set((apps || []).map((a: any) => a.job_id).filter(Boolean))];
  const { data: jobs } = jobIds.length > 0
    ? await supabase.from("admin_jobs").select("id,title_ar,title_en,company,application_email,description_ar").in("id", jobIds)
    : { data: [] as any[] };

  const jobMap = new Map((jobs || []).map((j: any) => [j.id, j]));

  const enrichedApps = (apps || []).map((a: any) => {
    const job = jobMap.get(a.job_id);
    return {
      ...a,
      company: job?.company || "",
      job_title_display: job?.title_ar || job?.title_en || a.job_title || "—",
      application_email: job?.application_email || "",
    };
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = {
    total:         enrichedApps.length,
    sent:          enrichedApps.filter((a: any) => a.status === "sent").length,
    skipped:       enrichedApps.filter((a: any) => a.status === "skipped").length,
    error:         enrichedApps.filter((a: any) => a.status === "error").length,
    today_sent:    enrichedApps.filter((a: any) => a.status === "sent"    && new Date(a.applied_at) >= today).length,
    today_skipped: enrichedApps.filter((a: any) => a.status === "skipped" && new Date(a.applied_at) >= today).length,
  };

  return NextResponse.json({
    ok: true,
    user: user || null,
    settings: settings || null,
    cv: cv || null,
    preferences: prefNames,
    applications: enrichedApps,
    stats,
  });
}
