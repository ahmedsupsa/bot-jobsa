import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const denied = enforcePermission("store"); if (denied) return denied;
  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "الملف مطلوب" }, { status: 400 });

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ ok: false, error: "نوع الملف غير مدعوم" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "حجم الملف كبير جداً (الحد 5 ميغابايت)" }, { status: 400 });
    }

    const supabase = freshClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `banners/store-banner-${Date.now()}.${ext}`;
    const buf = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("receipts")
      .upload(path, buf, { contentType: file.type, upsert: true });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    const { data } = supabase.storage.from("receipts").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data?.publicUrl || null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
