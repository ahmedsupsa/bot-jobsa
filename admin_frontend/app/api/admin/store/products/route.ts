import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";
import { createProduct } from "@/lib/streampay";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const _denied_ = enforcePermission("store"); if (_denied_) return _denied_;
  const supabase = freshClient();
  const { data, error } = await supabase
    .from("store_products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, products: data || [] });
}

export async function POST(req: Request) {
  const _denied_ = enforcePermission("store"); if (_denied_) return _denied_;
  const supabase = freshClient();
  const body = await req.json();
  const { name, description, price, duration_days } = body;
  if (!name?.trim() || !price || !duration_days) {
    return NextResponse.json({ ok: false, error: "الاسم والسعر وعدد الأيام مطلوبة" }, { status: 400 });
  }

  let streampay_product_id: string | null = null;
  let streampay_error: string | null = null;
  try {
    const spProduct = await createProduct({
      name: name.trim(),
      description: description || undefined,
      price: parseFloat(price),
    });
    streampay_product_id = spProduct?.id || spProduct?.data?.id || null;
  } catch (spErr) {
    console.error("StreamPay createProduct error:", spErr);
    streampay_error = String(spErr).slice(0, 200);
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
  return NextResponse.json({ ok: true, product: data, streampay_product_id, streampay_warning: streampay_error });
}

export async function PUT(req: Request) {
  const _denied_ = enforcePermission("store"); if (_denied_) return _denied_;
  const supabase = freshClient();
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
  const _denied_ = enforcePermission("store"); if (_denied_) return _denied_;
  const supabase = freshClient();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "id مطلوب" }, { status: 400 });

  // Try hard delete first
  const { error: delErr } = await supabase.from("store_products").delete().eq("id", id);

  if (!delErr) {
    return NextResponse.json({ ok: true, mode: "hard" });
  }

  // If FK constraint blocks delete, fallback to soft delete (hide from public store)
  const isFkError = /foreign key|violates|referenced/i.test(delErr.message);
  if (isFkError) {
    const { error: softErr } = await supabase
      .from("store_products")
      .update({ is_active: false })
      .eq("id", id);
    if (softErr) {
      return NextResponse.json({ ok: false, error: softErr.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      mode: "soft",
      note: "المنتج مرتبط بطلبات/أكواد سابقة — تم إخفاؤه من واجهة المتجر فقط.",
    });
  }

  return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
}
