import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

function initVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@jobbots.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY || ""
  );
}

// Internal endpoint — secured by WORKER_SECRET
// Called by Supabase Edge Function worker after each successful cycle

export async function POST(req: Request) {
  const secret = process.env.WORKER_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const { results } = body as { results: Array<{ user_id: string; name: string; applied_count: number }> };

  if (!results?.length) return NextResponse.json({ ok: true, sent: 0 });

  const userIds = results.map(r => r.user_id);
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id,subscription")
    .in("user_id", userIds);

  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 });

  initVapid();

  const subMap: Record<string, string> = {};
  for (const s of subs) subMap[s.user_id] = s.subscription;

  const staleEndpoints: string[] = [];
  let sent = 0;

  await Promise.allSettled(
    results.map(async ({ user_id, name, applied_count }) => {
      const subRaw = subMap[user_id];
      if (!subRaw) return;

      const firstName = (name || "").split(" ")[0] || "مستخدم";
      const count = applied_count;

      const payload = JSON.stringify({
        title: `تم التقديم على ${count} ${count === 1 ? "وظيفة" : "وظائف"} اليوم 🚀`,
        body: `تابع إيميلك يا ${firstName} لأي رد من الشركات — البوت شغّال لأجلك`,
        url: "/portal/applications",
      });

      try {
        const sub = JSON.parse(subRaw);
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (e: any) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          staleEndpoints.push(JSON.parse(subRaw).endpoint);
        }
      }
    })
  );

  if (staleEndpoints.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return NextResponse.json({ ok: true, sent });
}
