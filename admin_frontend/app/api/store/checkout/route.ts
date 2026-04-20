import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { createCheckoutSession } from "@/lib/tamara";

const rawSite = process.env.NEXT_PUBLIC_SITE_URL || process.env.ADMIN_DASHBOARD_URL || "https://www.jobbots.org";
const SITE = rawSite
  .replace("https://jobbots.org", "https://www.jobbots.org")
  .replace("http://jobbots.org", "https://www.jobbots.org");

export async function POST(req: Request) {
  try {
    const { product_id, name, email, phone, ref_code } = await req.json();

    if (!product_id || !email?.trim() || !name?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { ok: false, error: "الاسم والبريد الإلكتروني والجوال مطلوبة" },
        { status: 400 }
      );
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

    const orderBase = {
      product_id: product.id,
      user_name: name.trim(),
      user_email: email.trim().toLowerCase(),
      amount: product.price,
      status: "pending",
      ref_code: validRefCode,
    };

    let { data: order, error: orderErr } = await supabase
      .from("store_orders")
      .insert({ ...orderBase, user_phone: phone?.trim() || null })
      .select()
      .single();

    if (orderErr?.message?.includes("user_phone")) {
      const fb = await supabase.from("store_orders").insert(orderBase).select().single();
      order = fb.data;
    }

    const orderId = order?.id || crypto.randomUUID();

    const session = await createCheckoutSession({
      orderId,
      amount: Number(product.price),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      productName: product.name,
      productDescription: product.description || product.name,
      successUrl: `${SITE}/store/success?order_id=${orderId}`,
      failureUrl: `${SITE}/store/failure?order_id=${orderId}`,
      cancelUrl: `${SITE}/store/failure?order_id=${orderId}&cancelled=1`,
      notificationUrl: `${SITE}/api/store/tamara-webhook`,
    });

    const checkoutUrl: string = session?.checkout_url;
    const tamaraOrderId: string = session?.order_id;
    const checkoutId: string = session?.checkout_id;

    if (order?.id) {
      try {
        await supabase
          .from("store_orders")
          .update({ tamara_order_id: tamaraOrderId || null, tamara_checkout_id: checkoutId || null })
          .eq("id", order.id);
      } catch {}
    }

    if (!checkoutUrl) {
      throw new Error("لم يتم الحصول على رابط الدفع من Tamara");
    }

    return NextResponse.json({ ok: true, url: checkoutUrl });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { ok: false, error: "حدث خطأ أثناء إنشاء رابط الدفع، حاول مجدداً" },
      { status: 500 }
    );
  }
}
