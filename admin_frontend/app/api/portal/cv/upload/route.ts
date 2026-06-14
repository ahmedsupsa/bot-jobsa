import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";
import { tg } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function extractTextFromPdf(buffer: Buffer): Promise<string | null> {
  try {
    // require داخل الدالة — يتجنب مشكلة Vercel bundling
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    const text = (data.text || "").trim();
    return text.length > 50 ? text : null;
  } catch (e) {
    console.error("[cv-upload] pdf-parse error:", e);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
    const uid = payload.user_id;
    const supabase = freshClient();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "لم يتم إرفاق ملف" }, { status: 400 });

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "حجم الملف كبير جداً (الحد الأقصى 10 ميغابايت)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (ext !== "pdf") {
      return NextResponse.json({ error: "يُقبل فقط ملفات PDF — السيرة الذاتية يجب أن تكون بصيغة PDF" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${uid}/cv.${ext}`;

    // رفع الملف إلى Storage
    const { error: uploadErr } = await supabase.storage
      .from("cvs")
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: file.type || "application/octet-stream",
      });

    if (uploadErr) {
      console.error("[cv-upload] Storage error:", JSON.stringify(uploadErr));
      return NextResponse.json({ error: `فشل رفع الملف: ${uploadErr.message}` }, { status: 500 });
    }

    // حذف الملف المخزَّن إذا فشل التحقق
    async function rejectCv(code: string, msg: string) {
      try { await supabase.storage.from("cvs").remove([storagePath]); } catch {}
      try { await supabase.from("user_settings").update({ cv_rejected: true }).eq("user_id", uid); } catch {}
      return NextResponse.json({ error: msg, code }, { status: 422 });
    }

    // استخراج النص من PDF
    let cv_parsed_text: string | null = null;
    if (ext === "pdf") {
      cv_parsed_text = await extractTextFromPdf(buffer);
      console.log(cv_parsed_text
        ? `[cv-upload] ✅ استُخرج النص: ${cv_parsed_text.length} حرف`
        : "[cv-upload] ⚠️ pdf-parse لم يستخرج نصاً"
      );

      if (cv_parsed_text) {
        const txt = cv_parsed_text.trim();
        const cvKeywords = /(سيرة|خبرة|مؤهل|مهارات|جامعة|تخرج|بكالوريوس|ماجستير|دبلوم|خبرة|درجة|شهادة|عمل|تدريب|Curriculum|Vitae|CV|Resume|experience|education|skills|degree)/i;
        const hasCvKeywords = cvKeywords.test(txt);
        const hasPersonalInfo = /([\u0600-\u06FF]{4,}\s[\u0600-\u06FF]{4,})|(\+?[\d\s\-]{7,})/.test(txt) || /@/.test(txt);
        const lineCount = txt.split("\n").filter(l => l.trim().length > 3).length;

        if (txt.length < 100) return rejectCv("too_short", "الملف لا يحتوي على نص كافٍ — تأكد أن الملف سيرة ذاتية بصيغة PDF نصية (غير مصورة)");
        if (lineCount < 5) return rejectCv("too_few_lines", "الملف يبدو فارغاً أو غير قابل للقراءة — تأكد أن السيرة الذاتية PDF نصية وليست صورة ممسوحة ضوئياً");
        if (!hasCvKeywords && !hasPersonalInfo) return rejectCv("not_a_cv", "هذا الملف لا يبدو سيرة ذاتية — يرجى رفع سيرتك الذاتية الحقيقية (CV) بصيغة PDF");
        // كشف السير اللي محتواها "لا يوجد" أو غير مفيد
        const emptyPattern = /لا يوجد/g;
        const emptyCount = (txt.match(emptyPattern) || []).length;
        if (emptyCount > 3) return rejectCv("empty_cv", "السيرة الذاتية لا تحتوي على بيانات حقيقية — يرجى رفع سيرة ذاتية مكتملة");
      }
    }

    // تحقق إذا كان المستخدم لديه سيرة مسبقاً
    const { data: existing, error: selectErr } = await supabase
      .from("user_cvs")
      .select("id, storage_path")
      .eq("user_id", uid)
      .limit(1);

    if (selectErr) {
      console.error("[cv-upload] select error:", JSON.stringify(selectErr));
      return NextResponse.json({ error: `خطأ في قراءة البيانات: ${selectErr.message}` }, { status: 500 });
    }

    const now = new Date().toISOString();

    if (existing?.[0]) {
      // سيرة موجودة — حذف القديمة وتحديث
      const oldPath = existing[0].storage_path;
      if (oldPath) await supabase.storage.from("cvs").remove([oldPath]).catch(() => {});
    }

    const upsertPayload = {
      user_id: uid,
      file_name: file.name,
      file_id: "web_upload",
      storage_path: storagePath,
      cv_parsed_text: cv_parsed_text || null,
      cv_parsed_at: cv_parsed_text ? now : null,
      created_at: now,
      cv_profile: null,
    };

    if (existing?.[0]) {
      const { error: updErr } = await supabase.from("user_cvs").update(upsertPayload).eq("user_id", uid);
      if (updErr) return NextResponse.json({ error: `فشل تحديث السيرة: ${updErr.message}` }, { status: 500 });
    } else {
      const { error: insErr } = await supabase.from("user_cvs").insert(upsertPayload);
      if (insErr) return NextResponse.json({ error: `فشل حفظ السيرة: ${insErr.message}` }, { status: 500 });
    }

    // سيرة صالحة — إلغاء رفض السيرة إن كان موجوداً
    try { await supabase.from("user_settings").update({ cv_rejected: false }).eq("user_id", uid); } catch {};

    tg.cvUploaded(uid, uid, file.name).catch(() => {});

    return NextResponse.json({
      status: "ok",
      file_name: file.name,
      text_extracted: !!cv_parsed_text,
      text_length: cv_parsed_text?.length ?? 0,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cv-upload] unexpected error:", msg);
    return NextResponse.json({ error: `خطأ في السيرفر: ${msg}` }, { status: 500 });
  }
}
