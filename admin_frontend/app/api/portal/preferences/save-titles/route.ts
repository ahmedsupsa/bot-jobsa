import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;
  const supabase = freshClient();

  const body = await req.json().catch(() => ({}));
  const titles: string[] = (body.titles || [])
    .map((t: unknown) => String(t).trim())
    .filter((t: string) => t.length >= 2);

  if (titles.length === 0) {
    return NextResponse.json({ error: "لا توجد مسميات للحفظ" }, { status: 400 });
  }

  // upsert كل مسمى في job_fields ثم احفظ الـ IDs
  const fieldIds: string[] = [];
  for (const title of titles) {
    const { data: existing } = await supabase
      .from("job_fields")
      .select("id")
      .eq("name_ar", title)
      .limit(1);

    if (existing?.[0]) {
      fieldIds.push(String(existing[0].id));
    } else {
      const { data: inserted } = await supabase
        .from("job_fields")
        .insert({ name_ar: title, category: "specific" })
        .select("id")
        .single();
      if (inserted?.id) fieldIds.push(String(inserted.id));
    }
  }

  // احذف التفضيلات القديمة وأضف الجديدة
  await supabase.from("user_job_preferences").delete().eq("user_id", uid);

  if (fieldIds.length > 0) {
    await supabase
      .from("user_job_preferences")
      .insert(fieldIds.map((fid) => ({ user_id: uid, job_field_id: fid })));
  }

  return NextResponse.json({ status: "ok", count: fieldIds.length, titles });
}

function isArabicTitle(s: string): boolean {
  const arabicChars = (s.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicChars >= 2 && !s.includes("{") && !s.includes("[") && !s.includes(":");
}

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;
  const supabase = freshClient();

  const { data } = await supabase
    .from("user_job_preferences")
    .select("job_fields(name_ar)")
    .eq("user_id", uid);

  const titles = (data || [])
    .map((r: any) => r.job_fields?.name_ar)
    .filter((t: any): t is string => typeof t === "string" && isArabicTitle(t));

  return NextResponse.json({ titles });
}
