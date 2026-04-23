import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";
import { refundTamaraOrder } from "@/lib/tamara";
import { refundStreamPayPayment } from "@/lib/streampay";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("store"); if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const action: "approve" | "reject" | "request" = body.action || "approve";
  const adminNotes = body.notes ? String(body.notes).trim() : null;
  const tryGateway = body.try_gateway !== false;

  const supabase = freshClient();
  const { data: order, error: oErr } = await supabase
    .from("store_orders")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (oErr) return NextResponse.json({ ok: false, error: oErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ ok: false, error: "الطلب غير موجود" }, { status: 404 });

  // Admin can also create a refund directly (admin-initiated)
  if (action === "request") {
    const reason = (body.reason || "تم الإنشاء بواسطة المسؤول").trim();
    const { error } = await supabase.from("store_orders").update({
      refund_status: "requested",
      refund_reason: reason,
      refund_requested_at: new Date().toISOString(),
      refund_admin_notes: adminNotes,
      refund_processed_at: null,
      refund_method: null,
    }).eq("id", params.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    const { error } = await supabase.from("store_orders").update({
      refund_status: "rejected",
      refund_admin_notes: adminNotes,
      refund_processed_at: new Date().toISOString(),
      refund_method: "rejected",
    }).eq("id", params.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // approve → try gateway refund first, otherwise mark as manual
  let gatewayResult: any = null;
  let gatewayErr: string | null = null;
  let method: "gateway_auto" | "manual" = "manual";

  if (tryGateway) {
    try {
      if (order.payment_gateway === "tamara" && order.tamara_order_id) {
        gatewayResult = await refundTamaraOrder(order.tamara_order_id, Number(order.amount || 0));
        method = "gateway_auto";
      } else if (order.payment_gateway === "streampay" && order.streampay_payment_id) {
        gatewayResult = await refundStreamPayPayment(order.streampay_payment_id, Number(order.amount || 0));
        method = "gateway_auto";
      }
    } catch (e: any) {
      gatewayErr = String(e?.message || e).slice(0, 400);
      method = "manual";
    }
  }

  const { error: updErr } = await supabase.from("store_orders").update({
    refund_status: "refunded",
    refund_admin_notes: adminNotes,
    refund_processed_at: new Date().toISOString(),
    refund_method: method,
    status: "refunded",
  }).eq("id", params.id);
  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    method,
    gateway_error: gatewayErr,
    gateway_result: gatewayResult ? "تم تأكيد الاسترجاع من البوابة" : null,
  });
}
