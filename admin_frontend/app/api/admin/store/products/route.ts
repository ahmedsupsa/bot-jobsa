import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";
import { createProduct } from "@/lib/streampay";

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { data, error } = await supabase
    .from("store_products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, products: data || [] });
}

export async function POST(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const body = await req.json();
  const { name, description, price, duration_days } = body;
  if (!name?.trim() || !price || !duration_days) {
    return NextResponse.json({ ok: false, error: "الاسم والسعر وعدد الأيام مطلوبة" }, { status: 400 });
  }

  // Auto-create the product in StreamPay
  let streampay_product_id: string | null = null;
  try {
    const spProduct = await createProduct({
      name: name.trim(),
      description: description || undefined,
      price: parseFloat(price),
    });
    streampay_product_id = spProduct?.id || spProduct?.data?.id || null;
  } catch (spErr) {
    console.error("StreamPay createProduct error:", spErr);
    return NextResponse.json(
      { ok: false, error: "فشل إنشاء المنتج في بوابة الدفع: " + String(spErr).slice(0, 200) },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("store_products")
    .insert({
      name: name.trim(),
      description: description || null,
      price: parseFloat(price),
      duration_days: parseInt(duration_days),
      streampay_product_id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, product: data, streampay_product_id });
}

export async function PUT(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const body = await req.json();
  const { id, name, description, price, duration_days, streampay_product_id, is_active } = body;
  if (!id) return NextResponse.json({ ok: false, error: "id مطلوب" }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = parseFloat(price);
  if (duration_days !== undefined) updates.duration_days = parseInt(duration_days);
  if (streampay_product_id !== undefined) updates.streampay_product_id = streampay_product_id;
  if (is_active !== undefined) updates.is_active = is_active;
  const { error } = await supabase.from("store_products").update(updates).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "id مطلوب" }, { status: 400 });
  const { error } = await supabase.from("store_products").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
