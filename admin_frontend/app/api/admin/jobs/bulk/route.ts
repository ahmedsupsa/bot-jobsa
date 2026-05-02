import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";
import ExcelJS from "exceljs";

export const runtime = "nodejs";
export const maxDuration = 300;

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

async function generateSpecializations(titleAr: string, descAr: string): Promise<string> {
  if (!GEMINI_KEY || !titleAr) return titleAr || "";
  try {
    const prompt = `استخرج قائمة من 5-10 تخصصات ومسميات وظيفية مناسبة لهذه الوظيفة:
العنوان: ${titleAr}
الوصف: ${(descAr || "").slice(0, 500)}
أرجع فقط الكلمات مفصولة بفاصلة، بدون شرح. مثال: تصميم جرافيك، تصميم بصري، فوتوشوب`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text.trim() || titleAr;
  } catch {
    return titleAr;
  }
}

const HEADER_MAP: Record<string, string> = {
  "عنوان الوظيفة": "title_ar",
  "العنوان": "title_ar",
  "title_ar": "title_ar",
  "title": "title_ar",
  "الوصف": "description_ar",
  "وصف الوظيفة": "description_ar",
  "description_ar": "description_ar",
  "description": "description_ar",
  "البريد": "application_email",
  "البريد للتقديم": "application_email",
  "البريد الإلكتروني": "application_email",
  "الإيميل": "application_email",
  "email": "application_email",
  "application_email": "application_email",
  "اسم الشركة": "company",
  "الشركة": "company",
  "company": "company",
  "التخصصات": "specializations",
  "specializations": "specializations",
};

function normalize(s: any): string {
  return String(s ?? "").trim().toLowerCase();
}

export async function POST(req: Request) {
  const _denied_ = enforcePermission("jobs"); if (_denied_) return _denied_;

  let file: File | null = null;
  try {
    const fd = await req.formData();
    file = fd.get("file") as File | null;
  } catch {
    return NextResponse.json({ ok: false, error: "ملف غير صالح" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ ok: false, error: "الرجاء إرفاق ملف Excel" }, { status: 400 });

  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as any);
  } catch {
    return NextResponse.json({ ok: false, error: "تعذّر قراءة ملف Excel" }, { status: 400 });
  }

  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) {
    return NextResponse.json({ ok: false, error: "الملف فارغ — يجب أن يحتوي على رؤوس + صفوف بيانات" }, { status: 400 });
  }

  // Map headers
  const headerRow = ws.getRow(1);
  const colMap: Record<number, string> = {};
  headerRow.eachCell((cell, col) => {
    const key = HEADER_MAP[normalize(cell.value)];
    if (key) colMap[col] = key;
  });

  const required = ["title_ar", "application_email"];
  const present = Object.values(colMap);
  for (const r of required) {
    if (!present.includes(r)) {
      return NextResponse.json({
        ok: false,
        error: `الملف يفتقد عمود "${r === "title_ar" ? "عنوان الوظيفة" : "البريد للتقديم"}"`,
      }, { status: 400 });
    }
  }

  // Parse rows
  type Row = { title_ar: string; description_ar: string; application_email: string; company: string; specializations: string; };
  const rows: Row[] = [];
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const obj: any = { title_ar: "", description_ar: "", application_email: "", company: "", specializations: "" };
    for (const [colStr, key] of Object.entries(colMap)) {
      const cell = row.getCell(Number(colStr));
      const v = cell.value;
      let str = "";
      if (v == null) str = "";
      else if (typeof v === "object" && "text" in (v as any)) str = String((v as any).text || "");
      else if (typeof v === "object" && "richText" in (v as any)) str = ((v as any).richText || []).map((x: any) => x.text).join("");
      else str = String(v);
      obj[key] = str.trim();
    }
    if (!obj.title_ar && !obj.application_email) continue; // skip empty
    rows.push(obj);
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "لم يتم العثور على صفوف بيانات" }, { status: 400 });
  }

  if (rows.length > 200) {
    return NextResponse.json({ ok: false, error: `الحد الأقصى 200 وظيفة لكل ملف (الملف يحتوي ${rows.length})` }, { status: 400 });
  }

  // Validate
  const errors: string[] = [];
  rows.forEach((r, idx) => {
    const line = idx + 2;
    if (!r.title_ar) errors.push(`السطر ${line}: عنوان الوظيفة مطلوب`);
    if (!r.application_email) errors.push(`السطر ${line}: البريد للتقديم مطلوب`);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.application_email)) errors.push(`السطر ${line}: البريد غير صالح "${r.application_email}"`);
  });
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.slice(0, 8).join(" • ") + (errors.length > 8 ? ` (+${errors.length - 8} أخطاء)` : "") }, { status: 400 });
  }

  // Generate specs in parallel batches
  const CONCURRENCY = 5;
  const enriched: Row[] = [];
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const out = await Promise.all(chunk.map(async (r) => {
      const spec = r.specializations ? r.specializations : await generateSpecializations(r.title_ar, r.description_ar);
      return { ...r, specializations: spec };
    }));
    enriched.push(...out);
  }

  const now = new Date().toISOString();
  const payload = enriched.map(r => ({
    title_ar: r.title_ar,
    description_ar: r.description_ar,
    company: r.company,
    application_email: r.application_email,
    specializations: r.specializations,
    is_active: true,
    created_at: now,
  }));

  const { error, data } = await supabase.from("admin_jobs").insert(payload).select("id");
  if (error) {
    console.error("bulk INSERT error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: data?.length || 0, total: rows.length });
}
