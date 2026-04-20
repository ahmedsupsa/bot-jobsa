import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function freshSupabase() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const { order_id } = await req.json();
    if (!order_id) return NextResponse.json({ ok: false });

    const supabase = freshSupabase();
    const { data: order } = await supabase
      .from("store_orders")
      .select("status, payment_gateway")
      .eq("id", order_id)
      .maybeSingle();

    // Only cancel if pending AND not a bank transfer (those stay pending)
    if (order && order.status === "pending" && order.payment_gateway !== "bank_transfer") {
      await supabase
        .from("store_orders")
        .update({ status: "failed" })
        .eq("id", order_id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
