import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

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
    return NextResponse.json({ error: "لا يوجد نص مستخرج من السيرة — السيرة قد تكون صورة وليس PDF نصياً. ارفع PDF نصي (غير مصور)" }, { status: 400 });
  }

  const text = cv.cv_parsed_text;
  const summary: Record<string, string> = {};

  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (emailMatch) summary.email = emailMatch[0];

  const phoneMatch = text.match(/(?:05|5|\+9665|9665|٠٥)(?:\d[\s\-]?){8}/);
  if (!phoneMatch) {
    const fallback = text.match(/(\+?[\d\-\(\)\s]{7,})/);
    if (fallback) summary.phone = fallback[0].trim();
  } else {
    summary.phone = phoneMatch[0].trim();
  }

  const cleanText = text.replace(/\s+/g, " ").trim();
  if (cleanText) {
    summary.overview = cleanText.slice(0, 500) + (cleanText.length > 500 ? "..." : "");
  }

  await supabase.from("user_cvs").update({ cv_profile: summary }).eq("user_id", uid);

  return NextResponse.json({ ok: true, summary });
}
