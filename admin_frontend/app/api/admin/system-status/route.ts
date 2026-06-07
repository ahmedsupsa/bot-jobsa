import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

async function checkTelegram(): Promise<{ ok: boolean; botName?: string; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN غير مضبوط" };
  if (!chatId) return { ok: false, error: "TELEGRAM_CHAT_ID غير مضبوط" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    if (d.ok) return { ok: true, botName: d.result?.username };
    return { ok: false, error: d.description };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function checkSupabase(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  try {
    const t0 = Date.now();
    const { error } = await supabase.from("users").select("id", { count: "exact", head: true });
    const latencyMs = Date.now() - t0;
    if (error) return { ok: false, error: error.message };
    return { ok: true, latencyMs };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function checkResend(): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY غير مضبوط" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    return { ok: r.status !== 401 && r.status !== 403 };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function checkGemini(): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "GEMINI_API_KEY غير مضبوط" };
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      { signal: AbortSignal.timeout(5000) }
    );
    return { ok: r.ok };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7);

  const [
    supabaseStatus,
    telegramStatus,
    resendStatus,
    geminiStatus,

    { count: usersTotal },
    { count: usersActive },
    { count: usersWithCv },
    { count: usersWithSmtp },
    { count: usersWithPrefs },

    { count: jobsTotal },
    { count: jobsActive },

    { count: appsToday },
    { count: appsWeek },
    { count: appsTotal },

    { count: ordersTotal },
    { count: ordersPaid },
    { count: ordersPending },
    { count: ordersFailed },

    { count: supportUnread },
    { count: pushSubs },
    { count: codesTotal },
    { count: codesUsed },

    { data: lastWorkerLogs },
    { data: lastApps },
  ] = await Promise.all([
    checkSupabase(),
    checkTelegram(),
    checkResend(),
    checkGemini(),

    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }).gte("subscription_ends_at", now.toISOString()),
    supabase.from("user_cvs").select("user_id", { count: "exact", head: true }),
    supabase.from("user_settings").select("user_id", { count: "exact", head: true }).not("smtp_host", "is", null),
    supabase.from("user_job_preferences").select("user_id", { count: "exact", head: true }),

    supabase.from("admin_jobs").select("id", { count: "exact", head: true }),
    supabase.from("admin_jobs").select("id", { count: "exact", head: true }).eq("is_active", true),

    supabase.from("applications").select("id", { count: "exact", head: true }).gte("applied_at", todayStart.toISOString()),
    supabase.from("applications").select("id", { count: "exact", head: true }).gte("applied_at", weekStart.toISOString()),
    supabase.from("applications").select("id", { count: "exact", head: true }),

    supabase.from("store_orders").select("id", { count: "exact", head: true }),
    supabase.from("store_orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabase.from("store_orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("store_orders").select("id", { count: "exact", head: true }).eq("status", "failed"),

    supabase.from("support_messages").select("id", { count: "exact", head: true }).eq("sender", "user").is("read_at", null),
    supabase.from("push_subscriptions").select("user_id", { count: "exact", head: true }),
    supabase.from("activation_codes").select("id", { count: "exact", head: true }),
    supabase.from("activation_codes").select("id", { count: "exact", head: true }).not("used_at", "is", null),

    supabase.from("worker_logs").select("*").order("ran_at", { ascending: false }).limit(5),
    supabase.from("applications").select("applied_at").order("applied_at", { ascending: false }).limit(1),
  ]);

  const lastWorker = lastWorkerLogs?.[0] || null;
  const lastWorkerMinutesAgo = lastWorker?.ran_at
    ? Math.floor((Date.now() - new Date(lastWorker.ran_at).getTime()) / 60000)
    : null;

  const lastAppAt = lastApps?.[0]?.applied_at || null;
  const lastAppMinutesAgo = lastAppAt
    ? Math.floor((Date.now() - new Date(lastAppAt).getTime()) / 60000)
    : null;

  const workerHistory = (lastWorkerLogs || []).map((l: any) => ({
    ran_at: l.ran_at,
    status: l.status,
    applied_count: l.applied_count,
    active_users: l.active_users,
    duration_ms: l.duration_ms,
    errors: typeof l.errors === "string" ? JSON.parse(l.errors || "[]") : (l.errors ?? []),
  }));

  return NextResponse.json({
    ok: true,
    checked_at: now.toISOString(),
    services: {
      supabase: supabaseStatus,
      telegram: telegramStatus,
      resend: resendStatus,
      gemini: geminiStatus,
    },
    users: {
      total: usersTotal || 0,
      active: usersActive || 0,
      with_cv: usersWithCv || 0,
      with_smtp: usersWithSmtp || 0,
      with_prefs: usersWithPrefs || 0,
    },
    jobs: {
      total: jobsTotal || 0,
      active: jobsActive || 0,
    },
    applications: {
      today: appsToday || 0,
      week: appsWeek || 0,
      total: appsTotal || 0,
      last_at: lastAppAt,
      last_minutes_ago: lastAppMinutesAgo,
    },
    orders: {
      total: ordersTotal || 0,
      paid: ordersPaid || 0,
      pending: ordersPending || 0,
      failed: ordersFailed || 0,
    },
    support: {
      unread: supportUnread || 0,
    },
    push: {
      subscriptions: pushSubs || 0,
    },
    codes: {
      total: codesTotal || 0,
      used: codesUsed || 0,
      available: (codesTotal || 0) - (codesUsed || 0),
    },
    worker: {
      last_ran_at: lastWorker?.ran_at || null,
      last_minutes_ago: lastWorkerMinutesAgo,
      last_status: lastWorker?.status || null,
      last_applied: lastWorker?.applied_count || 0,
      last_users: lastWorker?.active_users || 0,
      last_duration_ms: lastWorker?.duration_ms || 0,
      last_errors: workerHistory[0]?.errors || [],
      history: workerHistory,
    },
  });
}
