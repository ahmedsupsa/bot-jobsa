import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

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
  const { error } = await supabase.from("discount_codes").update(updates).eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("store"); if (denied) return denied;
  const supabase = freshClient();
  const { error } = await supabase.from("discount_codes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
