import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";

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

  const buffer = await file.arrayBuffer();
  const storagePath = `${uid}/cv.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("cvs")
    .upload(storagePath, Buffer.from(buffer), {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadErr) {
    console.error("Storage upload error:", uploadErr);
  }

  const { data: existing } = await supabase
    .from("user_cvs")
    .select("id")
    .eq("user_id", uid)
    .limit(1);

  const now = new Date().toISOString();
  if (existing?.[0]) {
    await supabase.from("user_cvs").update({
      file_name: file.name,
      file_id: "web_upload",
      storage_path: uploadErr ? null : storagePath,
      updated_at: now,
    }).eq("user_id", uid);
  } else {
    await supabase.from("user_cvs").insert({
      user_id: uid,
      file_name: file.name,
      file_id: "web_upload",
      storage_path: uploadErr ? null : storagePath,
      created_at: now,
      updated_at: now,
    });
  }

  return NextResponse.json({ status: "ok", file_name: file.name });
}
