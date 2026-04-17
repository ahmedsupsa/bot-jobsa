import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  if (!GEMINI_KEY) return NextResponse.json({ error: "مفتاح Gemini غير مُعدّ" }, { status: 500 });

  // 1. Get user's CV
  const { data: cvRows } = await supabase
    .from("user_cvs")
    .select("storage_path, file_name")
    .eq("user_id", uid)
    .limit(1);

  const cv = cvRows?.[0];
  if (!cv?.storage_path) {
    return NextResponse.json({ error: "لم يتم رفع سيرة ذاتية بعد" }, { status: 400 });
  }

  // 2. Download CV from storage
  const { data: fileData, error: dlErr } = await supabase.storage
    .from("cvs")
    .download(cv.storage_path);

  if (dlErr || !fileData) {
    return NextResponse.json({ error: "فشل تحميل السيرة الذاتية" }, { status: 500 });
  }

  // 3. Build Gemini request
  const ext = (cv.file_name || "").split(".").pop()?.toLowerCase() || "pdf";
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };
  const mimeType = mimeMap[ext] || "application/pdf";
  const arrayBuffer = await fileData.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const prompt = `أنت خبير موارد بشرية متخصص في السوق العربية والسعودية.

اقرأ السيرة الذاتية المرفقة بعناية، ثم:
1. استخرج كل المسميات الوظيفية والتخصصات الممكنة لصاحب هذه السيرة
2. اقترح على الأقل 20 مسمى وظيفي أو تخصص مناسب له
3. اكتب ملخصاً قصيراً لخبرة الشخص

أرجع الإجابة بصيغة JSON فقط بدون أي شرح:
{
  "job_titles": ["مسمى 1", "مسمى 2", "مسمى 3", ...],
  "summary": "ملخص خبرة الشخص بجملتين"
}

ملاحظات:
- job_titles يجب أن تحتوي على 15-25 مسمى بالعربية
- المسميات يجب أن تكون واقعية ومناسبة للسوق السعودي
- أرجع JSON فقط بدون أي نص إضافي`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
  };

  const gemRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  if (!gemRes.ok) {
    const errText = await gemRes.text();
    console.error("Gemini error:", errText);
    return NextResponse.json({ error: `فشل تحليل السيرة: ${gemRes.status} — ${errText.slice(0, 200)}` }, { status: 500 });
  }

  const gemData = await gemRes.json();
  const rawText = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  console.log("Gemini raw:", rawText.slice(0, 300));

  // Robust JSON extraction
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  let parsed: { job_titles?: string[]; summary?: string } = {};
  if (jsonMatch) {
    try { parsed = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
  }

  const jobTitles: string[] = parsed.job_titles || [];
  const summary: string = parsed.summary || "";

  if (jobTitles.length === 0) {
    console.error("No job titles extracted. Raw:", rawText);
    return NextResponse.json({ error: "لم يتمكن الذكاء الاصطناعي من استخراج المسميات — تأكد من وضوح السيرة" }, { status: 422 });
  }

  // 4. Upsert job titles into job_fields (if not already there)
  const insertedIds: string[] = [];
  for (const title of jobTitles) {
    const trimmed = title.trim();
    if (!trimmed) continue;

    // Check if already exists
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
