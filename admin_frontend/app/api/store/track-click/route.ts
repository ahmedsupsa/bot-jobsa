import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code: string = (body.code || "").trim().toUpperCase();
    const session_id: string = (body.session_id || "").trim();

    if (!code) return NextResponse.json({ ok: false, error: "code مطلوب" }, { status: 400 });

    const supabase = freshClient();

    // تجنّب العدّ المضاعف للجلسة الواحدة خلال 24 ساعة
    if (session_id) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("affiliate_clicks")
        .select("id")
        .eq("affiliate_code", code)
        .eq("session_id", session_id)
        .gte("created_at", cutoff)
        .maybeSingle();

      if (existing) return NextResponse.json({ ok: true, duplicate: true });
    }

    await supabase.from("affiliate_clicks").insert({
      affiliate_code: code,
      session_id: session_id || null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("track-click error:", e);
    return NextResponse.json({ ok: true }); // لا نُفشل الصفحة بسبب خطأ الإحصاء
  }
}
