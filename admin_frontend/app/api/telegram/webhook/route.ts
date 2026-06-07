import { NextResponse } from "next/server";
import { sendTelegram, postJobToChannel } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const JOB_KEYWORDS = [
  "مطلوب", "وظيفة", "وظائف", "توظيف", "نبحث عن", "نرحب بـ",
  "التقديم", "أرسل سيرتك", "السيرة الذاتية", "للتوظيف", "فرصة",
  "فرص", "شاغر", "شاغرة", "تعيين", " hiring", "job", "vacancy",
];

const JOB_TITLES = [
  "محاسب", "مهندس", "مبرمج", "مصمم", "محامي", "مدير", "أخصائي",
  "مشرف", "مسؤول", "منسق", "مندوب", "سكرتير", "موظف", "كاتب",
  "مطور", "فني", "طبيب", "ممرض", "معلم", "مدرس", "محاضر",
  "باحث", "محلل", "مستشار", "مراجع", "مدقق", "مفتش", "مراقب",
  "رئيس", "نائب", "مساعد", "أمين", "حارس", "سائق", "عامل",
];

const COMPANY_PREFIXES = ["شركة", "مؤسسة", "مجموعة", "بنك", "مكتب", "مستشفى", "جامعة"];

// ── استخراج الوظائف بدون ذكاء اصطناعي ──────────────────────────────────────
function extractJobs(text: string): Record<string, string | null>[] {
  const results: Record<string, string | null>[] = [];
  const lines = text.split(/\n+/).filter(l => l.trim());
  const emails = [...new Set(text.match(EMAIL_RE) || [])];

  for (const line of lines) {
    const lower = line.trim().toLowerCase();
    const hasKeyword = JOB_KEYWORDS.some(k => lower.includes(k));
    if (!hasKeyword) continue;

    let title = "";
    for (const t of JOB_TITLES) {
      const idx = lower.indexOf(t);
      if (idx !== -1) {
        // استخرج الجملة التي تحتوي المسمى
        const start = Math.max(0, idx - 15);
        const end = Math.min(text.length, idx + t.length + 30);
        const snippet = text.slice(start, end).trim();
        title = snippet.replace(/[،,].*$/, "").trim();
        break;
      }
    }
    if (!title) continue;

    let company = "";
    const lineWords = line.split(/\s+/);
    for (let i = 0; i < lineWords.length; i++) {
      const w = lineWords[i].replace(/[،,]/g, "");
      if (COMPANY_PREFIXES.includes(w) && i + 1 < lineWords.length) {
        company = `${w} ${lineWords[i + 1].replace(/[،,]/g, "").replace(/[.].*$/, "")}`;
        break;
      }
    }

    const email = emails[0] || null;

    // تحقق من عدم التكرار
    const dup = results.some(j => j.title_ar === title);
    if (!dup) {
      results.push({ title_ar: title, company, application_email: email, description_ar: line.trim() });
    }
  }

  return results;
}

// ── التحقق من التكرار ──────────────────────────────────────────────────────
async function jobExists(tweetUid: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_jobs?tweet_uid=eq.${encodeURIComponent(tweetUid)}&select=id&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await r.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

// ── حفظ وظيفة ─────────────────────────────────────────────────────────────
async function saveJob(job: Record<string, string | null>, tweetUid: string, channelName: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_jobs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        title_ar: job.title_ar?.trim() || "وظيفة من Telegram",
        company: job.company?.trim() || null,
        description_ar: job.description_ar?.trim() || null,
        application_email: job.application_email?.trim() || null,
        specializations: job.specializations?.trim() || null,
        link_url: job.link_url?.trim() || null,
        is_active: false,
        tweet_uid: tweetUid,
        source_account: channelName,
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.[0]?.id || null;
  } catch {
    return null;
  }
}

// ── MD5 بسيط للـ tweet_uid ─────────────────────────────────────────────────
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ── معالجة رسالة قناة ─────────────────────────────────────────────────────
async function handleChannelPost(post: Record<string, unknown>) {
  const text: string = (
    (post.text as string) ||
    (post.caption as string) ||
    ""
  ).trim();

  if (!text || text.length < 30) return; // رسائل قصيرة جداً — ليست وظائف

  const chat = post.chat as Record<string, unknown>;
  const channelTitle = String(chat?.title || chat?.username || "telegram_channel");
  const channelId = String(chat?.id || "");
  const msgId = String(post.message_id || "");
  const tweetUid = simpleHash(`${channelId}:${msgId}:${text.slice(0, 100)}`);

  // تحقق من التكرار
  if (await jobExists(tweetUid)) return;

  // استخراج الوظائف بـ Gemini
  const jobs = await extractJobs(text);
  if (jobs.length === 0) return;

  let saved = 0;
  for (const job of jobs) {
    if (!job.title_ar?.trim()) continue;

    // fallback للإيميل من النص المباشر
    if (!job.application_email) {
      const emails = text.match(EMAIL_RE);
      if (emails?.length) job.application_email = emails[0];
    }

    const id = await saveJob(job, tweetUid + `_${saved}`, channelTitle);
    if (id) {
      saved++;
      // إشعار الأدمن بانتظار المراجعة
      sendTelegram(
        `⏳ <b>وظيفة جديدة تنتظر المراجعة</b>\n` +
        `📢 القناة: ${channelTitle}\n` +
        `🏷️ المسمى: ${job.title_ar}\n` +
        `🏢 الشركة: ${job.company || "—"}\n` +
        `📧 البريد: ${job.application_email || "—"}\n` +
        `🕐 ${new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}`
      ).catch(() => {});
    }
  }
}

// ── Webhook Handler ────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // تحقق من Secret Token
  const secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (secret && process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // رسائل القنوات تأتي في channel_post
  const post = body.channel_post as Record<string, unknown> | undefined;
  if (post) {
    // نعالج بشكل async ونرجع 200 فوراً (Telegram يتوقع رد سريع)
    handleChannelPost(post).catch(e => console.error("[tg-webhook] error:", e));
  }

  return NextResponse.json({ ok: true });
}

// ── GET: صفحة الإعداد — لتسجيل الـ Webhook ───────────────────────────────
export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get("host")}`;
  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN غير مضبوط" }, { status: 500 });
  }

  if (action === "register") {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
    const body: Record<string, unknown> = { url: webhookUrl, allowed_updates: ["channel_post"] };
    if (secret) body.secret_token = secret;

    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return NextResponse.json({ ...data, webhook_url: webhookUrl });
  }

  if (action === "info") {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const data = await r.json();
    return NextResponse.json({ ...data, expected_url: webhookUrl });
  }

  if (action === "delete") {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
    const data = await r.json();
    return NextResponse.json(data);
  }

  return NextResponse.json({
    status: "Telegram Webhook endpoint",
    webhook_url: webhookUrl,
    actions: {
      register: `${webhookUrl}?action=register`,
      info:     `${webhookUrl}?action=info`,
      delete:   `${webhookUrl}?action=delete`,
    },
  });
}
