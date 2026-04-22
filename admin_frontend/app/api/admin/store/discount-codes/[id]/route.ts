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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("store"); if (denied) return denied;
  const supabase = freshClient();
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

  if (body.usage_limit !== undefined) {
    if (body.usage_limit === null || body.usage_limit === "") {
      updates.usage_limit = null;
    } else {
      const n = Number(body.usage_limit);
      if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
        return NextResponse.json({ ok: false, error: "حد الاستخدام يجب أن يكون رقماً صحيحاً ≥ 1" }, { status: 400 });
      }
      updates.usage_limit = n;
    }
  }

  if (body.expires_at !== undefined) {
    if (body.expires_at && Number.isNaN(new Date(body.expires_at).getTime())) {
      return NextResponse.json({ ok: false, error: "تاريخ الانتهاء غير صحيح" }, { status: 400 });
    }
    updates.expires_at = body.expires_at || null;
  }

  // Multi-product scope replacement
  if (Array.isArray(body.product_ids)) {
    const ids = Array.from(new Set(body.product_ids.filter((v: unknown): v is string => typeof v === "string" && v.length > 0)));
    await supabase.from("discount_code_products").delete().eq("discount_code_id", params.id);
    if (ids.length > 0) {
      await supabase.from("discount_code_products").insert(
        ids.map((pid) => ({ discount_code_id: params.id, product_id: pid }))
      );
    }
    updates.applies_to_all_products = ids.length === 0;
    updates.product_id = null;
  }

  // Multi-gateway scope replacement
  if (Array.isArray(body.gateways)) {
    const gws = Array.from(new Set(body.gateways.filter((v: unknown): v is string => typeof v === "string" && ALLOWED_GATEWAYS.has(v))));
    await supabase.from("discount_code_gateways").delete().eq("discount_code_id", params.id);
    if (gws.length > 0) {
      await supabase.from("discount_code_gateways").insert(
        gws.map((g) => ({ discount_code_id: params.id, gateway: g }))
      );
    }
    updates.applies_to_all_gateways = gws.length === 0;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("discount_codes").update(updates).eq("id", params.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("store"); if (denied) return denied;
  const supabase = freshClient();
  const { error } = await supabase.from("discount_codes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
