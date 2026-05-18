import { NextResponse } from "next/server";
import { geminiText } from "@/lib/gemini";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// ── استخراج الوظائف بـ Gemini ──────────────────────────────────────────────
async function extractJobs(text: string): Promise<Record<string, string>[]> {
  if (!process.env.GEMINI_API_KEY) return [];

  const prompt = `أنت نظام استخراج وظائف محترف متخصص في السوق السعودي.

النص التالي جاء من قناة Telegram للوظائف. 
حلّل النص وأرجع **فقط** إعلانات الوظائف الموجودة فيه كـ JSON array.

لكل وظيفة:
{
  "title_ar": "المسمى الوظيفي بالعربية",
  "company": "اسم الشركة أو المؤسسة (فارغ إن لم يُذكر)",
  "description_ar": "وصف الوظيفة والمتطلبات كاملاً",
  "application_email": "البريد الإلكتروني للتقديم أو null",
  "specializations": "5 كلمات مفتاحية مفصولة بفاصلة",
  "link_url": "رابط التقديم أو null"
}

إذا لم يكن النص يحتوي على إعلان وظيفة حقيقية أرجع: []
أرجع JSON فقط بدون أي نص إضافي.

النص:
${text.slice(0, 3000)}`;

  try {
    const raw = await geminiText(prompt, { temperature: 0.1 });
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const jobs = JSON.parse(match[0]);
    return Array.isArray(jobs) ? jobs : [];
  } catch {
    return [];
  }
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
async function saveJob(job: Record<string, string>, tweetUid: string, channelName: string): Promise<string | null> {
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
        is_active: true,
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
      // إرسال إشعار Telegram
      await sendTelegram(
        `💼 <b>وظيفة جديدة من Telegram</b>\n` +
        `📢 القناة: ${channelTitle}\n` +
        `🏷️ المسمى: ${job.title_ar}\n` +
        `🏢 الشركة: ${job.company || "—"}\n` +
        `📧 البريد: ${job.application_email || "—"}\n` +
        `🔗 رابط: ${job.link_url || "—"}\n` +
        `🕐 ${new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}`
      );
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
