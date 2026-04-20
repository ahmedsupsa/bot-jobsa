import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPayment, getInvoice } from "@/lib/streampay";
import { makeToken } from "@/lib/auth";

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

function genCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const d = Array.from({ length: 7 }, () => digits[Math.floor(Math.random() * 10)]).join("");
  const l = Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * 26)]).join("");
  return d + l;
}

async function createActivationCode(supabase: ReturnType<typeof freshSupabase>, durationDays: number): Promise<string | null> {
  for (let i = 0; i < 10; i++) {
    const candidate = genCode();
    const { data: existing } = await supabase
      .from("activation_codes")
      .select("code")
      .eq("code", candidate)
      .maybeSingle();
    if (!existing) {
      const { data } = await supabase
        .from("activation_codes")
        .insert({ code: candidate, subscription_days: durationDays, used: false, created_at: new Date().toISOString() })
        .select("id")
        .single();
      return data?.id ?? null;
    }
  }
  return null;
}

async function autoCreateAccount(
  supabase: ReturnType<typeof freshSupabase>,
  order: any,
  durationDays: number
): Promise<{ token: string; user_id: string; account_created: boolean } | null> {
  try {
    const email = order.user_email?.trim().toLowerCase();
    const name = order.user_name?.trim() || "مستخدم";
    const phone = order.user_phone?.trim() || "غير محدد";
    const ends_at = new Date(Date.now() + durationDays * 86400000).toISOString();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, subscription_ends_at")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      // Extend subscription
      const base = existingUser.subscription_ends_at && new Date(existingUser.subscription_ends_at) > new Date()
        ? new Date(existingUser.subscription_ends_at)
        : new Date();
      base.setDate(base.getDate() + durationDays);
      await supabase.from("users").update({ subscription_ends_at: base.toISOString() }).eq("id", existingUser.id);
      const token = await makeToken(String(existingUser.id));
      return { token, user_id: String(existingUser.id), account_created: false };
    }

    // Create activation code first (for record-keeping)
    const codeId = await createActivationCode(supabase, durationDays);

    // Create user account
    const insertData: any = {
      full_name: name,
      phone,
      email,
      subscription_ends_at: ends_at,
      ...(codeId ? { activation_code_id: codeId } : {}),
    };

    let { data: userRows, error: userErr } = await supabase
      .from("users")
      .insert(insertData)
      .select("id");

    // Telegram fallback if column is NOT NULL
    if (userErr && (userErr.message?.includes("telegram_id") || userErr.message?.includes("null value"))) {
      const fb = await supabase
        .from("users")
        .insert({ ...insertData, telegram_id: -(Date.now() % 2147483647 + Math.floor(Math.random() * 99999)) })
        .select("id");
      userRows = fb.data;
      userErr = fb.error;
    }

    if (userErr || !userRows?.[0]) {
      console.error("Auto account creation error:", userErr?.message);
      return null;
    }

    const userId = userRows[0].id;

    // Mark activation code as used by this user
    if (codeId) {
      await supabase
        .from("activation_codes")
        .update({ used: true, used_at: new Date().toISOString(), used_by_user_id: userId })
        .eq("id", codeId);
    }

    // Create user_settings so email login works later
    try { await supabase.from("user_settings").insert({ user_id: userId, email }); } catch {}

    const token = await makeToken(String(userId));
    return { token, user_id: String(userId), account_created: true };
  } catch (e) {
    console.error("autoCreateAccount exception:", e);
    return null;
  }
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

    // Already paid — try to return token for existing user
    if (order.status === "paid") {
      let token: string | null = null;
      let account_created = false;
      if (order.user_email) {
        const { data: u } = await supabase.from("users").select("id").eq("email", order.user_email).maybeSingle();
        if (u) token = await makeToken(String(u.id));
      }
      return NextResponse.json({ ok: true, already_paid: true, token, account_created, order });
    }

    if (redirectStatus !== "paid") {
      await supabase.from("store_orders").update({ status: "failed" }).eq("id", order_id);
      return NextResponse.json({ ok: false, error: "الدفع لم يكتمل" });
    }

    // Verify payment with StreamPay
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

    // Mark order as paid
    await supabase.from("store_orders").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      streampay_payment_id: payment_id || null,
      streampay_invoice_id: invoice_id || null,
    }).eq("id", order_id);

    // Get duration days
    let durationDays = getDurationDays(order.store_products);
    if (durationDays === 30 && order.product_id) {
      const { data: prod } = await supabase
        .from("store_products")
        .select("duration_days")
        .eq("id", order.product_id)
        .single();
      if (prod?.duration_days) durationDays = prod.duration_days;
    }

    // Auto-create or update user account
    const accountResult = await autoCreateAccount(supabase, order, durationDays);

    // Track affiliate commission
    if (order.ref_code) {
      try {
        const { data: aff } = await supabase
          .from("affiliates")
          .select("user_id")
          .eq("code", order.ref_code)
          .maybeSingle();
        if (aff?.user_id) {
          const amount = Number(order.amount || 0);
          const commission = Math.round(amount * 0.10 * 100) / 100;
          await supabase.from("affiliate_referrals").insert({
            affiliate_user_id: aff.user_id,
            order_id: order.id,
            amount,
            commission,
            status: "pending",
          });
        }
      } catch (e) {
        console.error("Affiliate commission error:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      account_created: accountResult?.account_created ?? false,
      token: accountResult?.token ?? null,
      user_id: accountResult?.user_id ?? null,
      order: { ...order, status: "paid" },
    });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ ok: false, error: "خطأ في التحقق من الدفع" }, { status: 500 });
  }
}
