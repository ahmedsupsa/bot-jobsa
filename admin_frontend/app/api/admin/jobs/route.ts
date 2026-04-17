import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { data: jobs } = await supabase
    .from("admin_jobs")
    .select("*")
    .order("created_at", { ascending: false });
  return NextResponse.json({ ok: true, jobs: jobs || [] });
}

export async function POST(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const body = await req.json().catch(() => ({}));
  const { error, data } = await supabase.from("admin_jobs").insert({
    title_ar: body.title_ar || "",
    title_en: body.title_en || "",
    company: body.company || "",
    description_ar: body.description_ar || "",
    description_en: body.description_en || "",
    application_email: body.application_email || "",
    specializations: body.specializations || "",
    gender_target: body.gender_target || "any",
    is_active: true,
    created_at: new Date().toISOString(),
  }).select("id").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}

export async function DELETE(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await supabase.from("admin_jobs").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
