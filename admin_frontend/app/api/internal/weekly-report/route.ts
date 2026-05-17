import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

const RESEND_API_KEY    = process.env.RESEND_API_KEY    || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const RESEND_FROM_NAME  = process.env.RESEND_FROM_NAME  || "Jobbots";
const WORKER_SECRET     = process.env.WORKER_SECRET     || "";
const ADMIN_REPORT_EMAIL = process.env.ADMIN_REPORT_EMAIL || RESEND_FROM_EMAIL;

function isAuthorized(req: Request) {
  const secret = req.headers.get("x-worker-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === WORKER_SECRET && WORKER_SECRET !== "";
}

function buildReportHtml(data: {
  weekLabel: string;
  totalSent: number;
  totalSkipped: number;
  totalError: number;
  topUsers: { name: string; sent: number; skipped: number }[];
  topSkipReasons: { reason: string; count: number }[];
  topMatchedJobs: { title: string; count: number }[];
  dailyBreakdown: { day: string; sent: number; skipped: number; error: number }[];
}): string {
  const { weekLabel, totalSent, totalSkipped, totalError, topUsers, topSkipReasons, dailyBreakdown } = data;
  const total = totalSent + totalSkipped + totalError;
  const sendRate = total > 0 ? Math.round((totalSent / total) * 100) : 0;

  const topUsersRows = topUsers.map((u, i) =>
    `<tr style="background:${i % 2 === 0 ? "#f9f9f9" : "#fff"}">
      <td style="padding:10px 14px;font-weight:600;color:#1a1a2e">${i + 1}. ${u.name}</td>
      <td style="padding:10px 14px;text-align:center;color:#16a34a;font-weight:700">${u.sent}</td>
      <td style="padding:10px 14px;text-align:center;color:#d97706">${u.skipped}</td>
    </tr>`
  ).join("");

  const dailyRows = dailyBreakdown.map((d) =>
    `<tr>
      <td style="padding:8px 14px;color:#374151;font-weight:500">${d.day}</td>
      <td style="padding:8px 14px;text-align:center;color:#16a34a;font-weight:600">${d.sent}</td>
      <td style="padding:8px 14px;text-align:center;color:#d97706">${d.skipped}</td>
      <td style="padding:8px 14px;text-align:center;color:#dc2626">${d.error}</td>
    </tr>`
  ).join("");

  const skipReasonsHtml = topSkipReasons.slice(0, 5).map(r =>
    `<li style="margin-bottom:6px;color:#374151;font-size:13px">
      <span style="font-weight:600;color:#d97706">${r.count}x</span> — ${r.reason}
    </li>`
  ).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>التقرير الأسبوعي — Jobbots</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:36px 32px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">🤖</div>
      <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800">التقرير الأسبوعي</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px">${weekLabel}</p>
    </div>

    <!-- Big Numbers -->
    <div style="padding:28px 24px 8px">
      <div style="display:flex;gap:12px;text-align:center">
        <div style="flex:1;background:#f0fdf4;border-radius:12px;padding:20px 12px;border:1px solid #bbf7d0">
          <div style="font-size:36px;font-weight:800;color:#16a34a">${totalSent}</div>
          <div style="font-size:13px;color:#4ade80;margin-top:4px;font-weight:600">✅ تقديم ناجح</div>
        </div>
        <div style="flex:1;background:#fffbeb;border-radius:12px;padding:20px 12px;border:1px solid #fde68a">
          <div style="font-size:36px;font-weight:800;color:#d97706">${totalSkipped}</div>
          <div style="font-size:13px;color:#fbbf24;margin-top:4px;font-weight:600">⏭️ تجاوز AI</div>
        </div>
        <div style="flex:1;background:#fef2f2;border-radius:12px;padding:20px 12px;border:1px solid #fecaca">
          <div style="font-size:36px;font-weight:800;color:#dc2626">${totalError}</div>
          <div style="font-size:13px;color:#f87171;margin-top:4px;font-weight:600">❌ أخطاء</div>
        </div>
      </div>
      <div style="background:#f8faff;border-radius:12px;padding:16px;margin-top:12px;text-align:center;border:1px solid #e0e7ff">
        <span style="font-size:28px;font-weight:800;color:#4f46e5">${sendRate}%</span>
        <span style="font-size:14px;color:#6b7280;margin-right:8px">نسبة التقديم الفعلي من إجمالي ${total} فرصة</span>
      </div>
    </div>

    <!-- Top Users -->
    ${topUsers.length > 0 ? `
    <div style="padding:24px 24px 8px">
      <h2 style="font-size:17px;font-weight:700;color:#1a1a2e;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #e5e7eb">
        🏆 أكثر المستخدمين تقديماً
      </h2>
      <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
        <thead>
          <tr style="background:#4f46e5">
            <th style="padding:10px 14px;text-align:right;color:#fff;font-size:13px">المستخدم</th>
            <th style="padding:10px 14px;text-align:center;color:#fff;font-size:13px">تقديمات</th>
            <th style="padding:10px 14px;text-align:center;color:#fff;font-size:13px">متجاوز</th>
          </tr>
        </thead>
        <tbody>${topUsersRows}</tbody>
      </table>
    </div>` : ""}

    <!-- Daily Breakdown -->
    ${dailyBreakdown.length > 0 ? `
    <div style="padding:24px 24px 8px">
      <h2 style="font-size:17px;font-weight:700;color:#1a1a2e;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #e5e7eb">
        📅 التوزيع اليومي
      </h2>
      <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:9px 14px;text-align:right;color:#6b7280;font-size:12px;border-bottom:1px solid #e5e7eb">اليوم</th>
            <th style="padding:9px 14px;text-align:center;color:#16a34a;font-size:12px;border-bottom:1px solid #e5e7eb">أُرسل</th>
            <th style="padding:9px 14px;text-align:center;color:#d97706;font-size:12px;border-bottom:1px solid #e5e7eb">تجاوز</th>
            <th style="padding:9px 14px;text-align:center;color:#dc2626;font-size:12px;border-bottom:1px solid #e5e7eb">خطأ</th>
          </tr>
        </thead>
        <tbody>${dailyRows}</tbody>
      </table>
    </div>` : ""}

    <!-- Top Skip Reasons -->
    ${skipReasonsHtml ? `
    <div style="padding:24px 24px 8px">
      <h2 style="font-size:17px;font-weight:700;color:#1a1a2e;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #e5e7eb">
        🧠 أبرز أسباب رفض AI
      </h2>
      <ul style="margin:0;padding-right:20px;list-style:none">${skipReasonsHtml}</ul>
    </div>` : ""}

    <!-- Footer -->
    <div style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;margin-top:16px">
      <p style="margin:0;font-size:12px;color:#9ca3af">
        Jobbots — منصة التقديم التلقائي على الوظائف<br>
        هذا التقرير يُرسَل تلقائياً كل أسبوع
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !ADMIN_REPORT_EMAIL) {
    return NextResponse.json({ ok: false, error: "إعدادات Resend أو ADMIN_REPORT_EMAIL ناقصة" }, { status: 500 });
  }

  // نطاق آخر 7 أيام
  const now      = new Date();
  const weekAgo  = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const weekLabel = `${weekAgo.toLocaleDateString("ar-SA", { month: "long", day: "numeric" })} — ${now.toLocaleDateString("ar-SA", { month: "long", day: "numeric", year: "numeric" })}`;

  // جلب بيانات الأسبوع
  const { data: apps, error: appsErr } = await supabase
    .from("applications")
    .select("user_id,status,skip_reason,applied_at")
    .gte("applied_at", weekAgo.toISOString())
    .order("applied_at", { ascending: true });

  if (appsErr) return NextResponse.json({ ok: false, error: appsErr.message }, { status: 500 });

  const allApps = apps || [];
  const totalSent    = allApps.filter(a => a.status === "sent").length;
  const totalSkipped = allApps.filter(a => a.status === "skipped").length;
  const totalError   = allApps.filter(a => a.status === "error").length;

  // أكثر المستخدمين تقديماً
  const userStats = new Map<string, { sent: number; skipped: number }>();
  for (const a of allApps) {
    if (!a.user_id) continue;
    const s = userStats.get(a.user_id) || { sent: 0, skipped: 0 };
    if (a.status === "sent")    s.sent++;
    if (a.status === "skipped") s.skipped++;
    userStats.set(a.user_id, s);
  }

  const topUserIds = [...userStats.entries()]
    .sort((a, b) => b[1].sent - a[1].sent)
    .slice(0, 8)
    .map(([id]) => id);

  const { data: users } = topUserIds.length > 0
    ? await supabase.from("users").select("id,full_name").in("id", topUserIds)
    : { data: [] as any[] };

  const userNameMap = new Map((users || []).map((u: any) => [u.id, u.full_name]));
  const topUsers = [...userStats.entries()]
    .sort((a, b) => b[1].sent - a[1].sent)
    .slice(0, 8)
    .map(([id, s]) => ({ name: userNameMap.get(id) || "مجهول", ...s }))
    .filter(u => u.sent > 0 || u.skipped > 0);

  // أبرز أسباب الرفض
  const reasonCount = new Map<string, number>();
  for (const a of allApps) {
    if (a.status !== "skipped" || !a.skip_reason) continue;
    // نُلخّص السبب (أول 80 حرف)
    const key = a.skip_reason.slice(0, 80);
    reasonCount.set(key, (reasonCount.get(key) || 0) + 1);
  }
  const topSkipReasons = [...reasonCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  // التوزيع اليومي
  const dayMap = new Map<string, { sent: number; skipped: number; error: number }>();
  for (const a of allApps) {
    const day = new Date(a.applied_at).toLocaleDateString("ar-SA", {
      weekday: "long", month: "short", day: "numeric", timeZone: "Asia/Riyadh",
    });
    const s = dayMap.get(day) || { sent: 0, skipped: 0, error: 0 };
    if (a.status === "sent")    s.sent++;
    if (a.status === "skipped") s.skipped++;
    if (a.status === "error")   s.error++;
    dayMap.set(day, s);
  }
  const dailyBreakdown = [...dayMap.entries()].map(([day, s]) => ({ day, ...s }));

  const html = buildReportHtml({
    weekLabel, totalSent, totalSkipped, totalError,
    topUsers, topSkipReasons, topMatchedJobs: [], dailyBreakdown,
  });

  // إرسال عبر Resend
  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
      to: [ADMIN_REPORT_EMAIL],
      subject: `📊 التقرير الأسبوعي — Jobbots | ${totalSent} تقديم ناجح`,
      html,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.text();
    return NextResponse.json({ ok: false, error: `Resend فشل: ${err}` }, { status: 500 });
  }

  // تحديث آخر تقرير أُرسل
  await supabase.from("worker_status").update({ weekly_report_last_sent: new Date().toISOString() }).neq("id", "");

  return NextResponse.json({
    ok: true,
    stats: { totalSent, totalSkipped, totalError, topUsersCount: topUsers.length },
    sentTo: ADMIN_REPORT_EMAIL,
  });
}

// تريغر يدوي من الأدمن (GET مؤمَّن بـ cookie الأدمن)
export async function GET(req: Request) {
  const { enforcePermission } = await import("@/lib/admin-auth");
  const denied = enforcePermission("jobs");
  if (denied) return denied;

  // استدعاء نفس المنطق عبر POST داخلياً
  const fakeReq = new Request(req.url, {
    method: "POST",
    headers: { "x-worker-secret": WORKER_SECRET, "Content-Type": "application/json" },
  });
  return POST(fakeReq);
}
