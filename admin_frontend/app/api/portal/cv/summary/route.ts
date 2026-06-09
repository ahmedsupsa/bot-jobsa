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
    return NextResponse.json({ error: "لا يوجد نص مستخرج من السيرة" }, { status: 400 });
  }

  // Generate a simple summary from the parsed text
  const text = cv.cv_parsed_text;

  // Extract key sections
  const summary: Record<string, string> = {};

  // Try to find contact info
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (emailMatch) summary.email = emailMatch[0];

  const phoneMatch = text.match(/(\+?[\d\-\(\)\s]{7,})/);
  if (phoneMatch) summary.phone = phoneMatch[0].trim();

  // Take first 300 chars as a summary
  const cleanText = text.replace(/\s+/g, " ").trim();
  summary.overview = cleanText.slice(0, 300) + (cleanText.length > 300 ? "..." : "");

  // Save to cv_profile
  await supabase.from("user_cvs").update({ cv_profile: summary }).eq("user_id", uid);

  return NextResponse.json({ ok: true, summary });
}
