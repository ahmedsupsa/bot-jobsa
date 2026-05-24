import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET — list all affiliate marketers with stats
export async function GET() {
  const _denied_ = enforcePermission("affiliate"); if (_denied_) return _denied_;
  const supabase = freshClient();

  const { data: marketers, error } = await supabase
    .from("affiliate_marketers")
    .select("*, store_products(name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (!marketers || marketers.length === 0) {
    return NextResponse.json({ ok: true, marketers: [] });
  }

  // Get sales stats per marketer — use RPC to bypass PostgREST permission issue
  const { data: sales } = await supabase
    .rpc("get_all_affiliate_sales");

  // Get click counts per marketer code
  const codes = marketers.map((m) => m.code);
  const { data: clicks } = codes.length
    ? await supabase
        .from("affiliate_clicks")
        .select("affiliate_code")
        .in("affiliate_code", codes)
    : { data: [] };

  const clicksByCode = new Map<string, number>();
  for (const c of clicks || []) {
    clicksByCode.set(c.affiliate_code, (clicksByCode.get(c.affiliate_code) || 0) + 1);
  }

  const statsByMarketer = new Map<string, { count: number; total: number; pending: number; paid: number }>();
  for (const s of sales || []) {
    const cur = statsByMarketer.get(s.affiliate_id) || { count: 0, total: 0, pending: 0, paid: 0 };
    cur.count += 1;
    cur.total += Number(s.commission_earned || 0);
    if (s.status === "pending") cur.pending += Number(s.commission_earned || 0);
    if (s.status === "paid") cur.paid += Number(s.commission_earned || 0);
    statsByMarketer.set(s.affiliate_id, cur);
  }

  const result = marketers.map((m) => {
    const stats = statsByMarketer.get(m.id) || { count: 0, total: 0, pending: 0, paid: 0 };
    const clicks_count = clicksByCode.get(m.code) || 0;
    const conversion_rate = clicks_count > 0
      ? Math.round((stats.count / clicks_count) * 100)
      : null;
    return {
      ...m,
      product_name: m.store_products?.name || null,
      sales_count: stats.count,
      total_earned: stats.total,
      pending_earned: stats.pending,
      paid_earned: stats.paid,
      clicks_count,
      conversion_rate,
    };
  });

  return NextResponse.json({ ok: true, marketers: result });
}

// POST — create new marketer
export async function POST(req: Request) {
  const _denied_ = enforcePermission("affiliate"); if (_denied_) return _denied_;
  const supabase = freshClient();
  const body = await req.json();
  const { name, email, phone, code, commission_type, commission_value, product_id, notes } = body;

  if (!name?.trim()) return NextResponse.json({ ok: false, error: "الاسم مطلوب" }, { status: 400 });
  if (!code?.trim()) return NextResponse.json({ ok: false, error: "كود الإحالة مطلوب" }, { status: 400 });
  if (!commission_value) return NextResponse.json({ ok: false, error: "قيمة العمولة مطلوبة" }, { status: 400 });

  const { data, error } = await supabase
    .from("affiliate_marketers")
    .insert({
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      code: code.trim().toUpperCase(),
      commission_type: commission_type || "percent",
      commission_value: Number(commission_value),
      product_id: product_id || null,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: false, error: "هذا الكود مستخدم بالفعل" }, { status: 400 });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, marketer: data });
}

// PUT — update marketer
export async function PUT(req: Request) {
  const _denied_ = enforcePermission("affiliate"); if (_denied_) return _denied_;
  const supabase = freshClient();
  const body = await req.json();
  const { id, name, email, phone, code, commission_type, commission_value, product_id, is_active, notes } = body;

  if (!id) return NextResponse.json({ ok: false, error: "id مطلوب" }, { status: 400 });

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name.trim();
  if (email !== undefined) updates.email = email?.trim() || null;
  if (phone !== undefined) updates.phone = phone?.trim() || null;
  if (code !== undefined) updates.code = code.trim().toUpperCase();
  if (commission_type !== undefined) updates.commission_type = commission_type;
  if (commission_value !== undefined) updates.commission_value = Number(commission_value);
  if (product_id !== undefined) updates.product_id = product_id || null;
  if (is_active !== undefined) updates.is_active = is_active;
  if (notes !== undefined) updates.notes = notes?.trim() || null;

  const { error } = await supabase.from("affiliate_marketers").update(updates).eq("id", id);
  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: false, error: "هذا الكود مستخدم بالفعل" }, { status: 400 });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove marketer
export async function DELETE(req: Request) {
  const _denied_ = enforcePermission("affiliate"); if (_denied_) return _denied_;
  const supabase = freshClient();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "id مطلوب" }, { status: 400 });

  const { error } = await supabase.from("affiliate_marketers").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
