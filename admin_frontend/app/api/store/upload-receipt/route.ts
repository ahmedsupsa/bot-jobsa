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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const order_id = formData.get("order_id") as string | null;

    if (!file || !order_id) {
      return NextResponse.json({ ok: false, error: "الملف ورقم الطلب مطلوبان" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ ok: false, error: "نوع الملف غير مدعوم. الرجاء رفع صورة (JPG, PNG, PDF)" }, { status: 400 });
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "حجم الملف كبير جداً (الحد الأقصى 10 ميغابايت)" }, { status: 400 });
    }

    const supabase = freshClient();

    // Verify order exists and is pending bank_transfer
    const { data: order } = await supabase
      .from("store_orders")
      .select("id, status, payment_gateway")
      .eq("id", order_id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ ok: false, error: "الطلب غير موجود" }, { status: 404 });
    }

    // Build file path
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `receipts/${order_id}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ ok: false, error: "فشل رفع الملف: " + uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("receipts")
      .getPublicUrl(filePath);

    const receiptUrl = urlData?.publicUrl || null;

    // Update order with receipt URL
    await supabase
      .from("store_orders")
      .update({ receipt_url: receiptUrl })
      .eq("id", order_id);

    return NextResponse.json({ ok: true, receipt_url: receiptUrl });
  } catch (err) {
    console.error("upload-receipt error:", err);
    return NextResponse.json({ ok: false, error: "حدث خطأ أثناء رفع الإيصال" }, { status: 500 });
  }
}
