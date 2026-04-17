import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("store_orders")
    .select("*, store_products(name, price, duration_days)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, orders: data || [] });
}

export async function POST(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const body = await req.json();
  const { user_id, product_id, user_name, user_email, amount, notes } = body;
  if (!product_id) return NextResponse.json({ ok: false, error: "product_id مطلوب" }, { status: 400 });
  const { data, error } = await supabase
    .from("store_orders")
    .insert({ user_id, product_id, user_name, user_email, amount: amount ? parseFloat(amount) : null, notes, status: "pending" })
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, order: data });
}
