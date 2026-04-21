import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const denied = enforcePermission("store"); if (denied) return denied;
  const supabase = freshClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*, store_products(name)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, codes: data || [] });
}

export async function POST(req: Request) {
  const denied = enforcePermission("store"); if (denied) return denied;
  const supabase = freshClient();
  const body = await req.json();
  const {
    code, discount_type, discount_value,
    product_id, usage_limit, expires_at,
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

  const { data, error } = await supabase
    .from("discount_codes")
    .insert({
      code: cleanCode,
      discount_type,
      discount_value: value,
      product_id: product_id || null,
      usage_limit: cleanLimit,
      expires_at: expires_at || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    const msg = /duplicate|unique/i.test(error.message) ? "هذا الكود موجود مسبقاً" : error.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true, discount: data });
}
