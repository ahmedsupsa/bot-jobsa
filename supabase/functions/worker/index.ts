// Supabase Edge Function — Auto Apply Worker
// يعمل تلقائياً كل 30 دقيقة عبر pg_cron
// الإرسال عبر Resend API من إيميل jobbots.org المخصص لكل مستخدم

const SUPABASE_URL  = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_KEY    = Deno.env.get("GEMINI_API_KEY") ?? "";
const WORKER_SECRET = Deno.env.get("WORKER_SECRET") ?? "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";

const SB = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// ─── Supabase helpers ──────────────────────────────────────────────────────────

async function sbGet(table: string, params: Record<string, string> = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", "*");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { headers: SB });
  if (!r.ok) return [];
  return r.json() as Promise<Record<string, unknown>[]>;
}

async function sbCount(table: string, params: Record<string, string> = {}): Promise<number> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", "id");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { headers: { ...SB, Prefer: "count=exact" } });
  const range = r.headers.get("content-range") ?? "";
  return parseInt(range.split("/")[1] ?? "0", 10) || 0;
}

async function sbInsert(table: string, data: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: SB, body: JSON.stringify(data),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripEmojis(text: string): string {
  return (text ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u2600-\u27BF]+/gu, "")
    .replace(/\s+/g, " ").trim();
}

function isValidEmail(addr: string): boolean {
  return EMAIL_RE.test((addr ?? "").trim());
}

function isActiveSubscription(user: Record<string, unknown>): boolean {
  const ends = String(user.subscription_ends_at ?? "");
  if (!ends) return false;
  try { return new Date(ends) > new Date(); } catch { return false; }
}

function jobMatchesUser(job: Record<string, unknown>, fieldNames: string[]): boolean {
  if (!fieldNames.length) return false;
  const blob = [job.specializations, job.title_ar, job.title_en, job.description_ar, job.description_en]
    .map((v) => String(v ?? "")).join(" ").toLowerCase();
  if (!blob.trim()) return false;
  for (const name of fieldNames) {
    const n = (name ?? "").trim().toLowerCase();
    if (n && blob.includes(n)) return true;
  }
  const words = new Set<string>();
  for (const name of fieldNames)
    for (const w of (name ?? "").toLowerCase().split(/[\s\-/_,()]+/))
      if (w.trim().length >= 4) words.add(w.trim());
  return [...words].filter((w) => blob.includes(w)).length >= 2;
}

// ─── CV Download ──────────────────────────────────────────────────────────────

async function downloadCv(storagePath: string): Promise<Uint8Array | null> {
  const url = `${SUPABASE_URL}/storage/v1/object/cvs/${storagePath}`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) return null;
  return new Uint8Array(await r.arrayBuffer());
}

// ─── Gemini Cover Letter ──────────────────────────────────────────────────────

async function generateCoverLetter(
  jobTitle: string, name: string, company: string, desc: string, lang: string
): Promise<string> {
  const fallback = lang === "ar"
    ? `أتقدم بكل اهتمام لشغل وظيفة ${jobTitle}${company ? " في " + company : ""}. أنا مهتم بهذه الفرصة وأثق في قدرتي على إضافة قيمة حقيقية لفريقكم.`
    : `I am writing to express my interest in the ${jobTitle} position${company ? " at " + company : ""}. I am confident in my ability to contribute effectively to your team.`;
  if (!GEMINI_KEY) return fallback;

  const prompt =
    `اقرأ السيرة الذاتية واكتب رسالة تغطية مختصرة (3-4 جمل) باللغة ${lang === "ar" ? "العربية" : "الإنجليزية"} ` +
    `للتقديم على وظيفة: ${jobTitle}` +
    (company ? ` في شركة ${company}` : "") +
    (desc ? `. تفاصيل الوظيفة: ${desc.slice(0, 400)}` : "") +
    `. الاسم: ${name}. بدون إيموجي. النص فقط.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await r.json();
    return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim() || fallback;
  } catch {
    return fallback;
  }
}

// ─── بناء HTML للإيميل ────────────────────────────────────────────────────────

function buildEmailHtml(name: string, phone: string, jobTitle: string, company: string, cover: string, lang: string): string {
  const isAr = lang === "ar";
  const dir  = isAr ? "rtl" : "ltr";
  const align = isAr ? "right" : "left";
  const coverHtml = cover.replace(/\n/g, "<br>");
  const companyRow = company
    ? `<tr><td style="color:#666;padding:4px 10px 4px 0;">${isAr ? "الشركة" : "Company"}</td><td style="color:#111;font-weight:600;">${company}</td></tr>`
    : "";
  return `<!DOCTYPE html><html dir="${dir}" lang="${isAr ? "ar" : "en"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;border:1px solid #ddd;">
  <tr><td style="background:#1a1a1a;border-radius:8px 8px 0 0;padding:18px 28px;direction:${dir};text-align:${align};">
    <p style="margin:0;color:#e5e5e5;font-size:13px;">${isAr ? "طلب توظيف" : "Job Application"} — <strong style="color:#fff;">${jobTitle}</strong></p>
  </td></tr>
  <tr><td style="padding:28px;direction:${dir};text-align:${align};">
    <p style="margin:0 0 18px;color:#1a1a1a;font-size:15px;line-height:2.0;border-right:3px solid #1a1a1a;padding-right:14px;">${coverHtml}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:22px 0;">
    <table cellpadding="0" cellspacing="0" style="font-size:13px;"><tbody>
      <tr><td style="color:#666;padding:4px 10px 4px 0;">${isAr ? "الاسم" : "Name"}</td><td style="color:#111;font-weight:600;">${name}</td></tr>
      <tr><td style="color:#666;padding:4px 10px 4px 0;">${isAr ? "الجوال" : "Phone"}</td><td style="color:#111;" dir="ltr">${phone}</td></tr>
      ${companyRow}
    </tbody></table>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ─── الإرسال عبر Resend API ───────────────────────────────────────────────────

async function sendResend(opts: {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
  cvBytes?: Uint8Array | null;
  cvName?: string;
}): Promise<void> {
  const payload: Record<string, unknown> = {
    from: `${opts.fromName} <${opts.fromEmail}>`,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    reply_to: opts.fromEmail,
  };

  if (opts.cvBytes && opts.cvName) {
    const binary = Array.from(opts.cvBytes, (b) => String.fromCharCode(b)).join("");
    payload.attachments = [{
      filename: opts.cvName,
      content: btoa(binary),
    }];
  }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => r.statusText);
    throw new Error(`Resend ${r.status}: ${errText}`);
  }
}

// ─── Main Cycle ───────────────────────────────────────────────────────────────

type Detail = { user: string; job: string; status: "sent" | "skipped" | "error"; reason?: string };

async function runCycle() {
  const errors: string[] = [];
  const details: Detail[] = [];
  let applied = 0, activeUsers = 0;

  if (!RESEND_KEY) {
    return { applied: 0, users: 0, errors: ["RESEND_API_KEY غير معرّف في Supabase Secrets"], details: [] };
  }

  const jobsRaw = await sbGet("admin_jobs", { is_active: "eq.true" });
  const jobs = jobsRaw.filter((j) => isValidEmail(String(j.application_email ?? "").trim()));
  if (!jobs.length) return { applied: 0, users: 0, errors: [], details: [] };

  const [usersRaw, fieldsRaw] = await Promise.all([sbGet("users"), sbGet("job_fields")]);

  // ترتيب عشوائي — توزيع عادل بين المستخدمين
  const users = [...usersRaw].sort(() => Math.random() - 0.5);
  const today = new Date().toISOString().split("T")[0];

  for (const user of users) {
    if (!isActiveSubscription(user)) continue;
    activeUsers++;

    const uid = String(user.id);
    const countToday = await sbCount("applications", { user_id: `eq.${uid}`, applied_at: `gte.${today}` });
    if (countToday >= 10) continue;

    const [settingsRows, cvRows, prefsRows] = await Promise.all([
      sbGet("user_settings",        { user_id: `eq.${uid}` }),
      sbGet("user_cvs",             { user_id: `eq.${uid}` }),
      sbGet("user_job_preferences", { user_id: `eq.${uid}` }),
    ]);

    const settings = settingsRows[0] ?? {};

    // إيميل المستخدم على jobbots.org
    const senderEmail = String(settings.email ?? "").trim();
    if (!senderEmail || !isValidEmail(senderEmail)) {
      details.push({ user: String(user.full_name ?? uid), job: "—", status: "skipped", reason: "لا يوجد إيميل jobbots.org مخصص" });
      continue;
    }

    const cv = cvRows[0];
    if (!cv) {
      details.push({ user: String(user.full_name ?? uid), job: "—", status: "skipped", reason: "لا توجد سيرة ذاتية" });
      continue;
    }

    const storagePath = String(cv.storage_path ?? "").trim();
    const cvBytes = storagePath ? await downloadCv(storagePath) : null;
    const cvName  = String(cv.file_name ?? "cv.pdf");

    const prefIds    = new Set(prefsRows.map((p) => String(p.job_field_id)).filter(Boolean));
    const fieldNames = fieldsRaw
      .filter((f) => prefIds.has(String(f.id)))
      .map((f) => String(f.name_ar ?? f.name_en ?? ""));

    const name      = String(user.full_name ?? "المتقدم");
    const phone     = String(user.phone ?? "");
    const lang      = String(settings.application_language ?? "ar");
    const remaining = 10 - countToday;
    let sent = 0;

    for (const job of jobs) {
      if (sent >= remaining) break;

      const jobId = String(job.id);
      const already = await sbCount("applications", { user_id: `eq.${uid}`, job_id: `eq.${jobId}` });
      if (already > 0) {
        details.push({ user: name, job: String(job.title_ar ?? job.title_en ?? ""), status: "skipped", reason: "قُدِّم سابقاً" });
        continue;
      }
      if (!jobMatchesUser(job, fieldNames)) {
        details.push({ user: name, job: String(job.title_ar ?? job.title_en ?? ""), status: "skipped", reason: "لا يطابق التفضيلات" });
        continue;
      }

      const toEmail  = String(job.application_email ?? "").trim();
      const jobTitle = String(job.title_ar ?? job.title_en ?? "وظيفة");
      const company  = String(job.company ?? "");
      const desc     = String(job.description_ar ?? job.description_en ?? "").slice(0, 1200);

      if (!isValidEmail(toEmail)) {
        details.push({ user: name, job: jobTitle, status: "skipped", reason: `إيميل غير صالح: ${toEmail}` });
        continue;
      }

      const sentAt = new Date().toISOString();
      let status: "sent" | "error" = "sent";
      let errorReason: string | null = null;

      try {
        let cover = await generateCoverLetter(jobTitle, name, company, desc, lang);
        cover = stripEmojis(cover);
        const html    = buildEmailHtml(name, phone, jobTitle, company, cover, lang);
        const subject = lang === "ar"
          ? `التقديم على وظيفة: ${stripEmojis(jobTitle)}`
          : `Application for: ${stripEmojis(jobTitle)}`;

        await sendResend({
          fromName: name, fromEmail: senderEmail,
          to: toEmail, subject, html, cvBytes, cvName,
        });

        sent++; applied++;
        details.push({ user: name, job: jobTitle, status: "sent" });
        console.log(`[worker] ✅ ${name} (${senderEmail}) → ${jobTitle} (${toEmail})`);

        // تأخير 3 ثوانٍ بين كل إيميل
        await new Promise((r) => setTimeout(r, 3000));
      } catch (e) {
        status = "error";
        errorReason = String(e).slice(0, 500);
        errors.push(`${name} → ${jobTitle}: ${errorReason}`);
        details.push({ user: name, job: jobTitle, status: "error", reason: errorReason });
        console.error(`[worker] ❌ ${name} → ${jobTitle}: ${errorReason}`);
      }

      await sbInsert("applications", {
        user_id: uid, job_id: jobId, job_title: jobTitle,
        applied_at: sentAt, status, provider_used: "resend",
        error_reason: errorReason, sent_at: status === "sent" ? sentAt : null,
      });
    }
  }

  return { applied, users: activeUsers, errors, details };
}

async function logRun(data: {
  applied_count: number; active_users: number;
  errors: string[]; duration_ms: number; status: string;
}) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/worker_logs`, {
      method: "POST", headers: SB,
      body: JSON.stringify({ ...data, errors: JSON.stringify(data.errors), ran_at: new Date().toISOString() }),
    });
  } catch { /* silent */ }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (WORKER_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${WORKER_SECRET}`)
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  console.log("[worker] بدء دورة التقديم التلقائي عبر Resend API");
  const t0 = Date.now();
  try {
    const result = await runCycle();
    const duration_ms = Date.now() - t0;
    const status = result.errors.length === 0 ? "success" : result.applied > 0 ? "partial" : "error";
    await logRun({ applied_count: result.applied, active_users: result.users, errors: result.errors, duration_ms, status });

    console.log("[worker] انتهت الدورة:", JSON.stringify({ applied: result.applied, users: result.users, errors: result.errors.length }));
    return new Response(JSON.stringify({ ok: true, ...result, duration_ms }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const duration_ms = Date.now() - t0;
    await logRun({ applied_count: 0, active_users: 0, errors: [String(e)], duration_ms, status: "error" });
    console.error("[worker] خطأ:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
