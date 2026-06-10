import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";
import { parseCvText, matchCategory } from "@/lib/cv-parser";

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const { data: rows } = await supabase
    .from("user_cvs")
    .select("cv_parsed_text, cv_profile")
    .eq("user_id", uid)
    .limit(1);

  const cv = rows?.[0];
  if (!cv?.cv_parsed_text) {
    return NextResponse.json({
      error: "لا يوجد نص مستخرج — السيرة قد تكون صورة. ارفع PDF نصي أو صورة واضحة."
    }, { status: 400 });
  }

  const profile = parseCvText(cv.cv_parsed_text);

  const toSave: Record<string, any> = {
    ...profile,
    skills: profile.skills || [],
    soft_skills: profile.soft_skills || [],
    certifications: profile.certifications || [],
    job_categories: profile.job_categories || [],
  };

  await supabase.from("user_cvs").update({ cv_profile: toSave }).eq("user_id", uid);

  return NextResponse.json({
    ok: true,
    profile,
    message: "تم تحليل السيرة بنجاح ✓",
  });
}
