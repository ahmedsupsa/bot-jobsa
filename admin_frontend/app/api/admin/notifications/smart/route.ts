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

// ── Segment definitions ───────────────────────────────────────────────────────

export type Segment = "no_email" | "no_cv" | "expired" | "expiring" | "achievement" | "all";

const SEGMENT_TEMPLATES: Record<Segment, { title: (name: string, extra?: string) => string; body: string; url: string }> = {
  no_email: {
    title: (name) => `باقي خطوة يا ${name} 👀`,
    body: "اربط إيميلك عشان نبدأ نقدم لك وظائف تلقائياً بدون تدخل",
    url: "/portal/settings",
  },
  no_cv: {
    title: (name) => `جاهز نقدم لك؟ 🔥`,
    body: "ارفع سيرتك الذاتية وخلي البوت يقدم لك وظائف كل 30 دقيقة",
    url: "/portal/cv",
  },
  expired: {
    title: (name) => `وينك يا ${name}؟ 😅`,
    body: "اشتراكك انتهى — جدّده الآن وابدأ التقديم التلقائي من جديد",
    url: "/portal/dashboard",
  },
  expiring: {
    title: (name) => `اشتراكك ينتهي قريباً يا ${name} ⏳`,
    body: "جدّد اشتراكك الآن واستمر في التقديم التلقائي",
    url: "/portal/dashboard",
  },
  achievement: {
    title: (name, count) => `تم التقديم على ${count ?? "عدة"} وظائف اليوم 🚀`,
    body: "تابع إيميلك لأي رد من الشركات — البوت شغّال لأجلك",
    url: "/portal/applications",
  },
  all: {
    title: (name) => `مرحباً يا ${name} 👋`,
    body: "لديك تحديثات جديدة على Jobbots",
    url: "/portal/dashboard",
  },
};

// ── Data fetching ─────────────────────────────────────────────────────────────

async function buildUserMap(userIds: string[]) {
  if (!userIds.length) return {};

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000).toISOString();
  const threeDays  = new Date(now.getTime() + 3 * 86400000).toISOString();

  const [usersRes, settingsRes, cvsRes, appsRes] = await Promise.all([
    supabase.from("users").select("id,full_name,subscription_ends_at").in("id", userIds),
    supabase.from("user_settings").select("user_id,email").in("user_id", userIds),
    supabase.from("user_cvs").select("user_id").in("user_id", userIds),
    supabase.from("applications").select("user_id,applied_at").in("user_id", userIds).gte("applied_at", yesterday),
  ]);

  const settingsMap: Record<string, string> = {};
  for (const s of settingsRes.data ?? []) settingsMap[s.user_id] = s.email || "";

  const cvsSet = new Set((cvsRes.data ?? []).map((c: any) => c.user_id));

  const appsCountMap: Record<string, number> = {};
  for (const a of appsRes.data ?? []) {
    appsCountMap[a.user_id] = (appsCountMap[a.user_id] || 0) + 1;
  }

  const map: Record<string, UserData> = {};

  for (const u of usersRes.data ?? []) {
    const ends = u.subscription_ends_at ? new Date(u.subscription_ends_at) : null;
    const is_active  = !!ends && ends > now;
    const is_expiring = !!ends && ends > now && ends <= new Date(threeDays);
    map[u.id] = {
      full_name: u.full_name || "مستخدم",
      subscription_ends_at: u.subscription_ends_at,
      email: settingsMap[u.id] || "",
      has_cv: cvsSet.has(u.id),
      today_applications: appsCountMap[u.id] || 0,
      is_active,
      is_expiring,
    };
  }

  return map;
}

function firstNameOf(fullName: string): string {
  return (fullName || "").split(" ")[0] || "مستخدم";
}

type UserData = {
  full_name: string;
  subscription_ends_at: string | null;
  email: string;
  has_cv: boolean;
  today_applications: number;
  is_active: boolean;
  is_expiring: boolean;
};

function matchesSegment(user: UserData | undefined, segment: Segment): boolean {
  if (!user) return false;
  switch (segment) {
    case "no_email":  return user.is_active && !user.email;
    case "no_cv":     return user.is_active && !user.has_cv;
    case "expired":   return !user.is_active;
    case "expiring":  return user.is_expiring;
    case "achievement": return user.today_applications > 0;
    case "all":       return true;
    default:          return false;
  }
}

// ── GET — segment counts ──────────────────────────────────────────────────────

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();

  const { data: subs } = await supabase.from("push_subscriptions").select("user_id");
  if (!subs?.length) {
    return NextResponse.json({ ok: true, counts: { no_email: 0, no_cv: 0, expired: 0, expiring: 0, achievement: 0, all: 0 } });
  }

  const userIds = [...new Set(subs.map((s: any) => s.user_id))];
  const userMap = await buildUserMap(userIds);

  const segments: Segment[] = ["no_email", "no_cv", "expired", "expiring", "achievement", "all"];
  const counts: Record<string, number> = {};
  for (const seg of segments) {
    counts[seg] = userIds.filter(id => matchesSegment(userMap[id], seg)).length;
  }

  return NextResponse.json({ ok: true, counts });
}

// ── POST — send smart notification ───────────────────────────────────────────

export async function POST(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const { segment, customTitle, customBody, customUrl } = body as {
    segment: Segment;
    customTitle?: string;
    customBody?: string;
    customUrl?: string;
  };

  if (!segment) return NextResponse.json({ error: "segment مطلوب" }, { status: 400 });

  const { data: subs } = await supabase.from("push_subscriptions").select("user_id,subscription");
  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0, failed: 0, targeted: 0 });

  const userIds = [...new Set(subs.map((s: any) => s.user_id))];
  const userMap = await buildUserMap(userIds);

  const tpl = SEGMENT_TEMPLATES[segment];
  const staleEndpoints: string[] = [];

  initVapid();

  let sent = 0, failed = 0, targeted = 0;

  await Promise.allSettled(
    subs.map(async (row: any) => {
      const user = userMap[row.user_id];
      if (!matchesSegment(user, segment)) return;

      targeted++;
      const firstName = firstNameOf(user?.full_name || "");
      const extra = segment === "achievement" ? String(user?.today_applications || "") : undefined;

      const title = customTitle?.replace("{name}", firstName) || tpl.title(firstName, extra);
      const notifBody = customBody || tpl.body;
      const url = customUrl || tpl.url;

      const payload = JSON.stringify({ title, body: notifBody, url });

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

  if (staleEndpoints.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return NextResponse.json({ ok: true, sent, failed, targeted });
}
