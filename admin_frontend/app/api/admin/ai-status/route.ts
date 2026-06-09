import { NextResponse } from "next/server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const SYSTEMS = [
  {
    key: "cover_letter",
    label: "قوالب رسائل التقديم",
    desc: "5 قوالب إبداعية مكتوبة مسبقاً — لا تحتاج ذكاء اصطناعي",
    deps: [] as string[],
  },
  {
    key: "cv_validation",
    label: "تدقيق السيرة الذاتية",
    desc: "تحليل بالكلمات المفتاحية والأنماط — طول النص، عدد الأسطر، الكلمات الدلالية",
    deps: [] as string[],
  },
  {
    key: "job_matching",
    label: "مطابقة الوظائف",
    desc: "مطابقة بالتخصصات (taxonomy) والكلمات المفتاحية — بدون استدعاء خارجي",
    deps: [] as string[],
  },
];

const FEATURES = [
  { key: "cover_letter",    label: "رسالة التغطية (Worker)",         route: "قوالب مدمجة في الكود" },
  { key: "cv_parse",        label: "تحليل السيرة الذاتية",           route: "تحليل محلي (نصوص + كلمات مفتاحية)" },
  { key: "job_spec",        label: "تخصصات الوظائف",                 route: "تصنيف يدوي (taxonomy)" },
  { key: "job_bulk",        label: "رفع وظائف Excel",                route: "/api/admin/jobs/bulk" },
  { key: "job_fetch",       label: "استيراد وظائف تلقائي",           route: "/api/admin/jobs/fetch" },
];

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();

  // التحقق من وجود القوالب — نتحقق أن الـ worker function منشور
  let workerOk = false;
  try {
    const { count } = await supabase
      .from("worker_logs")
      .select("id", { count: "exact", head: true })
      .gte("ran_at", new Date(Date.now() - 86400000).toISOString());
    workerOk = (count ?? 0) > 0;
  } catch {}

  // التحقق من وجود أنظمة CV قد رفعت
  let cvCount = 0;
  try {
    const { count } = await supabase
      .from("user_cvs")
      .select("user_id", { count: "exact", head: true });
    cvCount = count ?? 0;
  } catch {}

  const systemsOk = {
    cover_letter: { ok: true, note: "5 قوالب جاهزة — مدمجة في worker و preview-letter" },
    cv_validation: { ok: true, note: `${cvCount} سيرة مرفوعة — تدقيق بالكلمات المفتاحية` },
    job_matching: { ok: true, note: "مطابقة بتصنيف التخصصات (SPECIALIZATIONS + keywords)" },
  };

  const allOk = Object.values(systemsOk).every(s => s.ok);

  return NextResponse.json({
    ok: allOk,
    systems: systemsOk,
    features: FEATURES,
    features_ok: allOk,
    worker_active_24h: workerOk,
    cv_count: cvCount,
    checked_at: new Date().toISOString(),
  });
}
