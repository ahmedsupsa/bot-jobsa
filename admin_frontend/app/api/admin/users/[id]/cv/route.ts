import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!requireAdminSession()) return unauthorizedResponse();

  const uid = params.id;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "لم يتم إرفاق ملف" }, { status: 400 });

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "حجم الملف كبير (الحد 10MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
    return NextResponse.json({ ok: false, error: "نوع غير مدعوم (PDF أو صورة)" }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: uploadErr.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: existing } = await supabase.from("user_cvs").select("id").eq("user_id", uid).limit(1);

  if (existing?.[0]) {
    await supabase.from("user_cvs").update({ file_name: file.name, file_id: "admin_upload", storage_path: storagePath, updated_at: now }).eq("user_id", uid);
  } else {
    await supabase.from("user_cvs").insert({ user_id: uid, file_name: file.name, file_id: "admin_upload", storage_path: storagePath, created_at: now, updated_at: now });
  }

  return NextResponse.json({ ok: true, file_name: file.name });
}
