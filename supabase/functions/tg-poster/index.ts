// Supabase Edge Function — tg-poster
// ينشر وظيفة واحدة معلّقة إلى قناة @jobbotssa عبر Bot API
// يُشغَّل كل 10 دقائق بـ pg_cron — مستقل تماماً عن Replit

const SUPABASE_URL  = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN     = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const JOB_CHANNEL   = Deno.env.get("TELEGRAM_JOB_CHANNEL_ID") ?? "";
const WORKER_SECRET = Deno.env.get("WORKER_SECRET") ?? "";
const DAILY_LIMIT   = 30;

// كل كم وظيفة تُرسل رسالة تسويقية
const PROMO_EVERY = 5;

const SB = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// ─── الرسائل التسويقية المتنوعة ──────────────────────────────────────────

const PROMO_MESSAGES = [
  `💡 <b>هل تعلم؟</b>

أصحاب العمل يفضّلون المتقدمين الأوائل.
مع <b>Jobbots</b> يتقدم البوت عنك فور نزول الوظيفة — حتى وأنت نايم! 😴

🔗 جرّبه الآن: https://www.jobbots.org/store`,

  `⏱️ <b>وقتك ثمين</b>

التقديم اليدوي على 10 وظائف = ساعات من الوقت الضائع.
<b>Jobbots</b> يقدّم على عشرات الوظائف في دقائق برسالة تغطية مخصصة لكل وظيفة.

🚀 ابدأ الآن: https://www.jobbots.org/store`,

  `🤖 <b>ذكاء اصطناعي في خدمة مسيرتك المهنية</b>

<b>Jobbots</b> يقرأ سيرتك الذاتية، يفهم مهاراتك، ويكتب رسالة تغطية احترافية لكل وظيفة.
لا نسخ، لا لصق — كل تقديم فريد.

✨ https://www.jobbots.org/store`,

  `📊 <b>إحصائية مثيرة</b>

80% من الوظائف تُشغَل قبل أن يرى معظم الناس الإعلان.
<b>Jobbots</b> يضمن أنك دائماً من الأوائل.

⚡ سجّل الآن: https://www.jobbots.org/store`,

  `🎯 <b>تقديم ذكي، نتائج أفضل</b>

البوت يطابق مهاراتك مع متطلبات الوظيفة ويقدّم فقط على المناسب لك.
لا تضييع وقت، لا تقديمات عشوائية.

💼 https://www.jobbots.org/store`,

  `🔔 <b>لا تفوّت أي فرصة</b>

هذه القناة تجمع وظائف من عشرات المصادر يومياً.
اشترك في <b>Jobbots</b> والبوت يقدّم عنك على كل وظيفة تناسبك — تلقائياً.

👆 https://www.jobbots.org/store`,

  `💼 <b>باحث عن عمل؟</b>

مئات المتقدمين ينافسونك على نفس الوظيفة.
<b>Jobbots</b> يعطيك أفضلية التقديم المبكر والرسالة الاحترافية المخصصة.

🏆 ميّز نفسك: https://www.jobbots.org/store`,

  `✅ <b>بسيط وسريع</b>

١. ارفع سيرتك الذاتية
٢. حدّد تخصصاتك
٣. البوت يتولى الباقي 🤖

<b>Jobbots</b> — التقديم التلقائي الأذكى في السوق السعودي.
https://www.jobbots.org/store`,
];

function getPromoMessage(index: number): string {
  return PROMO_MESSAGES[index % PROMO_MESSAGES.length];
}

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

// ─── إرسال رسالة للقناة (وظيفة أو تسويقية) ─────────────────────────────

async function sendToChannel(text: string): Promise<number | null> {
  if (!BOT_TOKEN || !JOB_CHANNEL) return null;

  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: JOB_CHANNEL,
      text,
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
  const auth = req.headers.get("Authorization") ?? "";
  if (WORKER_SECRET && auth !== `Bearer ${WORKER_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (!BOT_TOKEN || !JOB_CHANNEL) {
    return new Response(JSON.stringify({ error: "BOT_TOKEN أو JOB_CHANNEL غير مضبوط" }), { status: 500 });
  }

  try {
    const todayCount = await countTodayPosts();

    // التحقق من الحد اليومي
    if (todayCount >= DAILY_LIMIT) {
      return new Response(JSON.stringify({
        ok: true,
        skipped: true,
        reason: `وصلنا الحد اليومي (${todayCount}/${DAILY_LIMIT})`,
      }));
    }

    // ── رسالة تسويقية كل PROMO_EVERY وظيفة ──────────────────────────────
    // todayCount = 5, 10, 15 … → أرسل رسالة تسويقية قبل الوظيفة التالية
    if (todayCount > 0 && todayCount % PROMO_EVERY === 0) {
      const promoIndex = Math.floor(todayCount / PROMO_EVERY) - 1;
      const promoText  = getPromoMessage(promoIndex);
      await sendToChannel(promoText);
      // الرسالة التسويقية لا تُحسب ضمن الوظائف — نكمل ونحسب الوظيفة أيضاً
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
    const msgId = await sendToChannel(buildPostText(job));
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
      promo_sent: todayCount > 0 && todayCount % PROMO_EVERY === 0,
    }));

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  }
});
