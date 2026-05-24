import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const supabase = freshClient();
  const code = params.code?.toUpperCase();

  if (!code) return NextResponse.json({ ok: false, error: "كود غير صحيح" }, { status: 400 });

  const { data: marketer, error: mErr } = await supabase
    .from("affiliate_marketers")
    .select("id, name, code, commission_type, commission_value, is_active, created_at")
    .eq("code", code)
    .single();

  if (mErr || !marketer) return NextResponse.json({ ok: false, error: "المسوّق غير موجود" }, { status: 404 });
  if (!marketer.is_active) return NextResponse.json({ ok: false, error: "هذا الحساب موقوف" }, { status: 403 });

  const { data: sales, error: sErr } = await supabase
    .from("affiliate_sales")
    .select("id, order_amount, commission_earned, status, customer_name, created_at, paid_at")
    .eq("affiliate_id", marketer.id)
    .order("created_at", { ascending: false });

  if (sErr) {
    console.error("[marketer-api] affiliate_sales error:", sErr.message, "| marketer_id:", marketer.id);
  }

  const { count: clicks_count, error: cErr } = await supabase
    .from("affiliate_clicks")
    .select("id", { count: "exact", head: true })
    .eq("affiliate_code", code);

  if (cErr) {
    console.error("[marketer-api] affiliate_clicks error:", cErr.message);
  }

  const allSales = sales || [];
  const total_earned   = allSales.reduce((s, r) => s + Number(r.commission_earned || 0), 0);
  const pending_earned = allSales.filter(r => r.status === "pending").reduce((s, r) => s + Number(r.commission_earned || 0), 0);
  const paid_earned    = allSales.filter(r => r.status === "paid").reduce((s, r) => s + Number(r.commission_earned || 0), 0);

  const cc = clicks_count ?? 0;
  const conversion_rate = cc > 0 ? Math.round((allSales.length / cc) * 100) : null;

  return NextResponse.json({
    ok: true,
    marketer: {
      name: marketer.name,
      code: marketer.code,
      commission_type: marketer.commission_type,
      commission_value: marketer.commission_value,
      member_since: marketer.created_at,
    },
    stats: {
      sales_count: allSales.length,
      total_earned,
      pending_earned,
      paid_earned,
      clicks_count: cc,
      conversion_rate,
    },
    sales: allSales.map(s => ({
      id: s.id,
      order_amount: s.order_amount,
      commission_earned: s.commission_earned,
      status: s.status,
      customer_name: s.customer_name,
      created_at: s.created_at,
      paid_at: s.paid_at,
    })),
    _debug: sErr ? { sales_error: sErr.message } : undefined,
  });
}
