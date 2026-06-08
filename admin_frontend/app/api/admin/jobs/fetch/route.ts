import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractEmails(text: string): string[] {
  return text.match(EMAIL_RE) || [];
}

// Regex-based job extraction from Arabic text
const JOB_TITLE_PATTERNS = [
  /مطلوب\s+(.+?)(?:\n|\.|،|ـ)/i,
  /وظيفة\s+(.+?)(?:\n|\.|،|ـ)/i,
  /يطلب\s+(.+?)(?:\n|\.|،|ـ)/i,
  /بحاجة\s+(.+?)(?:\n|\.|،|ـ)/i,
  /فرصة\s+(?:عمل|وظيفية)\s+(.+?)(?:\n|\.|،|ـ)/i,
  /(?:مهندس|محاسب|ممرض|فني|مدير|مشرف|مسؤول|مساعد|سائق|محامي|مستشار|أخصائي|اخصائي)\s+.+?(?:\n|\.|،|ـ)/i,
];

const COMPANY_PATTERNS = [
  /(?:شركة|مؤسسة|مجموعة)\s+([^\n\.،]+)/i,
  /لصالح\s+(?:عمل\s+)?([^\n\.،]+)/i,
  /(?:في|بـ|لـ)\s*(?:شركة|مؤسسة)\s+([^\n\.،]+)/i,
];

function extractJobsFromText(text: string): Record<string, string>[] {
  const jobs: Record<string, string>[] = [];
  const lines = text.split("\n").filter(l => l.trim());
  const emails = extractEmails(text);

  let currentJob: Partial<Record<string, string>> = {};
  let inJob = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this line starts a new job
    let match: RegExpMatchArray | null;
    let title = "";
    for (const pat of JOB_TITLE_PATTERNS) {
      match = trimmed.match(pat);
      if (match) {
        title = match[1] || match[0];
        break;
      }
    }

    if (title) {
      if (inJob && currentJob.title_ar) {
        jobs.push({
          title_ar: currentJob.title_ar,
          company: currentJob.company || "",
          description_ar: currentJob.description_ar || "",
          application_email: currentJob.application_email || (emails.length > 0 ? emails[0] : ""),
          specializations: currentJob.title_ar,
        });
      }
      currentJob = { title_ar: title.trim(), description_ar: trimmed, company: "" };
      inJob = true;

      // Try to extract company
      for (const cpat of COMPANY_PATTERNS) {
        const cmatch = trimmed.match(cpat);
        if (cmatch) {
          currentJob.company = cmatch[1].trim();
          break;
        }
      }
    } else if (inJob) {
      currentJob.description_ar = (currentJob.description_ar || "") + "\n" + trimmed;

      // Try to extract company from additional lines
      if (!currentJob.company) {
        for (const cpat of COMPANY_PATTERNS) {
          const cmatch = trimmed.match(cpat);
          if (cmatch) {
            currentJob.company = cmatch[1].trim();
            break;
          }
        }
      }
    }
  }

  // Push last job
  if (inJob && currentJob.title_ar) {
    jobs.push({
      title_ar: currentJob.title_ar,
      company: currentJob.company || "",
      description_ar: currentJob.description_ar || "",
      application_email: currentJob.application_email || (emails.length > 0 ? emails[0] : ""),
      specializations: currentJob.title_ar,
    });
  }

  return jobs;
}

function extractCompany(text: string): string {
  for (const pat of COMPANY_PATTERNS) {
    const match = text.match(pat);
    if (match) return match[1].trim();
  }
  return "";
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
        company: (job.company || extractCompany(job.description_ar || "")).slice(0, 200),
        description_ar: (job.description_ar || "").slice(0, 3000),
        application_email: job.application_email || null,
        specializations: job.title_ar?.slice(0, 500) || "",
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

  // استخراج الوظائف محلياً بالـ Regex
  const jobs = extractJobsFromText(text);

  if (jobs.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, skipped: 0, total: 0, message: "لم يتم العثور على وظائف في النص" });
  }

  let inserted = 0;
  let skipped = 0;

  for (const job of jobs) {
    if (!job.title_ar?.trim()) continue;

    const exists = await jobExists(job.title_ar.trim());
    if (exists) { skipped++; continue; }

    const saved = await saveJob(job);
    if (saved) inserted++;
  }

  return NextResponse.json({ ok: true, inserted, skipped, total: jobs.length });
}
