import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || "Jobsa";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

const SB_HEADERS: Record<string, string> = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function sbGet(table: string, params: Record<string, string> = {}): Promise<Record<string, unknown>[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", "*");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { headers: SB_HEADERS });
  if (!r.ok) return [];
  return r.json();
}

async function sbCount(table: string, params: Record<string, string> = {}): Promise<number> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", "id");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), {
    headers: { ...SB_HEADERS, Prefer: "count=exact" },
  });
  const range = r.headers.get("content-range") || "";
  try {
    return parseInt(range.split("/")[1], 10) || 0;
  } catch {
    return 0;
  }
}

async function sbInsert(table: string, data: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: SB_HEADERS,
    body: JSON.stringify(data),
  });
}

function stripEmojis(text: string): string {
  return (text || "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u2600-\u27BF]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function jobMatchesUser(job: Record<string, unknown>, fieldNames: string[]): boolean {
  if (!fieldNames.length) return false;
  const blob = [
    job.specializations,
    job.title_ar,
    job.title_en,
    job.description_ar,
    job.description_en,
  ]
    .map((v) => String(v || ""))
    .join(" ")
    .toLowerCase();
  if (!blob.trim()) return false;

  for (const name of fieldNames) {
    const n = (name || "").trim().toLowerCase();
    if (n && blob.includes(n)) return true;
  }

  const words = new Set<string>();
  for (const name of fieldNames) {
    for (const w of (name || "").toLowerCase().split(/[\s\-/_,()]+/)) {
      if (w.trim().length >= 4) words.add(w.trim());
    }
  }
  const hits = [...words].filter((w) => blob.includes(w)).length;
  return hits >= 2;
}

function isSubscriptionActive(user: Record<string, unknown>): boolean {
  const ends = String(user.subscription_ends_at || "");
  if (!ends) return false;
  try {
    const endDt = new Date(ends);
    return endDt > new Date();
  } catch {
    return false;
  }
}

async function generateCoverLetter(
  jobTitle: string,
  name: string,
  company: string,
  desc: string,
  lang: string
): Promise<string> {
  if (!GEMINI_API_KEY) {
    if (lang === "ar")
      return `أتقدم بكل اهتمام لشغل وظيفة ${jobTitle}${company ? " في " + company : ""}. أنا مهتم بهذه الفرصة وأثق في قدرتي على إضافة قيمة حقيقية لفريقكم.`;
    return `I am writing to express my interest in the ${jobTitle} position${company ? " at " + company : ""}. I am confident in my ability to contribute effectively to your team.`;
  }

  const prompt =
    `اكتب رسالة تغطية مختصرة (3-4 جمل) باللغة ${lang === "ar" ? "العربية" : "الإنجليزية"} ` +
    `للتقديم على وظيفة: ${jobTitle}` +
    (company ? ` في شركة ${company}` : "") +
    (desc ? `. تفاصيل الوظيفة: ${desc.slice(0, 300)}` : "") +
    `. الاسم: ${name}. لا تضف إيموجي.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await r.json();
    return (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  } catch {
    return "";
  }
}

function buildEmailHtml(
  name: string,
  phone: string,
  jobTitle: string,
  company: string,
  cover: string,
  lang: string
): string {
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const coverHtml = cover.replace(/\n/g, "<br>");
  const companyHtml = company
    ? `<p><strong>${isAr ? "الشركة" : "Company"}:</strong> ${company}</p>`
    : "";
  return `<!DOCTYPE html><html dir="${dir}" lang="${isAr ? "ar" : "en"}">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9f9f9;direction:${dir};text-align:${isAr ? "right" : "left"};">
<div style="background:#fff;padding:24px;border-radius:8px;">
<h2 style="color:#333;margin:0 0 12px;">${isAr ? "طلب توظيف" : "Job Application"} — ${jobTitle}</h2>
<p style="line-height:1.9;color:#2c2c2c;">${coverHtml}</p>
<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
${companyHtml}
<p><strong>${isAr ? "الاسم" : "Name"}:</strong> ${name}</p>
<p><strong>${isAr ? "الجوال" : "Phone"}:</strong> ${phone}</p>
</div></body></html>`;
}

async function sendEmail(
  toEmail: string,
  subject: string,
  html: string,
  replyTo: string,
  cc: string | null,
  cvBytes: Buffer | null,
  cvName: string | null,
  fromName: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    from: `${fromName} <${RESEND_FROM_EMAIL}>`,
    to: [toEmail],
    subject,
    html,
    reply_to: replyTo,
  };
  if (cc && cc.toLowerCase() !== toEmail.toLowerCase()) payload.cc = [cc];
  if (cvBytes && cvName) {
    payload.attachments = [{ filename: cvName, content: cvBytes.toString("base64") }];
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (![200, 201, 202].includes(r.status)) {
    throw new Error(`Resend error ${r.status}: ${await r.text()}`);
  }
}

async function downloadCv(storagePath: string): Promise<Buffer | null> {
  const url = `${SUPABASE_URL}/storage/v1/object/cvs/${storagePath}`;
  const r = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return null;
  const arrayBuffer = await r.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

type CycleDetail = { user: string; job: string; to_email: string; status: "sent" | "skipped" | "error"; reason?: string };

async function runCycle(): Promise<{ applied: number; users: number; errors: string[]; details: CycleDetail[] }> {
  const errors: string[] = [];
  const details: CycleDetail[] = [];
  let totalApplied = 0;
  let activeUsers = 0;

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return { applied: 0, users: 0, errors: ["RESEND_API_KEY / RESEND_FROM_EMAIL غير معرّف"], details: [] };
  }

  const jobsRaw = await sbGet("admin_jobs", { is_active: "eq.true" });
  const jobs = jobsRaw.filter((j) => String(j.application_email || "").trim());
  if (!jobs.length) return { applied: 0, users: 0, errors: [], details: [] };

  const [users, fieldsRaw] = await Promise.all([sbGet("users"), sbGet("job_fields")]);

  for (const user of users) {
    if (!isSubscriptionActive(user)) continue;
    activeUsers++;

    const uid = String(user.id);
    const today = new Date().toISOString().split("T")[0];
    const countToday = await sbCount("applications", {
      user_id: `eq.${uid}`,
      applied_at: `gte.${today}`,
    });
    if (countToday >= 10) continue;

    const [settingsRows, cvRows, prefsRows] = await Promise.all([
      sbGet("user_settings", { user_id: `eq.${uid}` }),
      sbGet("user_cvs", { user_id: `eq.${uid}` }),
      sbGet("user_job_preferences", { user_id: `eq.${uid}` }),
    ]);

    const settings = settingsRows[0] || {};
    const email = String(settings.email || "").trim();
    if (!email) continue;

    const cv = cvRows[0];
    if (!cv) continue;

    const storagePath = String(cv.storage_path || "").trim();
    const cvBytes = storagePath ? await downloadCv(storagePath) : null;
    const cvName = String(cv.file_name || "cv.pdf");

    const prefIds = new Set(prefsRows.map((p) => String(p.job_field_id)).filter(Boolean));
    const fieldNames = fieldsRaw
      .filter((f) => prefIds.has(String(f.id)))
      .map((f) => String(f.name_ar || f.name_en || ""));

    const name = String(user.full_name || "المتقدم");
    const phone = String(user.phone || "");
    const lang = String(settings.application_language || "ar");
    const remaining = 10 - countToday;
    let sent = 0;

    for (const job of jobs) {
      if (sent >= remaining) break;
      const jobId = String(job.id);
      const alreadyApplied = await sbCount("applications", {
        user_id: `eq.${uid}`,
        job_id: `eq.${jobId}`,
      });
      if (alreadyApplied > 0) {
        details.push({ user: name, job: String(job.title_ar || job.title_en || ""), to_email: String(job.application_email || ""), status: "skipped", reason: "قُدِّم سابقاً" });
        continue;
      }
      if (!jobMatchesUser(job, fieldNames)) {
        details.push({ user: name, job: String(job.title_ar || job.title_en || ""), to_email: String(job.application_email || ""), status: "skipped", reason: "لا يطابق التفضيلات" });
        continue;
      }

      const toEmail = String(job.application_email || "").trim();
      const jobTitle = String(job.title_ar || job.title_en || "وظيفة");
      const company = String(job.company || "");
      const desc = String(job.description_ar || job.description_en || "").slice(0, 1200);

      try {
        let cover = await generateCoverLetter(jobTitle, name, company, desc, lang);
        cover = stripEmojis(cover);
        const html = buildEmailHtml(name, phone, jobTitle, company, cover, lang);
        const subject =
          lang === "ar"
            ? `التقديم على وظيفة: ${stripEmojis(jobTitle)}`
            : `Application for: ${stripEmojis(jobTitle)}`;

        await sendEmail(toEmail, subject, html, email, email, cvBytes, cvName, name);
        await sbInsert("applications", {
          user_id: uid,
          job_title: jobTitle,
          job_id: jobId,
          applied_at: new Date().toISOString(),
        });
        details.push({ user: name, job: jobTitle, to_email: toEmail, status: "sent" });
        sent++;
        totalApplied++;
      } catch (e) {
        const errMsg = String(e);
        errors.push(`${name} → ${jobTitle}: ${errMsg}`);
        details.push({ user: name, job: jobTitle, to_email: toEmail, status: "error", reason: errMsg });
      }
    }

    if (sent > 0) console.log(`[worker] ${name}: ${sent} تقديم`);
  }

  return { applied: totalApplied, users: activeUsers, errors, details };
}

async function logWorkerRun(data: {
  applied_count: number;
  active_users: number;
  errors: string[];
  duration_ms: number;
  status: string;
}) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/worker_logs`, {
      method: "POST",
      headers: SB_HEADERS,
      body: JSON.stringify({
        ...data,
        errors: JSON.stringify(data.errors),
        ran_at: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("[worker] فشل حفظ السجل:", e);
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[worker] بدء دورة التقديم التلقائي");
  const startTime = Date.now();
  try {
    const result = await runCycle();
    const duration_ms = Date.now() - startTime;
    const status = result.errors.length === 0 ? "success" : result.applied > 0 ? "partial" : "error";
    await logWorkerRun({ applied_count: result.applied, active_users: result.users, errors: result.errors, duration_ms, status });
    console.log("[worker] انتهت الدورة:", result);
    return NextResponse.json({ ok: true, ...result, duration_ms });
  } catch (e) {
    const duration_ms = Date.now() - startTime;
    await logWorkerRun({ applied_count: 0, active_users: 0, errors: [String(e)], duration_ms, status: "error" });
    console.error("[worker] خطأ:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export const POST = GET;
