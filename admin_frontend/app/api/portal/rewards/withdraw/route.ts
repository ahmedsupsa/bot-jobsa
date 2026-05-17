import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MIN_WITHDRAWAL = 30; // ريال
const MAX_CASH_WITHDRAWAL = 999; // بدون حد علوي عملي

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 }); }

  const method = body.method as string;
  const details = body.details as Record<string, string> | undefined;

  if (!["bank", "wallet", "subscription_credit"].includes(method)) {
    return NextResponse.json({ error: "طريقة سحب غير صالحة" }, { status: 400 });
  }

  // جلب رصيد المستخدم
  const { data: user } = await supabase
    .from("users")
    .select("reward_balance, subscription_ends_at")
    .eq("id", uid)
    .single();

  const balance = Number(user?.reward_balance ?? 0);

  if (balance < MIN_WITHDRAWAL) {
    return NextResponse.json({
      error: `الحد الأدنى للسحب ${MIN_WITHDRAWAL} ريال — رصيدك الحالي ${balance.toFixed(2)} ريال`,
    }, { status: 400 });
  }

  // تحقق من عدم وجود طلب معلق
  const { count: pending } = await supabase
    .from("reward_withdrawals")
    .select("*", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("status", "pending");

  if ((pending ?? 0) > 0) {
    return NextResponse.json({ error: "لديك طلب سحب معلق بالفعل — انتظر معالجته أولاً" }, { status: 400 });
  }

  // إنشاء طلب السحب وتصفير الرصيد
  const [wRes, uRes] = await Promise.all([
    supabase.from("reward_withdrawals").insert({
      user_id: uid,
      amount: balance,
      method,
      details: details ?? null,
      status: "pending",
    }).select("id").single(),
    supabase.from("users").update({ reward_balance: 0 }).eq("id", uid),
    // تحديث حالة المكافآت المعلقة → مسحوبة
    supabase.from("spin_rewards")
      .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
      .eq("user_id", uid)
      .eq("status", "pending"),
  ]);

  if (uRes.error) return NextResponse.json({ error: uRes.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, withdrawal_id: wRes.data?.id, amount: balance });
}
