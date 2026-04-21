import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { previewDiscount } from "@/lib/discount";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const { code, product_id } = await req.json();
    if (!code || !product_id) {
      return NextResponse.json({ ok: false, error: "الكود والمنتج مطلوبان" }, { status: 400 });
    }
    const supabase = freshClient();
    const { data: product } = await supabase
      .from("store_products")
      .select("id, price")
      .eq("id", product_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!product) return NextResponse.json({ ok: false, error: "المنتج غير متاح" }, { status: 404 });

    const result = await previewDiscount(code, product.id, Number(product.price));
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({
      ok: true,
      original_amount: result.original_amount,
      discounted_amount: result.discounted_amount,
      discount_amount: result.discount_amount,
      code: result.code.code,
      discount_type: result.code.discount_type,
      discount_value: result.code.discount_value,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "خطأ في التحقق من الكود" }, { status: 500 });
  }
}
