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

  // 3. Get all job_fields from DB
  const { data: allFields } = await supabase
    .from("job_fields")
    .select("id, name_ar")
    .order("name_ar");

  const fieldsList = (allFields || []).map((f: any) => `${f.id}: ${f.name_ar}`).join("\n");

  // 4. Build Gemini request
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

  const prompt = `أنت مساعد متخصص في تحليل السير الذاتية للوظائف في السوق العربية.

قائمة مجالات الوظائف المتاحة:
${fieldsList}

المطلوب:
1. اقرأ السيرة الذاتية المرفقة
2. استخرج أهم 20 مسمى وظيفي أو تخصص يناسب صاحب هذه السيرة
3. طابق كل مسمى مع أقرب مجال من القائمة أعلاه
4. أرجع النتيجة بصيغة JSON فقط بدون أي نص إضافي

الصيغة المطلوبة:
{
  "matched_ids": [1, 2, 3],
  "job_titles": ["مسمى 1", "مسمى 2", "..."],
  "summary": "ملخص قصير عن خبرة المتقدم بجملة أو اثنتين"
}

القواعد:
- matched_ids: أرقام IDs من القائمة المتاحة فقط (حتى 20)
- job_titles: مسميات وظيفية مقترحة من السيرة (حتى 20)
- إذا لم تجد تطابقاً جيداً اختر الأقرب
- أرجع JSON فقط`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  };

  const gemRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  if (!gemRes.ok) {
    const errText = await gemRes.text();
    console.error("Gemini error:", errText);
    return NextResponse.json({ error: "فشل تحليل السيرة بالذكاء الاصطناعي" }, { status: 500 });
  }

  const gemData = await gemRes.json();
  const rawText = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Robust JSON extraction: find first { to last }
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  let parsed: any = {};
  if (jsonMatch) {
    try { parsed = JSON.parse(jsonMatch[0]); } catch { /* fall through to defaults */ }
  }
  // If no valid JSON found, try to extract fields we need from raw text
  if (!parsed.matched_ids && !parsed.job_titles) {
    console.error("Gemini raw response:", rawText);
    // Return empty but valid response so the page still works
    parsed = { matched_ids: [], job_titles: [], summary: "" };
  }

  return NextResponse.json({
    matched_ids: (parsed.matched_ids || []).map(String),
    job_titles: parsed.job_titles || [],
    summary: parsed.summary || "",
    all_fields: allFields || [],
  });
}
