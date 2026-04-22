import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type Gateway = "tamara" | "streampay" | "bank_transfer";

export type DiscountCode = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  product_id: string | null; // legacy, may be ignored when junction populated
  usage_limit: number | null;
  usage_count: number;
  expires_at: string | null;
  is_active: boolean;
  applies_to_all_products?: boolean;
  applies_to_all_gateways?: boolean;
};

export type DiscountResult = {
  ok: true;
  code: DiscountCode;
  original_amount: number;
  discounted_amount: number;
  discount_amount: number;
};

export type DiscountError = { ok: false; error: string };

function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

function computeDiscount(dc: DiscountCode, basePrice: number) {
  const original = Number(basePrice);
  let discountAmount = 0;
  if (dc.discount_type === "percent") {
    discountAmount = Math.round(((original * Number(dc.discount_value)) / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(Number(dc.discount_value), original);
  }
  const discounted = Math.max(0, Math.round((original - discountAmount) * 100) / 100);
  return { original, discountAmount, discounted };
}

async function fetchScopeIds(
  supabase: SupabaseClient, codeId: string
): Promise<{ productIds: Set<string>; gateways: Set<string> }> {
  const [{ data: prods }, { data: gws }] = await Promise.all([
    supabase.from("discount_code_products").select("product_id").eq("discount_code_id", codeId),
    supabase.from("discount_code_gateways").select("gateway").eq("discount_code_id", codeId),
  ]);
  return {
    productIds: new Set((prods || []).map((r: any) => r.product_id)),
    gateways: new Set((gws || []).map((r: any) => r.gateway)),
  };
}

async function loadAndValidate(
  supabase: SupabaseClient,
  rawCode: string,
  productId: string,
  gateway: Gateway | undefined
): Promise<{ ok: true; code: DiscountCode } | DiscountError> {
  const code = rawCode?.trim().toUpperCase();
  if (!code) return { ok: false, error: "كود الخصم مطلوب" };

  const { data: dc } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (!dc) return { ok: false, error: "كود الخصم غير صحيح" };
  if (!dc.is_active) return { ok: false, error: "هذا الكود متوقف" };
  if (dc.expires_at && new Date(dc.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "انتهت صلاحية هذا الكود" };
  }
  if (dc.usage_limit != null && dc.usage_count >= dc.usage_limit) {
    return { ok: false, error: "تم استنفاد هذا الكود" };
  }

  const scope = await fetchScopeIds(supabase, dc.id);

  // Product scope: junction wins; if junction empty, fall back to legacy product_id, else "all".
  const productScopeEmpty = scope.productIds.size === 0 && !dc.product_id;
  const allowAllProducts = dc.applies_to_all_products !== false && productScopeEmpty;

  if (!allowAllProducts) {
    const allowed = scope.productIds.size > 0 ? scope.productIds : new Set([dc.product_id].filter(Boolean) as string[]);
    if (!allowed.has(productId)) {
      return { ok: false, error: "هذا الكود لا ينطبق على هذا المنتج" };
    }
  }

  // Gateway scope
  const gatewayScopeEmpty = scope.gateways.size === 0;
  const allowAllGateways = dc.applies_to_all_gateways !== false && gatewayScopeEmpty;

  if (!allowAllGateways && gateway) {
    if (!scope.gateways.has(gateway)) {
      return { ok: false, error: "هذا الكود لا ينطبق على طريقة الدفع المختارة" };
    }
  }

  return { ok: true, code: dc as DiscountCode };
}

/**
 * Read-only preview — used by /api/store/validate-discount AND /api/store/checkout.
 * Does NOT mutate any usage count. Real usage is computed by a DB trigger that
 * increments only when a `store_orders` row reaches `status = 'paid'`.
 */
export async function validateDiscount(
  rawCode: string,
  productId: string,
  basePrice: number,
  gateway?: Gateway
): Promise<DiscountResult | DiscountError> {
  const supabase = client();
  const v = await loadAndValidate(supabase, rawCode, productId, gateway);
  if (!v.ok) return v;

  const { original, discountAmount, discounted } = computeDiscount(v.code, basePrice);
  return {
    ok: true,
    code: v.code,
    original_amount: original,
    discounted_amount: discounted,
    discount_amount: discountAmount,
  };
}

// ─── Backwards-compat aliases (kept for any caller still importing the old names) ───
export const previewDiscount = validateDiscount;
export const reserveDiscount = validateDiscount;
export async function releaseDiscount(_codeId: string) { /* no-op: usage is sales-driven now */ }
