import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

async function generateSpecializations(titleAr: string, descAr: string): Promise<string> {
  if (!GEMINI_KEY) return titleAr;
  try {
    const prompt = `استخرج قائمة من 5-10 تخصصات ومسميات وظيفية مناسبة لهذه الوظيفة:
العنوان: ${titleAr}
الوصف: ${descAr.slice(0, 500)}
أرجع فقط الكلمات مفصولة بفاصلة، بدون شرح. مثال: تصميم جرافيك، تصميم بصري، فوتوشوب`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${GEMINI_KEY}`,
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

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { data: jobs, error } = await supabase
    .from("admin_jobs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) console.error("jobs GET error:", error.message);
  return NextResponse.json({ ok: true, jobs: jobs || [] });
}

export async function POST(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const body = await req.json().catch(() => ({}));

  const titleAr = (body.title_ar || "").trim();
  const descAr = (body.description_ar || "").trim();
  const email = (body.application_email || "").trim();

  if (!titleAr || !email) {
    return NextResponse.json({ ok: false, error: "عنوان الوظيفة والبريد مطلوبان" }, { status: 400 });
  }

  const specializations = await generateSpecializations(titleAr, descAr);

  const { error, data } = await supabase.from("admin_jobs").insert({
    title_ar: titleAr,
    title_en: (body.title_en || "").trim(),
    company: (body.company || "").trim(),
    description_ar: descAr,
    application_email: email,
    specializations,
    is_active: true,
    created_at: new Date().toISOString(),
  }).select("id").single();

  if (error) {
    console.error("jobs INSERT error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data?.id, specializations });
}

export async function DELETE(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await supabase.from("admin_jobs").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
