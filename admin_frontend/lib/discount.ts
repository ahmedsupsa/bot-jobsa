import { createClient } from "@supabase/supabase-js";

export type DiscountCode = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  product_id: string | null;
  usage_limit: number | null;
  usage_count: number;
  expires_at: string | null;
  is_active: boolean;
};

export type DiscountResult = {
  ok: true;
  code: DiscountCode;
  original_amount: number;
  discounted_amount: number;
  discount_amount: number;
};

export type DiscountError = { ok: false; error: string };

function client() {
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

function validateBasics(dc: DiscountCode | null, productId: string): DiscountError | null {
  if (!dc) return { ok: false, error: "كود الخصم غير صحيح" };
  if (!dc.is_active) return { ok: false, error: "هذا الكود متوقف" };
  if (dc.expires_at && new Date(dc.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "انتهت صلاحية هذا الكود" };
  }
  if (dc.usage_limit != null && dc.usage_count >= dc.usage_limit) {
    return { ok: false, error: "تم استنفاد هذا الكود" };
  }
  if (dc.product_id && dc.product_id !== productId) {
    return { ok: false, error: "هذا الكود لا ينطبق على هذا المنتج" };
  }
  return null;
}

/**
 * Read-only preview — used by /api/store/validate-discount.
 * Does NOT consume usage.
 */
export async function previewDiscount(
  rawCode: string,
  productId: string,
  basePrice: number,
): Promise<DiscountResult | DiscountError> {
  const code = rawCode?.trim().toUpperCase();
  if (!code) return { ok: false, error: "كود الخصم مطلوب" };

  const supabase = client();
  const { data: dc } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  const err = validateBasics(dc as DiscountCode | null, productId);
  if (err) return err;

  const { original, discountAmount, discounted } = computeDiscount(dc as DiscountCode, basePrice);
  return {
    ok: true,
    code: dc as DiscountCode,
    original_amount: original,
    discounted_amount: discounted,
    discount_amount: discountAmount,
  };
}

/**
 * Atomic reservation — used by /api/store/checkout.
 * Validates and increments usage_count in a single conditional UPDATE
 * to prevent race-condition over-redemption.
 */
export async function reserveDiscount(
  rawCode: string,
  productId: string,
  basePrice: number,
): Promise<DiscountResult | DiscountError> {
  const code = rawCode?.trim().toUpperCase();
  if (!code) return { ok: false, error: "كود الخصم مطلوب" };

  const supabase = client();

  // Step 1: load current state for clean error messages
  const { data: dc } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  const basicErr = validateBasics(dc as DiscountCode | null, productId);
  if (basicErr) return basicErr;

  const current = dc as DiscountCode;
  const expectedNext = current.usage_count + 1;

  // Step 2: atomic conditional update — only succeeds if usage_count
  // is still what we read. Acts as optimistic lock against concurrent checkouts.
  const { data: updated, error: updErr } = await supabase
    .from("discount_codes")
    .update({ usage_count: expectedNext })
    .eq("id", current.id)
    .eq("usage_count", current.usage_count)
    .eq("is_active", true)
    .select()
    .maybeSingle();

  if (updErr || !updated) {
    return { ok: false, error: "هذا الكود قيد الاستخدام، حاول مجدداً" };
  }

  // Re-check limit after increment (defensive)
  if (current.usage_limit != null && expectedNext > current.usage_limit) {
    // Rollback
    await supabase.from("discount_codes")
      .update({ usage_count: current.usage_count })
      .eq("id", current.id);
    return { ok: false, error: "تم استنفاد هذا الكود" };
  }

  const { original, discountAmount, discounted } = computeDiscount(current, basePrice);
  return {
    ok: true,
    code: current,
    original_amount: original,
    discounted_amount: discounted,
    discount_amount: discountAmount,
  };
}

/**
 * Release a previously-reserved discount usage (e.g., when checkout fails after reservation).
 * Atomic via the `decrement_discount_usage` SQL function — safe under concurrency.
 */
export async function releaseDiscount(codeId: string) {
  const supabase = client();
  await supabase.rpc("decrement_discount_usage", { code_id: codeId });
}
