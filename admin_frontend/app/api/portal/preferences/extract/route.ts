import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_KEY = () => process.env.GEMINI_API_KEY || "";

// نماذج Gemini المدعومة لـ multimodal (PDF + صور) — مُثبتة في الـ Worker
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

/** استدعاء Gemini مع إعادة المحاولة على نماذج متعددة */
async function callGeminiWithFile(
  promptText: string,
  fileBase64: string,
  mimeType: string
): Promise<string> {
  const key = GEMINI_KEY();
  if (!key) throw new Error("GEMINI_API_KEY غير مضبوط");

  let lastErr = "";
  for (const model of MODELS) {
    try {
      const body = {
        contents: [{
          parts: [
            // الملف أولاً ثم التعليمات — أفضل أداء مع PDFs
            { inline_data: { mime_type: mimeType, data: fileBase64 } },
            { text: promptText },
          ],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(55000),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        const errMsg = data?.error?.message || JSON.stringify(data).slice(0, 150);
        lastErr = `${model}: HTTP ${res.status} — ${errMsg}`;
        console.warn(`[extract] ${lastErr}`);
        // لا تحاول النموذج التالي إذا كان الخطأ في المفتاح أو الحصة
        if (res.status === 400 && errMsg.includes("API_KEY")) throw new Error(errMsg);
        continue;
      }

      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (text.trim()) return text.trim();

      // finishReason check
      const reason = data?.candidates?.[0]?.finishReason;
      lastErr = `${model}: finishReason=${reason} استجابة فارغة`;
      console.warn(`[extract] ${lastErr}`);
    } catch (e: unknown) {
      lastErr = `${model}: ${(e as Error).message}`;
      console.warn(`[extract] exception on ${model}:`, lastErr);
      if ((e as Error).message?.includes("AbortError") || (e as Error).message?.includes("timeout")) continue;
      if ((e as Error).message?.includes("API_KEY")) throw e;
    }
  }

  throw new Error(`فشلت جميع النماذج. آخر خطأ: ${lastErr}`);
}

/** استخرج JSON من نص قد يحتوي على markdown code block */
function extractJson(raw: string): Record<string, unknown> {
  // إزالة ```json ... ``` أو ``` ... ```
  const stripped = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // أوجد أول {} block
  const start = stripped.indexOf("{");
  const end   = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) return {};

  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    // حاول تصحيح JSON المكسور
    try {
      return JSON.parse(stripped);
    } catch {
      return {};
    }
  }
}

/** fallback: استخراج مسميات من نص خام إذا فشل JSON */
function extractTitlesFromText(raw: string): string[] {
  const lines = raw.split(/[\n,،]+/).map(l => l.trim()).filter(Boolean);
  const titles: string[] = [];
  for (const line of lines) {
    const cleaned = line
      .replace(/^\d+[\.\)]\s*/, "")   // أزل ترقيم 1. أو 1)
      .replace(/^[-*•]\s*/, "")        // أزل نقاط القائمة
      .replace(/["'«»]/g, "")          // أزل علامات الاقتباس
      .trim();
    if (cleaned.length > 2 && cleaned.length < 80) {
      titles.push(cleaned);
    }
  }
  return titles.slice(0, 25);
}

const PROMPT = `أنت خبير موارد بشرية متخصص في السوق السعودية والخليجية.

اقرأ السيرة الذاتية المرفقة بعناية ثم استخرج:
1. جميع المسميات الوظيفية المناسبة لصاحب هذه السيرة (15 إلى 25 مسمى)
2. ملخص قصير لخبرته

**أرجع JSON فقط** بهذا الشكل بالضبط:
{"job_titles":["مسمى 1","مسمى 2","مسمى 3"],"summary":"ملخص بجملتين"}

قواعد:
- job_titles: 15-25 مسمى بالعربية مناسبة للسوق السعودي
- لا تكتب أي شيء خارج JSON
- لا تستخدم markdown أو code blocks`;

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  if (!GEMINI_KEY()) return NextResponse.json({ error: "مفتاح Gemini غير مُعدّ" }, { status: 500 });

  // 1. جلب السيرة الذاتية
  const { data: cvRows } = await supabase
    .from("user_cvs")
    .select("storage_path, file_name")
    .eq("user_id", uid)
    .limit(1);

  const cv = cvRows?.[0];
  if (!cv?.storage_path) {
    return NextResponse.json({ error: "لم يتم رفع سيرة ذاتية بعد — ارفع سيرتك أولاً" }, { status: 400 });
  }

  // 2. تنزيل الملف
  const { data: fileData, error: dlErr } = await supabase.storage
    .from("cvs")
    .download(cv.storage_path);

  if (dlErr || !fileData) {
    return NextResponse.json({ error: `فشل تحميل السيرة: ${dlErr?.message || "خطأ غير معروف"}` }, { status: 500 });
  }

  const ext = (cv.file_name || "cv.pdf").split(".").pop()?.toLowerCase() || "pdf";
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const mimeType = mimeMap[ext] || "application/pdf";
  const arrayBuffer = await fileData.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // تحقق من حجم الملف (Gemini يقبل حتى ~20MB inline)
  if (arrayBuffer.byteLength > 18 * 1024 * 1024) {
    return NextResponse.json({ error: "حجم السيرة الذاتية كبير جداً — يجب أن يكون أقل من 18MB" }, { status: 413 });
  }

  // 3. استدعاء Gemini
  let rawText = "";
  try {
    rawText = await callGeminiWithFile(PROMPT, base64, mimeType);
    console.log("[extract] Gemini raw (first 400):", rawText.slice(0, 400));
  } catch (e: unknown) {
    const msg = (e as Error).message || String(e);
    console.error("[extract] Gemini error:", msg);
    return NextResponse.json({ error: `فشل تحليل السيرة: ${msg}` }, { status: 500 });
  }

  // 4. استخراج JSON
  const parsed = extractJson(rawText);
  let jobTitles: string[] = [];
  let summary = "";

  if (Array.isArray(parsed.job_titles) && (parsed.job_titles as string[]).length > 0) {
    jobTitles = (parsed.job_titles as string[]).map(String).filter(Boolean);
    summary   = String(parsed.summary || "");
  } else {
    // fallback: استخرج من النص المباشر
    jobTitles = extractTitlesFromText(rawText);
    console.warn("[extract] JSON parse failed, used text fallback. Titles found:", jobTitles.length);
  }

  if (jobTitles.length === 0) {
    console.error("[extract] No titles. Raw:", rawText.slice(0, 500));
    return NextResponse.json({
      error: "لم يتمكن الذكاء الاصطناعي من استخراج المسميات — تأكد أن السيرة بصيغة PDF أو صورة واضحة",
    }, { status: 422 });
  }

  // 5. حفظ المسميات في job_fields
  const insertedIds: string[] = [];
  for (const title of jobTitles) {
    const trimmed = title.trim();
    if (!trimmed) continue;

    const { data: existing } = await supabase
      .from("job_fields")
      .select("id")
      .eq("name_ar", trimmed)
      .limit(1);

    if (existing?.[0]) {
      insertedIds.push(String(existing[0].id));
    } else {
      const { data: inserted } = await supabase
        .from("job_fields")
        .insert({ name_ar: trimmed })
        .select("id")
        .single();
      if (inserted?.id) insertedIds.push(String(inserted.id));
    }
  }

  return NextResponse.json({
    matched_ids: insertedIds,
    job_titles: jobTitles,
    summary,
    all_fields: jobTitles.map((t, i) => ({ id: insertedIds[i] || String(i), name_ar: t })),
  });
}
