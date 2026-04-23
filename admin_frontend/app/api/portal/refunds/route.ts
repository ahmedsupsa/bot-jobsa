import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUser(req: Request) {
  const token = extractToken(req);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const supabase = freshClient();
  const { data } = await supabase.from("users").select("id, email").eq("id", payload.user_id).maybeSingle();
  return data;
}

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });
  const supabase = freshClient();

  const { data, error } = await supabase
    .from("store_orders")
    .select("id, status, amount, paid_at, created_at, payment_gateway, refund_status, refund_reason, refund_admin_notes, refund_requested_at, refund_processed_at, store_products(name, duration_days)")
    .eq("user_email", (user.email || "").toLowerCase())
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, orders: data || [] });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const order_id = body.order_id;
  const reason = (body.reason || "").trim();
  if (!order_id || !reason) {
    return NextResponse.json({ ok: false, error: "رقم الطلب وسبب الاسترجاع مطلوبان" }, { status: 400 });
  }
  if (reason.length < 10) {
    return NextResponse.json({ ok: false, error: "اشرح السبب بشكل أوضح (10 أحرف على الأقل)" }, { status: 400 });
  }

  const supabase = freshClient();
  const { data: order } = await supabase
    .from("store_orders")
    .select("id, status, refund_status, user_email")
    .eq("id", order_id)
    .maybeSingle();

  if (!order) return NextResponse.json({ ok: false, error: "الطلب غير موجود" }, { status: 404 });
  if ((order.user_email || "").toLowerCase() !== (user.email || "").toLowerCase()) {
    return NextResponse.json({ ok: false, error: "الطلب لا يخصك" }, { status: 403 });
  }
  if (order.status !== "paid") {
    return NextResponse.json({ ok: false, error: "لا يمكن طلب استرجاع لطلب غير مدفوع" }, { status: 400 });
  }
  if (order.refund_status && order.refund_status !== "rejected") {
    return NextResponse.json({ ok: false, error: "يوجد طلب استرجاع سابق على هذا الطلب" }, { status: 400 });
  }

  const { error } = await supabase
    .from("store_orders")
    .update({
      refund_status: "requested",
      refund_reason: reason,
      refund_requested_at: new Date().toISOString(),
      refund_admin_notes: null,
      refund_processed_at: null,
      refund_method: null,
    })
    .eq("id", order_id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
