import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/admin-auth";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const TWITTER_ACCOUNTS = [
  "cvcv0789",
  "BarqJobs",
  "sjn800",
  "Acct_Jobs",
  "m_alwahebi",
  "mnor3990",
  "wazaeef",
];

const NITTER_INSTANCES = [
  "https://nitter.poast.org",
  "https://nitter.privacydev.net",
  "https://nitter.1d4.us",
  "https://nitter.cz",
];

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractEmails(text: string): string[] {
  return text.match(EMAIL_RE) || [];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tweetUid(account: string, text: string): string {
  const crypto = require("crypto");
  return crypto.createHash("md5").update(`${account}:${text.slice(0, 200)}`).digest("hex");
}

async function fetchNitterRSS(account: string): Promise<{ text: string; link: string; uid: string }[]> {
  for (const instance of NITTER_INSTANCES) {
    try {
      const res = await fetch(`${instance}/${account}/rss`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items: { text: string; link: string; uid: string }[] = [];
      const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
      for (const m of itemMatches) {
        const block = m[1];
        const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/))?.[1] || "";
        const desc = (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || block.match(/<description>(.*?)<\/description>/))?.[1] || "";
        const link = (block.match(/<link>(.*?)<\/link>/))?.[1] || "";
        const clean = stripHtml(`${title}\n${desc}`);
        items.push({ text: clean, link, uid: tweetUid(account, clean) });
      }
      return items.slice(0, 20);
    } catch {
      continue;
    }
  }
  return [];
}

async function extractJobWithGemini(text: string, link: string): Promise<Record<string, string> | null> {
  if (!GEMINI_KEY) return null;
  const prompt = `أنت نظام استخراج بيانات وظائف. اقرأ التغريدة وحدّد إذا كانت تحتوي على إعلان وظيفة.
إذا كانت وظيفة، أرجع JSON فقط:
{"is_job":true,"title_ar":"المسمى","company":"الشركة أو فارغ","description_ar":"الوصف","application_email":"الإيميل أو null","specializations":"5 كلمات مفصولة بفاصلة"}
إذا لم تكن وظيفة: {"is_job":false}

التغريدة:
${text.slice(0, 700)}
الرابط: ${link}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } }),
        signal: AbortSignal.timeout(15000),
      }
    );
    const data = await r.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const result = JSON.parse(match[0]);
    if (!result.is_job) return null;
    if (!result.application_email) {
      const emails = extractEmails(text);
      result.application_email = emails[0] || null;
    }
    return result;
  } catch {
    return null;
  }
}

async function jobExists(uid: string): Promise<boolean> {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_jobs?tweet_uid=eq.${uid}&select=id&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await r.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function saveJob(job: Record<string, string>, uid: string, account: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_jobs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        title_ar: (job.title_ar || "").slice(0, 255),
        company: (job.company || "").slice(0, 200),
        description_ar: (job.description_ar || "").slice(0, 3000),
        application_email: job.application_email || null,
        specializations: (job.specializations || "").slice(0, 500),
        is_active: true,
        tweet_uid: uid,
        source_account: account,
        created_at: new Date().toISOString(),
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST() {
  const _denied_ = enforcePermission("jobs");
  if (_denied_) return _denied_;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ ok: false, error: "إعدادات Supabase غير مضبوطة" }, { status: 500 });
  }

  const stats = { total: 0, inserted: 0, skipped: 0, no_job: 0 };

  for (const account of TWITTER_ACCOUNTS) {
    const tweets = await fetchNitterRSS(account);
    for (const tweet of tweets) {
      stats.total++;
      if (await jobExists(tweet.uid)) { stats.skipped++; continue; }
      const job = await extractJobWithGemini(tweet.text, tweet.link);
      if (!job || !job.title_ar?.trim()) { stats.no_job++; continue; }
      const saved = await saveJob(job, tweet.uid, account);
      if (saved) stats.inserted++;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  return NextResponse.json({ ok: true, ...stats });
}
