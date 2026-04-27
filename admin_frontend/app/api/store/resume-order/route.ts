import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const order_id = searchParams.get("order_id");

    if (!order_id) {
      return NextResponse.json({ ok: false, error: "order_id مطلوب" }, { status: 400 });
    }

    const supabase = freshClient();

    const { data: order } = await supabase
      .from("store_orders")
      .select("id, status, payment_gateway, amount, original_amount, user_name, store_products(name)")
      .eq("id", order_id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ ok: false, error: "الطلب غير موجود" }, { status: 404 });
    }

    if (order.payment_gateway !== "bank_transfer") {
      return NextResponse.json({ ok: false, error: "هذا الطلب ليس حوالة بنكية" }, { status: 400 });
    }

    if (order.status !== "pending") {
      return NextResponse.json({ ok: false, error: "تم معالجة هذا الطلب بالفعل", status: order.status }, { status: 409 });
    }

    const { data: accounts } = await supabase
      .from("bank_accounts")
      .select("id, type, name, account_number, iban, phone, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    const amount = Number(order.amount);
    const originalAmount = Number(order.original_amount ?? order.amount);

    return NextResponse.json({
      ok: true,
      order_id: order.id,
      amount,
      original_amount: originalAmount,
      has_discount: amount < originalAmount,
      product_name: (order.store_products as { name?: string } | null)?.name || "اشتراك",
      accounts: accounts || [],
    });
  } catch (err) {
    console.error("resume-order error:", err);
    return NextResponse.json({ ok: false, error: "حدث خطأ" }, { status: 500 });
  }
}
