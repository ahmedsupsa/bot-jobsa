import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { getAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "تعذّر قراءة الملف" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "لم يُرفق ملف" }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ ok: false, error: "حجم الملف يتجاوز 15MB" }, { status: 400 });

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `chat/${session.username}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await supabase.storage
    .createBucket("admin-chat-files", { public: false })
    .catch(() => {});

  const { data, error } = await supabase.storage
    .from("admin-chat-files")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    file_path: data.path,
    file_name: file.name,
    file_size: file.size,
    file_type: file.type,
  });
}
