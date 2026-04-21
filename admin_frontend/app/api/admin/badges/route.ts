import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function safeCount(promise: Promise<{ count: number | null }>) {
  try {
    const { count } = await promise;
    return count || 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const sb = freshClient();
  const isSuper = session.isSuper;
  const perms: string[] = session.permissions || [];
  const can = (p: string) => isSuper || perms.includes(p);

  const tasks: Promise<unknown>[] = [];
  const result: Record<string, number> = {};

  // ── Support: unread user messages (sender=user AND read_at IS NULL)
  if (can("support")) {
    tasks.push(
      safeCount(
        sb.from("support_messages")
          .select("id", { count: "exact", head: true })
          .eq("sender", "user")
          .is("read_at", null) as unknown as Promise<{ count: number | null }>
      ).then(c => { result.support = c; })
    );
  }

  // ── Store: pending orders awaiting admin action
  if (can("store")) {
    tasks.push(
      safeCount(
        sb.from("store_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending") as unknown as Promise<{ count: number | null }>
      ).then(c => { result.store = c; })
    );
  }

  // ── Affiliate: pending withdrawal requests
  if (can("affiliate")) {
    tasks.push(
      safeCount(
        sb.from("affiliate_withdrawals")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending") as unknown as Promise<{ count: number | null }>
      ).then(c => { result.affiliate = c; })
    );
  }

  await Promise.all(tasks);
  return NextResponse.json({ ok: true, badges: result });
}
