import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET — sales list for a specific marketer
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const _denied_ = enforcePermission("affiliate"); if (_denied_) return _denied_;
  const supabase = freshClient();
  const { id } = params;

  const { data: sales, error } = await supabase
    .from("affiliate_sales")
    .select("*")
    .eq("affiliate_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sales: sales || [] });
}

// POST — add manual sale or mark all pending as paid
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const _denied_ = enforcePermission("affiliate"); if (_denied_) return _denied_;
  const supabase = freshClient();
  const { id } = params;
  const body = await req.json();

  if (body.action === "mark_paid") {
    const { error } = await supabase
      .from("affiliate_sales")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("affiliate_id", id)
      .eq("status", "pending");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "add_sale") {
    const { customer_name, customer_email, order_amount, commission_earned, notes } = body;
    if (!order_amount) return NextResponse.json({ ok: false, error: "مبلغ الطلب مطلوب" }, { status: 400 });

    const { error } = await supabase
      .from("affiliate_sales")
      .insert({
        affiliate_id: id,
        customer_name: customer_name || null,
        customer_email: customer_email || null,
        order_amount: Number(order_amount),
        commission_earned: Number(commission_earned || 0),
        notes: notes || null,
      });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "action غير معروف" }, { status: 400 });
}
