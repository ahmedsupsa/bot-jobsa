import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { createCheckoutSession } from "@/lib/tamara";
import { findOrCreateConsumer, createPaymentLink, createProduct as createStreamPayProduct } from "@/lib/streampay";
import { validateDiscount, type Gateway } from "@/lib/discount";
import { validateEmail } from "@/lib/email-validation";
import { validatePhoneSA } from "@/lib/phone-validation";

const rawSite = process.env.NEXT_PUBLIC_SITE_URL || process.env.ADMIN_DASHBOARD_URL || "https://www.jobbots.org";
const SITE = rawSite
  .replace("https://jobbots.org", "https://www.jobbots.org")
  .replace("http://jobbots.org", "https://www.jobbots.org");

export async function POST(req: Request) {
  let appliedDiscount: { id: string; code: string } | null = null;
  try {
    const { product_id, name, email, phone, ref_code, discount_code, gateway = "tamara" } = await req.json();

    if (!product_id || !email?.trim() || !name?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { ok: false, error: "الاسم والبريد الإلكتروني والجوال مطلوبة" },
        { status: 400 }
      );
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      return NextResponse.json(
        { ok: false, error: emailCheck.error },
        { status: 400 }
      );
    }

    const phoneCheck = validatePhoneSA(phone);
    if (!phoneCheck.ok) {
      // Allow if it's a 10-digit number starting with 05
      const digits = phone.replace(/[^\d]/g, "");
      if (digits.length === 10 && digits.startsWith("05")) {
        // proceed
      } else {
        return NextResponse.json(
          { ok: false, error: phoneCheck.error },
          { status: 400 }
        );
      }
    }

    const { data: product, error: pErr } = await supabase
      .from("store_products")
      .select("*")
      .eq("id", product_id)
      .eq("is_active", true)
      .single();

    if (pErr || !product) {
      return NextResponse.json({ ok: false, error: "المنتج غير متاح" }, { status: 404 });
    }

    let validRefCode: string | null = null;
    if (ref_code && typeof ref_code === "string") {
      const { data: aff } = await supabase
        .from("affiliates")
        .select("code")
        .eq("code", ref_code.trim().toUpperCase())
        .maybeSingle();
      if (aff) validRefCode = aff.code;
    }

    // ─── Discount code (optional) ─── validate-only; usage is counted by
    // a DB trigger when the order's status transitions to 'paid'. This
    // ensures abandoned/failed checkouts NEVER consume a discount slot.
    let finalAmount = Number(product.price);
    if (discount_code && typeof discount_code === "string" && discount_code.trim()) {
      const dr = await validateDiscount(discount_code, product.id, Number(product.price), gateway as Gateway);
      if (!dr.ok) {
        return NextResponse.json({ ok: false, error: dr.error }, { status: 400 });
      }
      finalAmount = dr.discounted_amount;
      appliedDiscount = { id: dr.code.id, code: dr.code.code };
    }

    // Kept as a no-op for diff stability — discount usage is sales-driven.
    const releaseOnFail = async () => { /* no-op */ };

    // Status convention:
    //  - bank_transfer  → "pending"          (admin must verify the receipt)
    //  - tamara/streampay → "awaiting_payment" (user hasn't paid yet at the gateway;
    //                       webhooks bump to "paid" or "failed" once they act)
    // This keeps the "pending" lane reserved for orders that genuinely need
    // admin attention.
    const initialStatus = gateway === "bank_transfer" ? "pending" : "awaiting_payment";

    const orderBase = {
      product_id: product.id,
      user_name: name.trim(),
      user_email: email.trim().toLowerCase(),
      amount: finalAmount,
      original_amount: Number(product.price),
      status: initialStatus,
      payment_gateway: gateway,
      ref_code: validRefCode,
      discount_code: appliedDiscount?.code || null,
      discount_code_id: appliedDiscount?.id || null,
    };

    const insertOrder = async (payload: Record<string, unknown>) => {
      return await supabase.from("store_orders").insert(payload).select().single();
    };

    let { data: order, error: orderErr } = await insertOrder({
      ...orderBase,
      user_phone: phone?.trim() || null,
    });

    // Backwards-compat fallbacks for older DB schemas
    if (orderErr) {
      const msg = orderErr.message || "";
      const stripped: Record<string, unknown> = { ...orderBase, user_phone: phone?.trim() || null };
      if (/user_phone/i.test(msg)) delete stripped.user_phone;
      if (/discount_code_id/i.test(msg)) delete stripped.discount_code_id;
      if (/discount_code(?!_id)/i.test(msg)) delete stripped.discount_code;
      if (/original_amount/i.test(msg)) delete stripped.original_amount;
      if (/payment_gateway/i.test(msg)) delete stripped.payment_gateway;
      // Some older deployments have a CHECK constraint on status that doesn't
      // include "awaiting_payment" — fall back to "pending" in that case.
      if (/status/i.test(msg) && stripped.status === "awaiting_payment") {
        stripped.status = "pending";
      }
      const fb = await insertOrder(stripped);
      order = fb.data;
      orderErr = fb.error;
    }

    // Hard-fail if order persistence failed — never proceed to payment
    // without a persisted order, otherwise webhook reconciliation breaks.
    if (!order?.id) {
      await releaseOnFail();
      console.error("Order persistence failed:", orderErr);
      return NextResponse.json(
        { ok: false, error: orderErr?.message || "فشل إنشاء الطلب، حاول مجدداً" },
        { status: 500 }
      );
    }

    const orderId = order.id;

    // Normalize phone for external APIs
    const phoneNormalized = phone.trim().startsWith("05") ? "966" + phone.trim().substring(1) : (phone.trim().startsWith("5") ? "966" + phone.trim() : phone.trim());

    // Normalize phone for external APIs
    const phoneNormalized = phone.trim().startsWith("05") ? "966" + phone.trim().substring(1) : (phone.trim().startsWith("5") ? "966" + phone.trim() : phone.trim());

    // ─── Tamara ───────────────────────────────────────────────────────────
    if (gateway === "tamara") {
      // ...
      const session = await createCheckoutSession({
        // ...
        phone: phoneNormalized.trim(),
        // ...
      });
      // ...
    }


      if (!checkoutUrl) throw new Error("لم يتم الحصول على رابط الدفع من Tamara");
      return NextResponse.json({ ok: true, url: checkoutUrl });
    }

    // ─── StreamPay ────────────────────────────────────────────────────────
    if (gateway === "streampay") {
      if (!product.streampay_product_id) {
        await releaseOnFail();
        return NextResponse.json(
          { ok: false, error: "هذا المنتج غير مرتبط ببوابة StreamPay بعد" },
          { status: 400 }
        );
      }

      const consumer = await findOrCreateConsumer(
        name.trim(),
        email.trim().toLowerCase(),
        phoneNormalized || undefined
      );
      const consumerId = consumer?.id || consumer?.data?.id;

      // If a discount code lowered the price, create an ad-hoc StreamPay
      // product with the discounted amount (StreamPay product prices are
      // fixed at product-creation time, so we can't override per-link).
      let streampayProductId = product.streampay_product_id as string;
      if (appliedDiscount && finalAmount < Number(product.price)) {
        const adhoc = await createStreamPayProduct({
          name: `${product.name} — خصم ${appliedDiscount.code}`,
          description: product.description || product.name,
          price: finalAmount,
        });
        const adhocId = adhoc?.id || adhoc?.data?.id;
        if (!adhocId) throw new Error("فشل إنشاء منتج الخصم في StreamPay");
        streampayProductId = adhocId;
      }

      const link = await createPaymentLink({
        name: `اشتراك ${product.name} — Jobbots`,
        description: product.description || product.name,
        product_id: streampayProductId,
        consumer_id: consumerId,
        success_url: `${SITE}/store/success?order_id=${orderId}`,
        failure_url: `${SITE}/store/failure?order_id=${orderId}`,
        metadata: {
          order_id: orderId,
          user_email: email.trim().toLowerCase(),
          product_name: product.name,
          discount_code: appliedDiscount?.code || "",
        },
      });

      const paymentUrl = link?.url || link?.data?.url;
      const linkId = link?.id || link?.data?.id;

      if (order?.id && linkId) {
        await supabase
          .from("store_orders")
          .update({ streampay_payment_link_id: linkId })
          .eq("id", order.id);
      }

      if (!paymentUrl) throw new Error("لم يتم الحصول على رابط الدفع من StreamPay");
      return NextResponse.json({ ok: true, url: paymentUrl });
    }

    // ─── Bank Transfer ────────────────────────────────────────────────────
    if (gateway === "bank_transfer") {
      const originalAmount = Number(product.price);
      // Apply legacy 15% bank discount only if no explicit discount code was used
      let discountedAmount = finalAmount;
      if (!appliedDiscount && originalAmount > 40) {
        discountedAmount = Math.round(originalAmount * 0.85 * 100) / 100;
      }
      const hasDiscount = discountedAmount < originalAmount;
      const discountLabel = appliedDiscount
        ? appliedDiscount.code
        : hasDiscount ? "خصم 15%" : null;

      if (order?.id) {
        try {
          await supabase
            .from("store_orders")
            .update({ amount: discountedAmount, payment_gateway: "bank_transfer" })
            .eq("id", order.id);
        } catch {}
      }

      const { data: accounts } = await supabase
        .from("bank_accounts")
        .select("id, type, name, account_number, iban, phone, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      return NextResponse.json({
        ok: true,
        gateway: "bank_transfer",
        order_id: orderId,
        amount: discountedAmount,
        original_amount: originalAmount,
        has_discount: hasDiscount,
        discount_label: discountLabel,
        accounts: accounts || [],
      });
    }

    await releaseOnFail();
    return NextResponse.json({ ok: false, error: "بوابة الدفع غير معروفة" }, { status: 400 });
  } catch (err: any) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "حدث خطأ أثناء إنشاء رابط الدفع، حاول مجدداً" },
      { status: 500 }
    );
  }
}
