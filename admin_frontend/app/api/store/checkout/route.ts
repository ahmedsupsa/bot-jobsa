import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { findOrCreateConsumer, createPaymentLink } from "@/lib/streampay";

const rawSite = process.env.NEXT_PUBLIC_SITE_URL || process.env.ADMIN_DASHBOARD_URL || "https://www.jobbots.org";
// Ensure we always use www to avoid Firebase catching the apex domain
const SITE = rawSite.replace("https://jobbots.org", "https://www.jobbots.org").replace("http://jobbots.org", "https://www.jobbots.org");

export async function POST(req: Request) {
  try {
    const { product_id, name, email, phone, ref_code } = await req.json();
    if (!product_id || !email?.trim() || !name?.trim()) {
      return NextResponse.json({ ok: false, error: "الاسم والبريد الإلكتروني والمنتج مطلوبة" }, { status: 400 });
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

    if (!product.streampay_product_id) {
      return NextResponse.json({ ok: false, error: "هذا المنتج غير مرتبط ببوابة الدفع بعد" }, { status: 400 });
    }

    // Validate ref_code (must exist in affiliates)
    let validRefCode: string | null = null;
    if (ref_code && typeof ref_code === "string") {
      const { data: aff } = await supabase
        .from("affiliates")
        .select("code")
        .eq("code", ref_code.trim().toUpperCase())
        .maybeSingle();
      if (aff) validRefCode = aff.code;
    }

    const { data: order } = await supabase
      .from("store_orders")
      .insert({
        product_id: product.id,
        user_name: name.trim(),
        user_email: email.trim().toLowerCase(),
        amount: product.price,
        status: "pending",
        ref_code: validRefCode,
      })
      .select()
      .single();

    const orderId = order?.id || crypto.randomUUID();

    const consumer = await findOrCreateConsumer(name.trim(), email.trim().toLowerCase(), phone || undefined);
    const consumerId = consumer?.id || consumer?.data?.id;

    const link = await createPaymentLink({
      name: `اشتراك ${product.name} — Jobbots`,
      description: product.description || product.name,
      product_id: product.streampay_product_id,
      consumer_id: consumerId,
      success_url: `${SITE}/store/success?order_id=${orderId}`,
      failure_url: `${SITE}/store/failure?order_id=${orderId}`,
      metadata: {
        order_id: orderId,
        user_email: email.trim().toLowerCase(),
        product_name: product.name,
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

    return NextResponse.json({ ok: true, url: paymentUrl });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ ok: false, error: "حدث خطأ أثناء إنشاء رابط الدفع، حاول مجدداً" }, { status: 500 });
  }
}
