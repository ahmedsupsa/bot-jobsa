import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";
import { tg } from "@/lib/telegram";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export const runtime = "nodejs";
export const maxDuration = 60;

async function extractTextFromPdf(buffer: Buffer): Promise<string | null> {
  try {
    const data = await pdfParse(buffer);
    const text = (data.text || "").trim();
    return text.length > 50 ? text : null;
  } catch (e) {
    console.error("pdf-parse error:", e);
    return null;
  }
}

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "لم يتم إرفاق ملف" }, { status: 400 });

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "حجم الملف كبير جداً (الحد الأقصى 10 ميغابايت)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
    return NextResponse.json({ error: "نوع الملف غير مدعوم (PDF أو صورة فقط)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `${uid}/cv.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("cvs")
    .upload(storagePath, buffer, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadErr) {
    console.error("Storage upload error:", JSON.stringify(uploadErr));
    return NextResponse.json({ error: `فشل رفع الملف: ${uploadErr.message}` }, { status: 500 });
  }

  // استخراج النص من PDF بالمكتبة (بدون AI)
  let cv_parsed_text: string | null = null;
  if (ext === "pdf") {
    cv_parsed_text = await extractTextFromPdf(buffer);
    if (cv_parsed_text) {
      console.log(`[cv-upload] ✅ استُخرج النص بـ pdf-parse: ${cv_parsed_text.length} حرف`);
    } else {
      console.log("[cv-upload] ⚠️ pdf-parse لم يستخرج نصاً — سيتم الاستخراج بـ Gemini لاحقاً");
    }
  }

  const { data: existing, error: selectErr } = await supabase
    .from("user_cvs")
    .select("id")
    .eq("user_id", uid)
    .limit(1);

  if (selectErr) {
    console.error("user_cvs select error:", JSON.stringify(selectErr));
    return NextResponse.json({ error: `خطأ في قراءة البيانات: ${selectErr.message}` }, { status: 500 });
  }

  const now = new Date().toISOString();
  if (existing?.[0]) {
    return NextResponse.json({
      error: "لا يمكن تغيير السيرة الذاتية بعد رفعها. تواصل مع الدعم لتغييرها.",
      locked: true,
    }, { status: 403 });
  } else {
    const { error: insertErr } = await supabase.from("user_cvs").insert({
      user_id: uid,
      file_name: file.name,
      file_id: "web_upload",
      storage_path: storagePath,
      created_at: now,
      ...(cv_parsed_text ? { cv_parsed_text, cv_parsed_at: now } : {}),
    });
    if (insertErr) {
      console.error("user_cvs insert error:", JSON.stringify(insertErr));
      return NextResponse.json({ error: `فشل حفظ البيانات: ${insertErr.message}` }, { status: 500 });
    }
  }

  tg.cvUploaded(uid, uid, file.name).catch(() => {});
  return NextResponse.json({
    status: "ok",
    file_name: file.name,
    text_extracted: !!cv_parsed_text,
    text_length: cv_parsed_text?.length ?? 0,
  });
}
