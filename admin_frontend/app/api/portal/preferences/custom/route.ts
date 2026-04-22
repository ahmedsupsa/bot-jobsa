import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Normalize Arabic input for duplicate checks: trim, collapse spaces,
// strip tashkeel, unify alef variants and yaa/taa marbuta.
function normalizeAr(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\u064B-\u0652\u0670]/g, "")  // tashkeel
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim().replace(/\s+/g, " ");

  if (name.length < 2) {
    return NextResponse.json({ error: "أدخل اسم المسمى الوظيفي (حرفين على الأقل)" }, { status: 400 });
  }
  if (name.length > 60) {
    return NextResponse.json({ error: "الاسم طويل جداً (الحد 60 حرفاً)" }, { status: 400 });
  }

  // Find existing field by normalized name_ar (case/diacritic insensitive)
  const target = normalizeAr(name);
  const { data: existingAll, error: listErr } = await supabase
    .from("job_fields")
    .select("id, name_ar")
    .limit(2000);
  if (listErr) {
    console.error("custom prefs list error:", JSON.stringify(listErr));
    return NextResponse.json({ error: "تعذر التحقق من المسميات الحالية" }, { status: 500 });
  }

  let field = (existingAll || []).find((f: any) => normalizeAr(f.name_ar) === target) as
    | { id: string; name_ar: string }
    | undefined;

  if (!field) {
    const { data: created, error: insErr } = await supabase
      .from("job_fields")
      .insert({ name_ar: name, name_en: name, category: "specific" })
      .select("id, name_ar")
      .single();
    if (insErr || !created) {
      console.error("custom prefs insert error:", JSON.stringify(insErr));
      return NextResponse.json({ error: "تعذر إضافة المسمى الجديد" }, { status: 500 });
    }
    field = created as any;
  }

  // Link to the user (idempotent — UNIQUE(user_id, job_field_id) prevents dupes)
  const { error: linkErr } = await supabase
    .from("user_job_preferences")
    .upsert(
      { user_id: uid, job_field_id: field!.id },
      { onConflict: "user_id,job_field_id", ignoreDuplicates: true }
    );
  if (linkErr) {
    console.error("custom prefs link error:", JSON.stringify(linkErr));
    return NextResponse.json({ error: "تعذر حفظ التفضيل" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    field: { id: String(field!.id), name_ar: field!.name_ar },
  });
}
