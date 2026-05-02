import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractEmails(text: string): string[] {
  return text.match(EMAIL_RE) || [];
}

async function extractJobsWithGemini(text: string): Promise<Record<string, string>[]> {
  if (!GEMINI_KEY) return [];

  const prompt = `أنت نظام استخراج وظائف محترف. النص التالي يحتوي على تغريدات من حسابات وظائف سعودية.

استخرج **كل** إعلانات الوظائف الموجودة في النص وأرجعها كـ JSON array.
لكل وظيفة:
{
  "title_ar": "المسمى الوظيفي بالعربي",
  "company": "اسم الشركة أو المؤسسة (فارغ إن لم يُذكر)",
  "description_ar": "وصف الوظيفة والمتطلبات",
  "application_email": "البريد الإلكتروني للتقديم (null إن لم يوجد)",
  "specializations": "5 كلمات مفتاحية مفصولة بفاصلة"
}

إذا لم تجد أي وظيفة أرجع: []
أرجع JSON فقط بدون أي نص إضافي.

النص:
${text.slice(0, 4000)}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );
    const data = await r.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const jobs = JSON.parse(match[0]);
    return Array.isArray(jobs) ? jobs : [];
  } catch {
    return [];
  }
}

async function jobExists(title: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_jobs?title_ar=eq.${encodeURIComponent(title)}&select=id&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await r.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function saveJob(job: Record<string, string>): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
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
        created_at: new Date().toISOString(),
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const _denied_ = enforcePermission("jobs");
  if (_denied_) return _denied_;

  const body = await req.json().catch(() => ({})) as Record<string, string>;
  const text = (body.text || "").trim();

  if (!text) {
    return NextResponse.json({ ok: false, error: "الرجاء لصق نص التغريدات أولاً" }, { status: 400 });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ ok: false, error: "إعدادات Supabase غير مضبوطة" }, { status: 500 });
  }

  // استخراج الوظائف بـ Gemini
  const jobs = await extractJobsWithGemini(text);

  if (jobs.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, skipped: 0, total: 0, message: "لم يجد الذكاء الاصطناعي أي وظائف في النص" });
  }

  let inserted = 0;
  let skipped = 0;

  for (const job of jobs) {
    if (!job.title_ar?.trim()) continue;

    // إذا لم يجد Gemini إيميل، نحاول نستخرجه من النص الأصلي
    if (!job.application_email) {
      const emails = extractEmails(text);
      if (emails.length > 0) job.application_email = emails[0];
    }

    const exists = await jobExists(job.title_ar.trim());
    if (exists) { skipped++; continue; }

    const saved = await saveJob(job);
    if (saved) inserted++;
  }

  return NextResponse.json({ ok: true, inserted, skipped, total: jobs.length });
}
