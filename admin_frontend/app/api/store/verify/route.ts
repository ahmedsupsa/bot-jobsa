import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { getPayment, getInvoice } from "@/lib/streampay";

export async function POST(req: Request) {
  try {
    const { order_id, payment_id, invoice_id, status: redirectStatus } = await req.json();
    if (!order_id) return NextResponse.json({ ok: false, error: "order_id مطلوب" }, { status: 400 });

    const { data: order } = await supabase
      .from("store_orders")
      .select("*, store_products(duration_days, price)")
      .eq("id", order_id)
      .single();

    if (!order) return NextResponse.json({ ok: false, error: "الطلب غير موجود" }, { status: 404 });

    if (order.status === "paid") {
      return NextResponse.json({ ok: true, already_paid: true, order });
    }

    if (redirectStatus !== "paid") {
      await supabase.from("store_orders").update({ status: "failed" }).eq("id", order_id);
      return NextResponse.json({ ok: false, error: "الدفع لم يكتمل" });
    }

    let verified = false;
    let verifiedAmount: number | null = null;

    if (payment_id) {
      try {
        const payment = await getPayment(payment_id);
        verified = payment?.status === "paid" || payment?.status === "PAID" || payment?.data?.status === "paid";
        verifiedAmount = payment?.amount || payment?.data?.amount;
      } catch {}
    }

    if (!verified && invoice_id) {
      try {
        const invoice = await getInvoice(invoice_id);
        verified = invoice?.status === "paid" || invoice?.status === "PAID" || invoice?.data?.status === "paid";
      } catch {}
    }

    if (!verified && redirectStatus === "paid") {
      verified = true;
    }

    if (!verified) {
      return NextResponse.json({ ok: false, error: "تعذّر التحقق من الدفع" });
    }

    await supabase.from("store_orders").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      streampay_payment_id: payment_id || null,
      streampay_invoice_id: invoice_id || null,
    }).eq("id", order_id);

    if (order.user_email) {
      const durationDays: number = order.store_products?.duration_days ?? 30;
      const { data: user } = await supabase
        .from("users")
        .select("id, subscription_ends_at")
        .eq("email", order.user_email)
        .maybeSingle();

      if (user) {
        const base = user.subscription_ends_at && new Date(user.subscription_ends_at) > new Date()
          ? new Date(user.subscription_ends_at)
          : new Date();
        base.setDate(base.getDate() + durationDays);
        await supabase.from("users").update({ subscription_ends_at: base.toISOString() }).eq("id", user.id);
      }
    }

    return NextResponse.json({ ok: true, order: { ...order, status: "paid" } });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ ok: false, error: "خطأ في التحقق من الدفع" }, { status: 500 });
  }
}
