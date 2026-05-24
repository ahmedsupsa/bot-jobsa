import { createClient } from "@supabase/supabase-js";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export type MarketerLookup = {
  id: string;
  name: string;
  code: string;
  commission_type: "percent" | "fixed";
  commission_value: number;
  product_id: string | null;
};

export async function lookupMarketerCode(
  supabase: ReturnType<typeof freshClient>,
  code: string
): Promise<MarketerLookup | null> {
  const { data } = await supabase
    .from("affiliate_marketers")
    .select("id, name, code, commission_type, commission_value, product_id, is_active")
    .eq("code", code.trim().toUpperCase())
    .eq("is_active", true)
    .maybeSingle();
  return data || null;
}

export function calcCommission(
  marketer: Pick<MarketerLookup, "commission_type" | "commission_value">,
  orderAmount: number
): number {
  if (marketer.commission_type === "percent") {
    return Math.round(orderAmount * (marketer.commission_value / 100) * 100) / 100;
  }
  return marketer.commission_value;
}

export async function createMarketerCommission(
  orderId: string,
  options?: { supabase?: ReturnType<typeof freshClient> }
): Promise<boolean> {
  const supabase = options?.supabase || freshClient();

  const { data: order } = await supabase
    .from("store_orders")
    .select("id, affiliate_marketer_id, affiliate_code, amount, user_name, user_email, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.status !== "paid") return false;
  if (!order.affiliate_marketer_id && !order.affiliate_code) return false;

  const { data: existingSale } = await supabase
    .from("affiliate_sales")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existingSale) return false;

  let marketer: MarketerLookup | null = null;
  if (order.affiliate_marketer_id) {
    const { data } = await supabase
      .from("affiliate_marketers")
      .select("id, name, code, commission_type, commission_value, product_id, is_active")
      .eq("id", order.affiliate_marketer_id)
      .maybeSingle();
    marketer = data;
  } else if (order.affiliate_code) {
    marketer = await lookupMarketerCode(supabase, order.affiliate_code);
  }

  if (!marketer) return false;

  const orderAmount = Number(order.amount || 0);
  const commission = calcCommission(marketer, orderAmount);

  await supabase.from("affiliate_sales").insert({
    affiliate_id: marketer.id,
    order_id: orderId,
    customer_name: order.user_name || null,
    customer_email: order.user_email || null,
    order_amount: orderAmount,
    commission_earned: commission,
    status: "pending",
  });

  await supabase
    .from("store_orders")
    .update({
      affiliate_marketer_id: marketer.id,
      affiliate_code: marketer.code,
      affiliate_commission: commission,
    })
    .eq("id", orderId);

  return true;
}
