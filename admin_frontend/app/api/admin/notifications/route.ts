import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";
import webpush from "web-push";

export const dynamic = "force-dynamic";

function initVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@jobbots.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY || ""
  );
}

export async function POST(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const { title, body: msgBody, url } = body;

  if (!title || !msgBody) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("subscription");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, message: "لا يوجد مشتركين في الإشعارات بعد" });
  }

  initVapid();

  const payload = JSON.stringify({ title, body: msgBody, url: url || "/portal/dashboard" });

  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        const sub = JSON.parse(row.subscription);
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (e: any) {
        failed++;
        if (e.statusCode === 410 || e.statusCode === 404) {
          staleEndpoints.push(JSON.parse(row.subscription).endpoint);
        }
      }
    })
  );

  if (staleEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", staleEndpoints);
  }

  return NextResponse.json({ ok: true, sent, failed });
}

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { count } = await supabase
    .from("push_subscriptions")
    .select("*", { count: "exact", head: true });
  return NextResponse.json({ ok: true, subscribers: count || 0 });
}
