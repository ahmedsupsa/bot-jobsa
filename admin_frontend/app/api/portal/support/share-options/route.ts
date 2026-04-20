import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUserId(req: Request): Promise<string | null> {
  const token = extractToken(req);
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.user_id || null;
}

export async function GET(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ ok: false, error: "غير مخوّل" }, { status: 401 });
  const supabase = freshClient();

  const [userRes, ordersRes, appsRes, settingsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, phone, subscription_ends_at, activation_code_id")
      .eq("id", uid)
      .single(),
    supabase
      .from("store_orders")
      .select("id, status, amount, plan_name, payment_method, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid),
    supabase
      .from("user_settings")
      .select("email")
      .eq("user_id", uid)
      .maybeSingle(),
  ]);

  const user = userRes.data || null;
  let activation: { id: string; code: string; subscription_days: number } | null = null;
  if (user?.activation_code_id) {
    const { data: c } = await supabase
      .from("activation_codes")
      .select("id, code, subscription_days")
      .eq("id", user.activation_code_id)
      .maybeSingle();
    if (c) activation = c;
  }

  // Try orders by email too if user_id wasn't on the order
  let orders = ordersRes.data || [];
  if (orders.length === 0 && settingsRes.data?.email) {
    const { data } = await supabase
      .from("store_orders")
      .select("id, status, amount, plan_name, payment_method, created_at")
      .eq("user_email", settingsRes.data.email)
      .order("created_at", { ascending: false })
      .limit(5);
    orders = data || [];
  }

  return NextResponse.json({
    ok: true,
    profile: user
      ? {
          full_name: user.full_name,
          phone: user.phone,
          email: settingsRes.data?.email || null,
          subscription_ends_at: user.subscription_ends_at,
        }
      : null,
    activation,
    orders,
    applications_count: appsRes.count || 0,
  });
}
