// Supabase Edge Function — Auto Apply Worker
// يعمل تلقائياً كل 30 دقيقة عبر pg_cron

const SUPABASE_URL   = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SUPABASE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM    = Deno.env.get("RESEND_FROM_EMAIL") ?? "";
const RESEND_NAME    = Deno.env.get("RESEND_FROM_NAME") ?? "Jobbots";
const GEMINI_KEY     = Deno.env.get("GEMINI_API_KEY") ?? "";
const WORKER_SECRET  = Deno.env.get("WORKER_SECRET") ?? "";
const APP_URL        = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

const SB = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// ─── Supabase helpers ─────────────────────────────────────────────────────────

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
    `اكتب رسالة تغطية مختصرة (3-4 جمل) باللغة ${lang === "ar" ? "العربية" : "الإنجليزية"} ` +
    `للتقديم على وظيفة: ${jobTitle}` +
    (company ? ` في شركة ${company}` : "") +
    (desc ? `. تفاصيل الوظيفة: ${desc.slice(0, 300)}` : "") +
    `. الاسم: ${name}. لا تضف إيموجي. فقط نص الرسالة.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${GEMINI_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    const data = await r.json();
    return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim() || fallback;
  } catch {
    return fallback;
  }
}

// ─── Email Builder ────────────────────────────────────────────────────────────

function buildEmailHtml(name: string, phone: string, jobTitle: string, company: string, cover: string, lang: string) {
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const companyHtml = company ? `<p><strong>${isAr ? "الشركة" : "Company"}:</strong> ${company}</p>` : "";
  return `<!DOCTYPE html><html dir="${dir}" lang="${isAr ? "ar" : "en"}">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9f9f9;direction:${dir};text-align:${isAr ? "right" : "left"};">
<div style="background:#fff;padding:24px;border-radius:8px;">
<h2 style="color:#333;margin:0 0 12px;">${isAr ? "طلب توظيف" : "Job Application"} — ${jobTitle}</h2>
<p style="line-height:1.9;color:#2c2c2c;">${cover.replace(/\n/g, "<br>")}</p>
<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
${companyHtml}
<p><strong>${isAr ? "الاسم" : "Name"}:</strong> ${name}</p>
<p><strong>${isAr ? "الجوال" : "Phone"}:</strong> ${phone}</p>
</div></body></html>`;
}

// ─── Send Email via Resend ────────────────────────────────────────────────────

async function sendEmail(opts: {
  to: string; subject: string; html: string;
  replyTo: string; cc?: string;
  cvBytes?: Uint8Array | null; cvName?: string;
  fromName: string; fromEmail?: string;
}) {
  const btoa = (b: Uint8Array) => {
    let s = "";
    b.forEach((c) => (s += String.fromCharCode(c)));
    return globalThis.btoa(s);
  };
  const from = opts.fromEmail || RESEND_FROM;
  const payload: Record<string, unknown> = {
    from: `${opts.fromName} <${from}>`,
    to: [opts.to], subject: opts.subject, html: opts.html, reply_to: opts.replyTo,
  };
  if (opts.cc && opts.cc.toLowerCase() !== opts.to.toLowerCase()) payload.cc = [opts.cc];
  if (opts.cvBytes && opts.cvName)
    payload.attachments = [{ filename: opts.cvName, content: btoa(opts.cvBytes) }];

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (![200, 201, 202].includes(r.status))
    throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

// ─── Main Cycle ───────────────────────────────────────────────────────────────

type Detail = { user: string; job: string; email: string; status: "sent" | "skipped" | "error"; reason?: string };

async function runCycle() {
  const errors: string[] = [];
  const details: Detail[] = [];
  const achievers: Array<{ user_id: string; name: string; applied_count: number }> = [];
  let applied = 0, activeUsers = 0;

  if (!RESEND_API_KEY || !RESEND_FROM) {
    return { applied: 0, users: 0, errors: ["RESEND_API_KEY / RESEND_FROM_EMAIL غير معرّف"], details: [] };
  }

  const jobsRaw = await sbGet("admin_jobs", { is_active: "eq.true" });
  const jobs = jobsRaw.filter((j) => String(j.application_email ?? "").trim());
  if (!jobs.length) return { applied: 0, users: 0, errors: [], details: [] };

  const [usersRaw, fieldsRaw] = await Promise.all([sbGet("users"), sbGet("job_fields")]);

  // ترتيب عشوائي في كل دورة — توزيع عادل ومنع الضغط
  const users = [...usersRaw].sort(() => Math.random() - 0.5);

  const today = new Date().toISOString().split("T")[0];

  for (const user of users) {
    if (!isActiveSubscription(user)) continue;
    activeUsers++;

    const uid = String(user.id);
    const countToday = await sbCount("applications", { user_id: `eq.${uid}`, applied_at: `gte.${today}` });
    if (countToday >= 10) continue;

    const [settingsRows, cvRows, prefsRows] = await Promise.all([
      sbGet("user_settings", { user_id: `eq.${uid}` }),
      sbGet("user_cvs",      { user_id: `eq.${uid}` }),
      sbGet("user_job_preferences", { user_id: `eq.${uid}` }),
    ]);

    const settings = settingsRows[0] ?? {};
    const userEmail = String(settings.email ?? "").trim();
    if (!userEmail) continue;

    const senderAlias = String(settings.sender_email_alias ?? "").trim();

    const cv = cvRows[0];
    if (!cv) continue;

    const storagePath = String(cv.storage_path ?? "").trim();
    const cvBytes = storagePath ? await downloadCv(storagePath) : null;
    const cvName  = String(cv.file_name ?? "cv.pdf");

    const prefIds   = new Set(prefsRows.map((p) => String(p.job_field_id)).filter(Boolean));
    const fieldNames = fieldsRaw
      .filter((f) => prefIds.has(String(f.id)))
      .map((f) => String(f.name_ar ?? f.name_en ?? ""));

    const name     = String(user.full_name ?? "المتقدم");
    const phone    = String(user.phone ?? "");
    const lang     = String(settings.application_language ?? "ar");
    const remaining = 10 - countToday;
    let sent = 0;

    for (const job of jobs) {
      if (sent >= remaining) break;

      const jobId = String(job.id);
      const already = await sbCount("applications", { user_id: `eq.${uid}`, job_id: `eq.${jobId}` });
      if (already > 0) {
        details.push({ user: name, job: String(job.title_ar ?? job.title_en ?? ""), email: String(job.application_email ?? ""), status: "skipped", reason: "قُدِّم سابقاً" });
        continue;
      }
      if (!jobMatchesUser(job, fieldNames)) {
        details.push({ user: name, job: String(job.title_ar ?? job.title_en ?? ""), email: String(job.application_email ?? ""), status: "skipped", reason: "لا يطابق التفضيلات" });
        continue;
      }

      const toEmail  = String(job.application_email ?? "").trim();
      const jobTitle = String(job.title_ar ?? job.title_en ?? "وظيفة");
      const company  = String(job.company ?? "");
      const desc     = String(job.description_ar ?? job.description_en ?? "").slice(0, 1200);

      try {
        let cover = await generateCoverLetter(jobTitle, name, company, desc, lang);
        cover = stripEmojis(cover);
        const html    = buildEmailHtml(name, phone, jobTitle, company, cover, lang);
        const subject = lang === "ar"
          ? `التقديم على وظيفة: ${stripEmojis(jobTitle)}`
          : `Application for: ${stripEmojis(jobTitle)}`;

        const fromEmail = senderAlias || RESEND_FROM;
        await sendEmail({ to: toEmail, subject, html, replyTo: userEmail, cc: userEmail, cvBytes, cvName, fromName: name, fromEmail });
        await sbInsert("applications", {
          user_id: uid, job_id: jobId, job_title: jobTitle,
          applied_at: new Date().toISOString(),
        });
        details.push({ user: name, job: jobTitle, email: toEmail, status: "sent" });
        sent++; applied++;

        // تأخير 5 ثوانٍ بين كل إيميل — يمنع الضغط ويحمي من فلاتر الـ spam
        await new Promise((r) => setTimeout(r, 5000));
      } catch (e) {
        const msg = String(e);
        errors.push(`${name} → ${jobTitle}: ${msg}`);
        details.push({ user: name, job: jobTitle, email: toEmail, status: "error", reason: msg });
      }
    }

    if (sent > 0) {
      console.log(`[worker] ✅ ${name}: ${sent} تقديم`);
      achievers.push({ user_id: uid, name, applied_count: sent });
    }
  }

  return { applied, users: activeUsers, errors, details, achievers };
}

async function logRun(data: { applied_count: number; active_users: number; errors: string[]; duration_ms: number; status: string }) {
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

  console.log("[worker] بدء دورة التقديم التلقائي");
  const t0 = Date.now();
  try {
    const result = await runCycle();
    const duration_ms = Date.now() - t0;
    const status = result.errors.length === 0 ? "success" : result.applied > 0 ? "partial" : "error";
    await logRun({ applied_count: result.applied, active_users: result.users, errors: result.errors, duration_ms, status });

    // إرسال إشعارات الإنجاز للمستخدمين الذين تمت التقديمات لهم
    if (result.achievers?.length && APP_URL) {
      try {
        await fetch(`${APP_URL}/api/internal/notify-achievements`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(WORKER_SECRET ? { Authorization: `Bearer ${WORKER_SECRET}` } : {}),
          },
          body: JSON.stringify({ results: result.achievers }),
        });
        console.log(`[worker] 🔔 إشعارات أُرسلت لـ ${result.achievers.length} مستخدم`);
      } catch (e) {
        console.warn("[worker] فشل إرسال إشعارات الإنجاز:", String(e));
      }
    }

    console.log("[worker] انتهت الدورة:", JSON.stringify(result));
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
