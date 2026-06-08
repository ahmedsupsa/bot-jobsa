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

// ── كلمات مفتاحية للمجالات للبحث المباشر في السيرة ──────────────────────────────
const FIELD_KW: Record<string, string[]> = {
  "محاسبة": ["محاسب", "محاسبه", "audit", "auditor", "مالية", "ضرائب", "زكاة"],
  "هندسة مدنية": ["مهندس مدني", "civil engineer", "civil engineering", "طرق", "كباري", "انشائي"],
  "هندسة ميكانيكية": ["مهندس ميكانيكا", "mechanical engineer", "mechanical engineering", "صيانة", "انتاج"],
  "هندسة كهربائية": ["مهندس كهرباء", "electrical engineer", "electrical engineering", "power", "كهربا"],
  "هندسة حاسب": ["مهندس حاسب", "computer engineer", "computer engineering", "software engineer", "مبرمج", "برمجيات"],
  "تقنية معلومات": ["تقنية معلومات", "information technology", "it", "network", "دعم فني", "نظم"],
  "علوم حاسب": ["علوم حاسب", "computer science", "cs", "developer", "مطور", "برمجه"],
  "نظم معلومات": ["نظم معلومات", "information system", "is", "تحليل"],
  "إدارة أعمال": ["ادارة اعمال", "business administration", "business", "مدير"],
  "تسويق": ["تسويق", "marketing", "digital marketing", "تسويق الكتروني", "seo", "social media"],
  "موارد بشرية": ["موارد بشرية", "hr", "human resources", "توظيف", "recruitment"],
  "طب بشري": ["طبيب", "دكتور", "طب بشري", "medicine", "medical", "طبي"],
  "تمريض": ["ممرض", "تمريض", "nursing", "nurse"],
  "صيدلة": ["صيدلي", "صيدله", "pharmacy", "pharmacist"],
  "هندسة صناعية": ["مهندس صناعي", "industrial engineer", "industrial engineering"],
  "هندسة كيميائية": ["مهندس كيميائي", "chemical engineer", "chemical engineering"],
  "قانون": ["محامي", "قانون", "legal", "law", "مستشار قانوني"],
  "لغة إنجليزية": ["لغة انجليزية", "english language", "ترجمة", "translation", "مترجم"],
  "تعليم": ["معلم", "مدرس", "teacher", "education", "تربوي", "تدريس"],
  "إعلام": ["اعلام", "media", "صحفي", "journalist", "علاقات عامة"],
};

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

// ── استخراج المسميات من النص الخام للسيرة الذاتية ──────────────────────────────
function suggestFromCvText(cvText: string): { titles: string[]; matchedMajor: string } {
  const txt = String(cvText || "").trim();
  if (!txt || txt.length < 50) return { titles: [], matchedMajor: "" };

  const txtNorm = norm(txt);
  const taxonomy = getTaxonomy();
  const titlesSet = new Set<string>();
  let bestMatch = "";
  let bestScore = 0;

  // 1. بحث الكلمات المفتاحية للمجالات
  for (const [major, kws] of Object.entries(FIELD_KW)) {
    if (kws.some(kw => txtNorm.includes(norm(kw)))) {
      // وجدنا مجال — نجيب وظائف كل الأنواع المرتبطة
      for (const entry of Object.values(taxonomy)) {
        if (norm(entry.m).includes(norm(major)) || norm(major).includes(norm(entry.m))) {
          entry.j.forEach(j => titlesSet.add(j));
          if (!bestMatch) bestMatch = entry.m;
          bestScore = 1;
        }
      }
    }
  }

  // 2. بحث مباشر عن أسماء المسميات الوظيفية في نص السيرة
  for (const entry of Object.values(taxonomy)) {
    for (const job of entry.j) {
      const jNorm = norm(job);
      if (jNorm.length > 4 && txtNorm.includes(jNorm)) {
        titlesSet.add(job);
        if (!bestMatch) { bestMatch = entry.m; }
      }
    }
  }

  // 3. بحث عن كلمات التخصص في كل سطر من السيرة
  const lines = txtNorm.split("\n").filter(l => l.trim().length > 5);
  for (const line of lines) {
    if (line.includes("تخصص") || line.includes("مجال") || line.includes("قسم")) {
      for (const entry of Object.values(taxonomy)) {
        if (line.includes(norm(entry.m))) {
          entry.j.forEach(j => titlesSet.add(j));
          if (!bestMatch) bestMatch = entry.m;
        }
      }
    }
  }

  return { titles: [...titlesSet].slice(0, 20), matchedMajor: bestMatch };
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

    // ── المسار الأول: تاكسونومي على cv_profile ──────────────────────────────
    const { titles: taxTitles, matchedMajor } = suggestFromTaxonomy(cvProfile);
    if (taxTitles.length > 0) {
      return NextResponse.json({
        titles: taxTitles,
        source: "taxonomy",
        matched_major: matchedMajor,
      });
    }

    // ── المسار الثاني: بحث مباشر في النص الخام للسيرة الذاتية ──────────────
    if (cvText) {
      const { titles: textTitles, matchedMajor: textMajor } = suggestFromCvText(cvText);
      if (textTitles.length > 0) {
        return NextResponse.json({
          titles: textTitles,
          source: "cv_text",
          matched_major: textMajor,
        });
      }
    }

    // ── المسار الثالث: قفشات من كلمات مختصرة (مثل: بكالوريوس + كلمة مفتاحية) ──
    // نبحث عن أي كلمة تخصص في النص ونطابقها مع الـ taxonomy
    if (cvText) {
      const words = cvText.split(/[\s،,.\n]+/).filter(w => w.length > 4);
      const fieldWords = words.filter(w => /^(مهندس|محاسب|ممرض|معلم|محامي|صيدلي|مطور|مبرمج|مدير|مسوق|أخصائي|اخصائي|فني|مستشار)/.test(w));
      if (fieldWords.length > 0) {
        const { titles: wordTitles } = suggestFromCvText(fieldWords.join(" "));
        if (wordTitles.length > 0) {
          return NextResponse.json({
            titles: wordTitles,
            source: "cv_keywords",
            matched_major: "",
          });
        }
      }
    }

    return NextResponse.json(
      { error: "لم يتمكن النظام من استخراج المسميات — أضف تخصصاتك يدوياً من صفحة الملف الشخصي" },
      { status: 422 }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[suggest] unexpected error:", msg);
    return NextResponse.json({ error: `خطأ في السيرفر: ${msg}` }, { status: 500 });
  }
}
