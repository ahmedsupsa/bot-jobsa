import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

/** استدعاء Gemini مع نص فقط */
async function suggestFromText(cvText: string, cvProfile: Record<string, unknown> | null): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];

  const specialization = cvProfile?.specialization ? `التخصص: ${cvProfile.specialization}` : "";
  const degree = cvProfile?.degree ? `المؤهل: ${cvProfile.degree}` : "";
  const skills = Array.isArray(cvProfile?.skills)
    ? `المهارات: ${(cvProfile.skills as string[]).slice(0, 8).join("، ")}` : "";
  const prevJobs = Array.isArray(cvProfile?.prev_jobs)
    ? `الخبرات السابقة: ${(cvProfile.prev_jobs as string[]).slice(0, 3).join("، ")}` : "";

  const context = [specialization, degree, skills, prevJobs].filter(Boolean).join("\n");

  const prompt = `أنت خبير في سوق العمل السعودي.
بناءً على المعلومات التالية، اقترح بالضبط 20 مسمى وظيفي مناسبًا لهذا الشخص.

${context ? context + "\n\n" : ""}نبذة من السيرة الذاتية:
${cvText.slice(0, 2000)}

القواعد:
- 20 مسمى بالضبط
- بالعربية فقط
- مسميات واقعية ومطلوبة في السوق السعودي
- لا تشمل تمهير أو تدريب تعاوني
- أعد JSON فقط: {"titles":["مسمى 1","مسمى 2",...]}`;

  return callGeminiText(key, prompt);
}

/** استدعاء Gemini مع ملف PDF/صورة مباشرة */
async function suggestFromFile(fileBase64: string, mimeType: string): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];

  const prompt = `أنت خبير في سوق العمل السعودي.
اقرأ هذه السيرة الذاتية واقترح بالضبط 20 مسمى وظيفي مناسبًا لصاحبها في سوق العمل السعودي.

القواعد:
- 20 مسمى بالضبط
- بالعربية فقط
- مسميات واقعية ومطلوبة في السوق السعودي
- لا تشمل تمهير أو تدريب تعاوني
- أعد JSON فقط: {"titles":["مسمى 1","مسمى 2",...]}`;

  return callGeminiMultimodal(key, prompt, fileBase64, mimeType);
}

async function callGeminiText(key: string, prompt: string): Promise<string[]> {
  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"];
  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: AbortSignal.timeout(45000),
        }
      );
      if (!r.ok) { console.warn(`[suggest-text] ${model} HTTP ${r.status}`); continue; }
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) { console.warn(`[suggest-text] ${model} empty response`); continue; }
      const titles = parseTitles(text);
      if (titles.length > 0) return titles;
    } catch (e) { console.warn(`[suggest-text] ${model} error:`, e); continue; }
  }
  return [];
}

async function callGeminiMultimodal(key: string, prompt: string, fileBase64: string, mimeType: string): Promise<string[]> {
  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"];
  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: mimeType, data: fileBase64 } },
                { text: prompt },
              ],
            }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
          }),
          signal: AbortSignal.timeout(50000),
        }
      );
      if (!r.ok) continue;
      const data = await r.json();
      const titles = parseTitles(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
      if (titles.length > 0) return titles;
    } catch { continue; }
  }
  return [];
}

function parseTitles(raw: string): string[] {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed.titles)) return [];
    return parsed.titles
      .map((t: unknown) => String(t).trim())
      .filter((t: string) => t.length >= 2 && t.length <= 60 && /[\u0600-\u06FF]/.test(t))
      .slice(0, 20);
  } catch { return []; }
}

export async function POST(req: Request) {
  try {
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
    const uid = payload.user_id;
    const supabase = freshClient();

    const { data: cvRows } = await supabase
      .from("user_cvs")
      .select("cv_parsed_text, cv_profile, storage_path, file_name")
      .eq("user_id", uid)
      .limit(1);

    const cv = cvRows?.[0];

    if (!cv) {
      return NextResponse.json({ error: "لم يتم رفع سيرة ذاتية بعد — ارفع سيرتك أولاً" }, { status: 400 });
    }

    const cvText = String(cv.cv_parsed_text ?? "").trim();
    const cvProfile = (cv.cv_profile ?? null) as Record<string, unknown> | null;

    let titles: string[] = [];

    // المسار الأول: نص موجود → أسرع
    if (cvText.length > 100 || cvProfile) {
      titles = await suggestFromText(cvText, cvProfile);
    }

    // المسار الثاني: لا نص → نحمّل الملف من Storage مباشرة
    if (titles.length === 0 && cv.storage_path) {
      console.log("[suggest] لا نص محلَّل — يحمّل الملف من Storage…");

      const { data: fileData, error: dlErr } = await supabase.storage
        .from("cvs")
        .download(String(cv.storage_path));

      if (!dlErr && fileData) {
        const ext = String(cv.file_name ?? "cv.pdf").split(".").pop()?.toLowerCase() || "pdf";
        const mimeMap: Record<string, string> = {
          pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        };
        const mimeType = mimeMap[ext] || "application/pdf";
        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        titles = await suggestFromFile(base64, mimeType);
      }
    }

    if (titles.length === 0) {
      return NextResponse.json({
        error: "لم يتمكن الذكاء الاصطناعي من تحليل السيرة — تأكد أن الملف واضح وأعد المحاولة",
      }, { status: 422 });
    }

    return NextResponse.json({ titles });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[suggest] unexpected error:", msg);
    return NextResponse.json({ error: `خطأ في السيرفر: ${msg}` }, { status: 500 });
  }
}
