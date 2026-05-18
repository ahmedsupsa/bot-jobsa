import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function suggestTitlesWithGemini(cvText: string, cvProfile: Record<string, unknown> | null): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];

  const specialization = cvProfile?.specialization ? `التخصص: ${cvProfile.specialization}` : "";
  const degree = cvProfile?.degree ? `المؤهل: ${cvProfile.degree}` : "";
  const skills = Array.isArray(cvProfile?.skills) ? `المهارات: ${(cvProfile.skills as string[]).slice(0, 8).join("، ")}` : "";
  const prevJobs = Array.isArray(cvProfile?.prev_jobs) ? `الخبرات السابقة: ${(cvProfile.prev_jobs as string[]).slice(0, 3).join("، ")}` : "";

  const context = [specialization, degree, skills, prevJobs].filter(Boolean).join("\n");

  const prompt = `أنت خبير في سوق العمل السعودي.
بناءً على المعلومات التالية، اقترح بالضبط 20 مسمى وظيفي مناسبًا لهذا الشخص في سوق العمل السعودي.

${context}

نبذة من السيرة الذاتية:
${cvText.slice(0, 1500)}

القواعد الصارمة:
- 20 مسمى بالضبط، لا أكثر ولا أقل
- بالعربية فقط
- مسميات واقعية ومطلوبة فعلاً في السوق السعودي
- تنوّع بين المسميات (لا تكرر نفس المسمى بصياغات مختلفة)
- لا تشمل مسميات تمهير أو تدريب تعاوني
- أعد JSON فقط بدون أي نص إضافي:
{"titles":["مسمى 1","مسمى 2","مسمى 3","مسمى 4","مسمى 5","مسمى 6","مسمى 7","مسمى 8","مسمى 9","مسمى 10","مسمى 11","مسمى 12","مسمى 13","مسمى 14","مسمى 15","مسمى 16","مسمى 17","مسمى 18","مسمى 19","مسمى 20"]}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!r.ok) return [];
    const data = await r.json();
    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed.titles)) return [];
    return parsed.titles
      .map((t: unknown) => String(t).trim())
      .filter((t: string) => t.length >= 2 && t.length <= 60)
      .slice(0, 20);
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;
  const supabase = freshClient();

  const { data: cvRows } = await supabase
    .from("user_cvs")
    .select("cv_parsed_text, cv_profile")
    .eq("user_id", uid)
    .limit(1);

  const cv = cvRows?.[0];
  const cvText = String(cv?.cv_parsed_text ?? "").trim();
  const cvProfile = (cv?.cv_profile ?? null) as Record<string, unknown> | null;

  if (!cvText && !cvProfile) {
    return NextResponse.json({ error: "لم يتم تحليل السيرة الذاتية بعد — انتظر دقيقة وأعد المحاولة" }, { status: 400 });
  }

  const titles = await suggestTitlesWithGemini(cvText, cvProfile);

  if (titles.length === 0) {
    return NextResponse.json({ error: "لم يتمكن الذكاء الاصطناعي من توليد الاقتراحات — حاول مجدداً" }, { status: 422 });
  }

  return NextResponse.json({ titles });
}
