import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ── جدول جوائز العجلة ──────────────────────────────────────────────────────
// الجوائز كلها بالريال السعودي
// بعد 180 يوم اشتراك: 10 ريال ممكنة
// الباقي: 0.05 إلى 2 ريال
// التوزيع الاحتمالي:
const PRIZE_TABLE = [
  { amount: 0.05,  weight: 25 },  // 5 هللات   — 25%
  { amount: 0.10,  weight: 22 },  // 10 هللات  — 22%
  { amount: 0.25,  weight: 18 },  // 25 هللات  — 18%
  { amount: 0.50,  weight: 14 },  // 50 هللات  — 14%
  { amount: 1.00,  weight: 10 },  // 1 ريال    — 10%
  { amount: 1.50,  weight:  5 },  // 1.5 ريال  —  5%
  { amount: 2.00,  weight:  4 },  // 2 ريال    —  4%
  { amount: 5.00,  weight:  1.5 },// 5 ريالات  — 1.5%
  { amount: 10.00, weight:  0.5 },// 10 ريالات — 0.5% (بعد 180 يوم فقط)
];

function spinWheel(allowBig: boolean): number {
  const table = allowBig ? PRIZE_TABLE : PRIZE_TABLE.filter(p => p.amount < 10);
  const total = table.reduce((s, p) => s + p.weight, 0);
  let rand = Math.random() * total;
  for (const p of table) {
    rand -= p.weight;
    if (rand <= 0) return p.amount;
  }
  return table[0].amount;
}

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  // جلب بيانات المستخدم
  const { data: user, error: uErr } = await supabase
    .from("users")
    .select("pending_spins, reward_balance, subscription_ends_at, created_at")
    .eq("id", uid)
    .single();

  if (uErr || !user) return NextResponse.json({ error: "لم يُعثر على المستخدم" }, { status: 404 });

  if ((user.pending_spins ?? 0) <= 0) {
    return NextResponse.json({ ok: false, error: "لا توجد نقرات متاحة — في انتظار تقديمات جديدة" }, { status: 400 });
  }

  // هل المستخدم مشترك منذ 180+ يوم؟
  const daysSinceJoin = user.created_at
    ? (Date.now() - new Date(user.created_at).getTime()) / 86400000
    : 0;
  const allowBigPrize = daysSinceJoin >= 180;

  // هل الاشتراك نشط؟
  const subscriptionActive = user.subscription_ends_at
    ? new Date(user.subscription_ends_at).getTime() > Date.now()
    : false;

  if (!subscriptionActive) {
    return NextResponse.json({ ok: false, error: "يجب أن يكون اشتراكك نشطاً لتشغيل العجلة" }, { status: 403 });
  }

  const amount = spinWheel(allowBigPrize);
  const new_balance = Number((Number(user.reward_balance ?? 0) + amount).toFixed(2));
  const new_spins = Math.max(0, (user.pending_spins ?? 0) - 1);

  // تسجيل الجائزة وتحديث الرصيد
  const [insertRes, updateRes] = await Promise.all([
    supabase.from("spin_rewards").insert({
      user_id: uid,
      amount,
      status: "pending",
    }).select("id").single(),
    supabase.from("users").update({
      pending_spins: new_spins,
      reward_balance: new_balance,
    }).eq("id", uid),
  ]);

  if (updateRes.error) {
    return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    amount,
    new_balance,
    pending_spins: new_spins,
    spin_id: insertRes.data?.id,
    big_prize_eligible: allowBigPrize,
  });
}
