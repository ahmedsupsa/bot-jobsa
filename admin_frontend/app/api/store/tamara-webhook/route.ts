import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureOrder, verifyWebhookSignature } from "@/lib/tamara";
import { makeToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function freshSupabase() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("Tamara-Signature") || "";

    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event?.event_type || event?.type || "";
    const tamaraOrderId: string = event?.order_id || event?.data?.order_id || "";

    console.log(`Tamara webhook: ${eventType} — order: ${tamaraOrderId}`);

    if (!tamaraOrderId) {
      return NextResponse.json({ ok: true, note: "no order_id in event" });
    }

    const supabase = freshSupabase();

    // Find our order by tamara_order_id
    const { data: order } = await supabase
      .from("store_orders")
      .select("*, store_products(duration_days)")
      .eq("tamara_order_id", tamaraOrderId)
      .maybeSingle();

    if (!order) {
      console.warn(`Tamara webhook: order not found for tamara_order_id=${tamaraOrderId}`);
      return NextResponse.json({ ok: true, note: "order not found" });
    }

    // order_approved → capture
    if (
      eventType === "order_approved" ||
      eventType === "ORDER_APPROVED"
    ) {
      if (order.status !== "paid") {
        try {
          await captureOrder(tamaraOrderId, Number(order.amount));
        } catch (e) {
          console.warn("Webhook capture error:", e);
        }

        await supabase
          .from("store_orders")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", order.id);

        // Create/extend user account
        if (order.user_email) {
          const durationDays =
            (Array.isArray(order.store_products)
              ? order.store_products[0]?.duration_days
              : order.store_products?.duration_days) ?? 30;

          const { data: u } = await supabase
            .from("users")
            .select("id, subscription_ends_at")
            .eq("email", order.user_email)
            .maybeSingle();

          if (u) {
            const base =
              u.subscription_ends_at && new Date(u.subscription_ends_at) > new Date()
                ? new Date(u.subscription_ends_at)
                : new Date();
            base.setDate(base.getDate() + durationDays);
            await supabase
              .from("users")
              .update({ subscription_ends_at: base.toISOString() })
              .eq("id", u.id);
          }
        }
      }
    }

    // order_declined or order_expired → mark failed
    if (
      ["order_declined", "order_expired", "ORDER_DECLINED", "ORDER_EXPIRED"].includes(eventType)
    ) {
      await supabase
        .from("store_orders")
        .update({ status: "failed" })
        .eq("id", order.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Tamara webhook error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
