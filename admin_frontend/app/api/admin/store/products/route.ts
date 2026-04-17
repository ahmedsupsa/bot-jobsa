import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

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
  const { name, description, price, duration_days, streampay_product_id } = body;
  if (!name?.trim() || !price || !duration_days) {
    return NextResponse.json({ ok: false, error: "الاسم والسعر وعدد الأيام مطلوبة" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("store_products")
    .insert({ name: name.trim(), description, price: parseFloat(price), duration_days: parseInt(duration_days), streampay_product_id: streampay_product_id || null })
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, product: data });
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
