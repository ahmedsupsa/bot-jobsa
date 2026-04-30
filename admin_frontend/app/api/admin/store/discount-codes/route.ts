import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const ALLOWED_GATEWAYS = new Set(["tamara", "streampay", "bank_transfer"]);

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function enrich(supabase: ReturnType<typeof freshClient>, codes: any[]) {
  if (!codes.length) return codes;
  const ids = codes.map((c) => c.id);

  const [{ data: prodLinks }, { data: gwLinks }, { data: realPaid }] = await Promise.all([
    supabase.from("discount_code_products").select("discount_code_id, product_id, store_products(name)").in("discount_code_id", ids),
    supabase.from("discount_code_gateways").select("discount_code_id, gateway").in("discount_code_id", ids),
    supabase.from("store_orders").select("discount_code_id, amount, original_amount, status").in("discount_code_id", ids).eq("status", "paid"),
  ]);

  const byProd = new Map<string, { id: string; name: string }[]>();
  (prodLinks || []).forEach((r: any) => {
    const arr = byProd.get(r.discount_code_id) || [];
    arr.push({ id: r.product_id, name: r.store_products?.name || "" });
    byProd.set(r.discount_code_id, arr);
  });

  const byGw = new Map<string, string[]>();
  (gwLinks || []).forEach((r: any) => {
    const arr = byGw.get(r.discount_code_id) || [];
    arr.push(r.gateway);
    byGw.set(r.discount_code_id, arr);
  });

  // Real sales metrics per code
  const sales = new Map<string, { paid_orders: number; revenue: number; total_discount: number }>();
  (realPaid || []).forEach((o: any) => {
    const k = o.discount_code_id;
    const cur = sales.get(k) || { paid_orders: 0, revenue: 0, total_discount: 0 };
    cur.paid_orders += 1;
    cur.revenue += Number(o.amount || 0);
    const orig = Number(o.original_amount || o.amount || 0);
    cur.total_discount += Math.max(0, orig - Number(o.amount || 0));
    sales.set(k, cur);
  });

  return codes.map((c) => ({
    ...c,
    products: byProd.get(c.id) || [],
    gateways: byGw.get(c.id) || [],
    sales: sales.get(c.id) || { paid_orders: 0, revenue: 0, total_discount: 0 },
  }));
}

export async function GET() {
  const denied = enforcePermission("store"); if (denied) return denied;
  const supabase = freshClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const enriched = await enrich(supabase, data || []);
  return NextResponse.json({ ok: true, codes: enriched });
}

function cleanProductIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter((v): v is string => typeof v === "string" && v.length > 0)));
}
function cleanGateways(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter((v): v is string => typeof v === "string" && ALLOWED_GATEWAYS.has(v))));
}

export async function POST(req: Request) {
  const denied = enforcePermission("store"); if (denied) return denied;
  const supabase = freshClient();
  const body = await req.json();
  const {
    code, discount_type, discount_value,
    product_ids, gateways,
    usage_limit, expires_at,
  } = body;

  const cleanCode = String(code || "").trim().toUpperCase();
  if (!cleanCode) return NextResponse.json({ ok: false, error: "الكود مطلوب" }, { status: 400 });
  if (!["percent", "fixed"].includes(discount_type)) {
    return NextResponse.json({ ok: false, error: "نوع الخصم غير صحيح" }, { status: 400 });
  }
  const value = Number(discount_value);
  if (!value || value <= 0) {
    return NextResponse.json({ ok: false, error: "قيمة الخصم غير صحيحة" }, { status: 400 });
  }
  if (discount_type === "percent" && value > 100) {
    return NextResponse.json({ ok: false, error: "النسبة لا تتجاوز 100%" }, { status: 400 });
  }

  let cleanLimit: number | null = null;
  if (usage_limit !== null && usage_limit !== undefined && usage_limit !== "") {
    const n = Number(usage_limit);
    if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
      return NextResponse.json({ ok: false, error: "حد الاستخدام يجب أن يكون رقماً صحيحاً ≥ 1" }, { status: 400 });
    }
    cleanLimit = n;
  }

  if (expires_at) {
    const t = new Date(expires_at).getTime();
    if (Number.isNaN(t)) {
      return NextResponse.json({ ok: false, error: "تاريخ الانتهاء غير صحيح" }, { status: 400 });
    }
  }

  const prodIds = cleanProductIds(product_ids);
  const gws = cleanGateways(gateways);

  const { data, error } = await supabase
    .from("discount_codes")
    .insert({
      code: cleanCode,
      discount_type,
      discount_value: value,
      product_id: null, // legacy column unused now
      usage_limit: cleanLimit,
      expires_at: expires_at || null,
      is_active: true,
      applies_to_all_products: prodIds.length === 0,
      applies_to_all_gateways: gws.length === 0,
    })
    .select()
    .single();

  if (error) {
    const msg = /duplicate|unique/i.test(error.message) ? "هذا الكود موجود مسبقاً" : error.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  if (prodIds.length > 0) {
    await supabase.from("discount_code_products").insert(
      prodIds.map((pid) => ({ discount_code_id: data.id, product_id: pid }))
    );
  }
  if (gws.length > 0) {
    await supabase.from("discount_code_gateways").insert(
      gws.map((g) => ({ discount_code_id: data.id, gateway: g }))
    );
  }

  return NextResponse.json({ ok: true, discount: data });
}
