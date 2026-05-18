// Supabase Edge Function — tg-poster
// ينشر وظيفة واحدة معلّقة إلى قناة @jobbotssa عبر Bot API
// يُشغَّل كل 10 دقائق بـ pg_cron — مستقل تماماً عن Replit

const SUPABASE_URL  = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN     = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const JOB_CHANNEL   = Deno.env.get("TELEGRAM_JOB_CHANNEL_ID") ?? "";
const WORKER_SECRET = Deno.env.get("WORKER_SECRET") ?? "";
const DAILY_LIMIT   = 30;

const SB = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// ─── بناء نص منشور الوظيفة ────────────────────────────────────────────────

function buildPostText(job: Record<string, string>): string {
  const lines: string[] = [
    `🚀 <b>وظيفة جديدة — ${job.title_ar}</b>`,
    "",
  ];
  if (job.application_email) {
    lines.push("📧 <b>البريد الإلكتروني للتقديم:</b>", job.application_email, "");
  }
  lines.push(
    "🤖 <b>للتقديم التلقائي عبر الذكاء الاصطناعي — وفّر وقتك وقدّم على عشرات الوظائف بضغطة واحدة:</b>",
    "https://www.jobbots.org/store",
  );
  return lines.join("\n");
}

// ─── عدّ منشورات اليوم ────────────────────────────────────────────────────

async function countTodayPosts(): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const url = new URL(`${SUPABASE_URL}/rest/v1/admin_jobs`);
  url.searchParams.set("select", "id");
  url.searchParams.set("tg_message_id", "not.is.null");
  url.searchParams.set("tg_posted_at", `gte.${todayStart.toISOString()}`);

  const r = await fetch(url.toString(), {
    headers: { ...SB, Prefer: "count=exact" },
  });
  const range = r.headers.get("content-range") ?? "";
  const total = parseInt(range.split("/")[1] ?? "0", 10);
  return isNaN(total) ? 0 : total;
}

// ─── جلب وظيفة معلّقة ───────────────────────────────────────────────────

async function fetchPendingJob(): Promise<Record<string, string> | null> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/admin_jobs`);
  url.searchParams.set("tg_message_id", "is.null");
  url.searchParams.set("is_active", "eq.true");
  url.searchParams.set("select", "id,title_ar,description_ar,application_email");
  url.searchParams.set("order", "created_at.asc");
  url.searchParams.set("limit", "1");

  const r = await fetch(url.toString(), { headers: SB });
  if (!r.ok) return null;
  const data = await r.json() as Record<string, string>[];
  return data[0] ?? null;
}

// ─── نشر الوظيفة في القناة ──────────────────────────────────────────────

async function postToChannel(job: Record<string, string>): Promise<number | null> {
  if (!BOT_TOKEN || !JOB_CHANNEL) return null;

  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: JOB_CHANNEL,
      text: buildPostText(job),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const d = await r.json() as { ok: boolean; result?: { message_id: number } };
  return d.ok ? (d.result?.message_id ?? null) : null;
}

// ─── تحديث tg_message_id و tg_posted_at في DB ───────────────────────────

async function markPosted(jobId: string, msgId: number): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/admin_jobs?id=eq.${jobId}`, {
    method: "PATCH",
    headers: SB,
    body: JSON.stringify({
      tg_message_id: msgId,
      tg_posted_at: new Date().toISOString(),
    }),
  });
}

// ─── فلتر تمهير والتدريب التعاوني ───────────────────────────────────────

const TAMHEER_KW = ["تمهير", "tamheer", "تدريب تعاوني", "تعاوني", "cooperative training", "متدرب", "متدربة"];
function isTamheer(title: string): boolean {
  const t = title.toLowerCase();
  return TAMHEER_KW.some(kw => t.includes(kw));
}

async function deactivateJob(jobId: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/admin_jobs?id=eq.${jobId}`, {
    method: "PATCH",
    headers: SB,
    body: JSON.stringify({ is_active: false }),
  });
}

// ─── Handler الرئيسي ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // التحقق من الـ secret
  const auth = req.headers.get("Authorization") ?? "";
  if (WORKER_SECRET && auth !== `Bearer ${WORKER_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (!BOT_TOKEN || !JOB_CHANNEL) {
    return new Response(JSON.stringify({ error: "BOT_TOKEN أو JOB_CHANNEL غير مضبوط" }), { status: 500 });
  }

  try {
    // التحقق من الحد اليومي
    const todayCount = await countTodayPosts();
    if (todayCount >= DAILY_LIMIT) {
      return new Response(JSON.stringify({
        ok: true,
        skipped: true,
        reason: `وصلنا الحد اليومي (${todayCount}/${DAILY_LIMIT})`,
      }));
    }

    // جلب وظيفة معلّقة
    const job = await fetchPendingJob();
    if (!job) {
      return new Response(JSON.stringify({
        ok: true,
        skipped: true,
        reason: "لا توجد وظائف منتظرة للنشر",
      }));
    }

    // فلتر تمهير — تعطيل بدون نشر
    if (isTamheer(job.title_ar ?? "")) {
      await deactivateJob(job.id);
      return new Response(JSON.stringify({
        ok: true,
        skipped: true,
        reason: `وظيفة تمهير/تدريب — تم تعطيلها: ${job.title_ar}`,
      }));
    }

    // نشر الوظيفة
    const msgId = await postToChannel(job);
    if (!msgId) {
      return new Response(JSON.stringify({ ok: false, error: "فشل الإرسال لـ Telegram" }), { status: 500 });
    }

    await markPosted(job.id, msgId);

    return new Response(JSON.stringify({
      ok: true,
      posted: job.title_ar,
      msg_id: msgId,
      today: todayCount + 1,
      daily_limit: DAILY_LIMIT,
    }));

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  }
});
