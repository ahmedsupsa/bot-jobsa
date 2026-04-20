import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_PREFIXES = ["image/", "application/pdf"];
const ALLOWED_EXACT = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUserId(req: Request): Promise<string | null> {
  const token = extractToken(req);
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.user_id || null;
}

export async function POST(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "ملف غير صالح" }, { status: 400 });
  }
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "لا يوجد ملف" }, { status: 400 });

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "الحجم الأقصى 10 ميجا" }, { status: 400 });
  }
  const type = file.type || "application/octet-stream";
  const allowed = ALLOWED_PREFIXES.some((p) => type.startsWith(p)) || ALLOWED_EXACT.has(type);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "نوع الملف غير مدعوم" }, { status: 400 });
  }

  const supabase = freshClient();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
  const key = `${uid}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from("support").upload(key, buf, {
    contentType: type, upsert: false,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const { data: pub } = supabase.storage.from("support").getPublicUrl(key);

  return NextResponse.json({
    ok: true,
    attachment: {
      url: pub.publicUrl,
      name: file.name,
      type,
      size: file.size,
    },
  });
}
