import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

type TaxEntry = { m: string; m_en: string; j: string[]; j_en?: string[]; c: string };
type Taxonomy = Record<string, TaxEntry>;
type CvProfile = Record<string, unknown>;

// ── تحميل التاكسونومي من الملف مرة واحدة ──────────────────────────────────────
let _taxonomy: Taxonomy | null = null;
function getTaxonomy(): Taxonomy {
  if (_taxonomy) return _taxonomy;
  try {
    const filePath = path.join(process.cwd(), "public", "jobs_taxonomy_compact.json");
    _taxonomy = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Taxonomy;
  } catch {
    _taxonomy = {};
  }
  return _taxonomy;
}

// ── تطبيع النص العربي للمقارنة ────────────────────────────────────────────────
function norm(s: string): string {
  return String(s || "").trim().toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

// ── استخراج المسميات من التاكسونومي بناءً على cv_profile ──────────────────────
function suggestFromTaxonomy(profile: CvProfile | null): { titles: string[]; matchedMajor: string } {
  if (!profile) return { titles: [], matchedMajor: "" };

  const spec   = String(profile.specialization || profile.degree || "").trim();
  const specEn = String(profile.specialization_en || profile.degree_en || "").toLowerCase().trim();
  if (!spec && !specEn) return { titles: [], matchedMajor: "" };

  const specNorm = norm(spec);
  const taxonomy = getTaxonomy();

  const titlesSet = new Set<string>();
  let bestMatch = "";
  let bestScore = 0;

  for (const entry of Object.values(taxonomy)) {
    const mNorm  = norm(entry.m);
    const mEnNorm = (entry.m_en || "").toLowerCase();
    let score = 0;

    if (specNorm && mNorm === specNorm)                                       score = 100;
    else if (specNorm && specNorm.length > 3 && mNorm === specNorm)           score = 100;
    else if (specNorm && mNorm.includes(specNorm) && specNorm.length > 4)     score = 80;
    else if (specNorm && specNorm.includes(mNorm) && mNorm.length > 4)        score = 80;
    else if (specEn && mEnNorm && mEnNorm === specEn)                         score = 90;
    else if (specEn && mEnNorm && mEnNorm.includes(specEn) && specEn.length > 4) score = 70;
    else if (specEn && mEnNorm && specEn.includes(mEnNorm) && mEnNorm.length > 4) score = 70;

    if (score > 0) {
      entry.j.forEach(j => titlesSet.add(j));
      if (score > bestScore) { bestScore = score; bestMatch = entry.m; }
    }
  }

  return { titles: [...titlesSet].slice(0, 20), matchedMajor: bestMatch };
}

// ── Gemini: اقتراح من النص (fallback فقط) ────────────────────────────────────
async function suggestFromAI(cvText: string, profile: CvProfile | null): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];

  const spec     = profile?.specialization ? `التخصص: ${profile.specialization}` : "";
  const degree   = profile?.degree ? `المؤهل: ${profile.degree}` : "";
  const skills   = Array.isArray(profile?.skills)
    ? `المهارات: ${(profile.skills as string[]).slice(0, 8).join("، ")}` : "";
  const prevJobs = Array.isArray(profile?.prev_jobs)
    ? `الخبرات: ${(profile.prev_jobs as string[]).slice(0, 3).join("، ")}` : "";

  const context = [spec, degree, skills, prevJobs].filter(Boolean).join("\n");

  const prompt =
    `أنت خبير في سوق العمل السعودي.\n` +
    `بناءً على المعلومات التالية، اقترح بالضبط 20 مسمى وظيفي مناسبًا لهذا الشخص.\n\n` +
    (context ? context + "\n\n" : "") +
    `نبذة من السيرة الذاتية:\n${cvText.slice(0, 2000)}\n\n` +
    `القواعد:\n` +
    `- 20 مسمى بالضبط\n` +
    `- بالعربية فقط\n` +
    `- مسميات واقعية ومطلوبة في السوق السعودي\n` +
    `- لا تشمل تمهير أو تدريب تعاوني\n` +
    `- أعد JSON فقط: {"titles":["مسمى 1","مسمى 2",...]}`;

  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
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
      if (!r.ok) continue;
      const data = await r.json();
      const titles = parseTitles(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
      if (titles.length > 0) return titles;
    } catch { continue; }
  }
  return [];
}

async function suggestFromFile(fileBase64: string, mimeType: string): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];

  const prompt =
    `أنت خبير في سوق العمل السعودي.\n` +
    `اقرأ هذه السيرة الذاتية واقترح بالضبط 20 مسمى وظيفي مناسبًا لصاحبها في سوق العمل السعودي.\n` +
    `القواعد:\n- 20 مسمى بالضبط\n- بالعربية فقط\n- مسميات واقعية\n- لا تشمل تمهير أو تدريب تعاوني\n` +
    `- أعد JSON فقط: {"titles":["مسمى 1","مسمى 2",...]}`;

  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [
              { inline_data: { mime_type: mimeType, data: fileBase64 } },
              { text: prompt },
            ]}],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
          }),
          signal: AbortSignal.timeout(50000),
        }
      );
      if (!r.ok) continue;
      const titles = parseTitles(
        (await r.json())?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
      );
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

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });

    const supabase = freshClient();
    const { data: cvRows } = await supabase
      .from("user_cvs")
      .select("cv_parsed_text, cv_profile, storage_path, file_name")
      .eq("user_id", payload.user_id)
      .limit(1);

    const cv = cvRows?.[0];
    if (!cv) {
      return NextResponse.json(
        { error: "لم يتم رفع سيرة ذاتية بعد — ارفع سيرتك أولاً" },
        { status: 400 }
      );
    }

    const cvText   = String(cv.cv_parsed_text ?? "").trim();
    const cvProfile = (cv.cv_profile ?? null) as CvProfile | null;

    // ── المسار الأول: تاكسونومي (فوري، بدون AI) ─────────────────────────────
    const { titles: taxTitles, matchedMajor } = suggestFromTaxonomy(cvProfile);
    if (taxTitles.length >= 5) {
      return NextResponse.json({
        titles: taxTitles,
        source: "taxonomy",
        matched_major: matchedMajor,
      });
    }

    // ── المسار الثاني: AI من النص المحلَّل ──────────────────────────────────
    if (cvText.length > 100 || cvProfile) {
      const aiTitles = await suggestFromAI(cvText, cvProfile);
      if (aiTitles.length > 0) {
        return NextResponse.json({ titles: aiTitles, source: "ai" });
      }
    }

    // ── المسار الثالث: AI من ملف PDF مباشرة ─────────────────────────────────
    if (cv.storage_path) {
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("cvs")
        .download(String(cv.storage_path));

      if (!dlErr && fileData) {
        const ext = String(cv.file_name ?? "cv.pdf").split(".").pop()?.toLowerCase() || "pdf";
        const mimeMap: Record<string, string> = {
          pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        };
        const base64 = Buffer.from(await fileData.arrayBuffer()).toString("base64");
        const aiTitles = await suggestFromFile(base64, mimeMap[ext] || "application/pdf");
        if (aiTitles.length > 0) {
          return NextResponse.json({ titles: aiTitles, source: "ai" });
        }
      }
    }

    return NextResponse.json(
      { error: "لم يتمكن النظام من استخراج المسميات — تأكد أن الملف واضح وأعد المحاولة" },
      { status: 422 }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[suggest] unexpected error:", msg);
    return NextResponse.json({ error: `خطأ في السيرفر: ${msg}` }, { status: 500 });
  }
}
