import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const [userRes, spinsRes, withdrawalsRes] = await Promise.all([
    supabase.from("users").select("pending_spins, reward_balance, subscription_ends_at").eq("id", uid).single(),
    supabase.from("spin_rewards").select("id,amount,status,spun_at").eq("user_id", uid).order("spun_at", { ascending: false }).limit(50),
    supabase.from("reward_withdrawals").select("id,amount,method,status,admin_notes,proof_url,created_at,processed_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
  ]);

  const user = userRes.data;
  const spins = spinsRes.data || [];
  const withdrawals = withdrawalsRes.data || [];

  // حساب الرصيد المتاح (غير المسحوب)
  const available_balance = Number(user?.reward_balance ?? 0);
  const pending_spins = Number(user?.pending_spins ?? 0);

  // هل الاشتراك بـ 90 ريال أو أكثر؟ (لا نتحقق من السعر هنا — فقط نتحقق من وجود اشتراك نشط)
  const subscription_active = user?.subscription_ends_at
    ? new Date(user.subscription_ends_at).getTime() > Date.now()
    : false;

  return NextResponse.json({
    ok: true,
    pending_spins,
    available_balance,
    subscription_active,
    spins,
    withdrawals,
  });
}
