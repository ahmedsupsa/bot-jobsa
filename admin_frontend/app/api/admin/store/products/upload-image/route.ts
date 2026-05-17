import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const denied = enforcePermission("store");
  if (denied) return denied;

  const supabase = freshClient();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "تعذّر قراءة البيانات" }, { status: 400 });
  }

  const productId = formData.get("product_id") as string | null;
  const file = formData.get("file") as File | null;

  if (!productId) return NextResponse.json({ ok: false, error: "product_id مطلوب" }, { status: 400 });
  if (!file)      return NextResponse.json({ ok: false, error: "الملف مطلوب" }, { status: 400 });

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "نوع الملف غير مدعوم — استخدم JPG أو PNG أو WebP" }, { status: 400 });
  }

  const ext = file.type === "image/jpeg" ? "jpg"
            : file.type === "image/png"  ? "png"
            : file.type === "image/webp" ? "webp"
            : "gif";
  const path = `${productId}.${ext}`;

  const buffer = await file.arrayBuffer();

  // Remove old image if exists (any extension)
  await supabase.storage.from("product-images").remove([
    `${productId}.jpg`, `${productId}.png`, `${productId}.webp`, `${productId}.gif`,
  ]);

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
  const image_url = urlData.publicUrl + `?t=${Date.now()}`;

  const { error: dbError } = await supabase
    .from("store_products")
    .update({ image_url })
    .eq("id", productId);

  if (dbError) {
    return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, image_url });
}

export async function DELETE(req: Request) {
  const denied = enforcePermission("store");
  if (denied) return denied;

  const supabase = freshClient();
  let body: { product_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "بيانات غير صالحة" }, { status: 400 }); }

  const { product_id } = body;
  if (!product_id) return NextResponse.json({ ok: false, error: "product_id مطلوب" }, { status: 400 });

  await supabase.storage.from("product-images").remove([
    `${product_id}.jpg`, `${product_id}.png`, `${product_id}.webp`, `${product_id}.gif`,
  ]);

  await supabase.from("store_products").update({ image_url: null }).eq("id", product_id);

  return NextResponse.json({ ok: true });
}
