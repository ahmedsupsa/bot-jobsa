import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";
import { getTamaraOrder } from "@/lib/tamara";
import { getPayment, getInvoice } from "@/lib/streampay";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("store"); if (denied) return denied;
  const supabase = freshClient();
  const { data: order, error } = await supabase
    .from("store_orders")
    .select("id, payment_gateway, tamara_order_id, streampay_payment_id, streampay_invoice_id, amount, status")
    .eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!order) return NextResponse.json({ ok: false, error: "الطلب غير موجود" }, { status: 404 });

  const out: any = {
    ok: true,
    gateway: order.payment_gateway,
    db_status: order.status,
    db_amount: order.amount,
  };

  try {
    if (order.payment_gateway === "tamara" && order.tamara_order_id) {
      const r = await getTamaraOrder(order.tamara_order_id);
      const total = r?.total_amount?.amount;
      out.gateway_status = r?.status || r?.payment_status || "غير معروف";
      out.gateway_amount = total;
      out.gateway_currency = r?.total_amount?.currency || "SAR";
      out.captured_at = r?.captured_at || r?.created_at || null;
      out.gateway_order_id = order.tamara_order_id;
      out.amount_match = total != null && Math.abs(Number(total) - Number(order.amount || 0)) < 0.01;
    } else if (order.payment_gateway === "streampay" && (order.streampay_payment_id || order.streampay_invoice_id)) {
      let r: any = null;
      if (order.streampay_payment_id) {
        r = await getPayment(order.streampay_payment_id);
      } else if (order.streampay_invoice_id) {
        r = await getInvoice(order.streampay_invoice_id);
      }
      const total = r?.amount ?? r?.data?.amount ?? r?.total_amount;
      out.gateway_status = r?.status || r?.data?.status || "غير معروف";
      out.gateway_amount = total;
      out.gateway_currency = r?.currency || "SAR";
      out.captured_at = r?.created_at || r?.data?.created_at || null;
      out.gateway_payment_id = order.streampay_payment_id;
      out.amount_match = total != null && Math.abs(Number(total) - Number(order.amount || 0)) < 0.01;
    } else if (order.payment_gateway === "bank_transfer") {
      out.gateway_status = "تحويل بنكي يدوي — لا يوجد API للتحقق";
      out.amount_match = null;
    } else {
      out.gateway_status = "بوابة الدفع غير محددة أو غير مدعومة";
      out.amount_match = null;
    }
  } catch (e: any) {
    out.error = String(e?.message || e).slice(0, 400);
  }

  return NextResponse.json(out);
}
