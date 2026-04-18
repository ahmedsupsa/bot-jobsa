import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPayment, getInvoice } from "@/lib/streampay";

export const dynamic = "force-dynamic";

function freshSupabase() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

function getDurationDays(store_products: any): number {
  if (!store_products) return 30;
  if (Array.isArray(store_products)) return store_products[0]?.duration_days ?? 30;
  return store_products.duration_days ?? 30;
}

export async function POST(req: Request) {
  try {
    const { order_id, payment_id, invoice_id, status: redirectStatus } = await req.json();
    if (!order_id) return NextResponse.json({ ok: false, error: "order_id مطلوب" }, { status: 400 });

    const supabase = freshSupabase();

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

    // Get duration days — fetch product separately as backup if join failed
    let durationDays = getDurationDays(order.store_products);
    if (durationDays === 30 && order.product_id) {
      // Join might have failed; fetch directly
      const { data: prod } = await supabase
        .from("store_products")
        .select("duration_days")
        .eq("id", order.product_id)
        .single();
      if (prod?.duration_days) durationDays = prod.duration_days;
    }

    if (order.user_email) {
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

    // Auto-generate activation code matching the product's duration
    let activation_code: string | null = null;
    try {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const digits = "0123456789";
      let newCode = "";
      let attempts = 0;
      while (attempts < 10) {
        const d = Array.from({ length: 7 }, () => digits[Math.floor(Math.random() * 10)]).join("");
        const l = Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * 26)]).join("");
        const candidate = d + l;
        const { data: existing } = await supabase
          .from("activation_codes")
          .select("code")
          .eq("code", candidate)
          .maybeSingle();
        if (!existing) { newCode = candidate; break; }
        attempts++;
      }

      if (newCode) {
        const { error: insertErr } = await supabase.from("activation_codes").insert({
          code: newCode,
          subscription_days: durationDays,
          used: true,
          used_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
        if (!insertErr) activation_code = newCode;
      }
    } catch {}

    return NextResponse.json({ ok: true, activation_code, order: { ...order, status: "paid" } });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ ok: false, error: "خطأ في التحقق من الدفع" }, { status: 500 });
  }
}
