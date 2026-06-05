// Auto Apply Worker v3 — إعادة بناء من الصفر
// المنطق: صنّف مرة واحدة → طابق بدون AI → قدّم
// أقصى تقديمات: 10 لكل مستخدم يومياً

import nodemailer from "npm:nodemailer@6";

// ── متغيرات البيئة ────────────────────────────────────────────────────────────
const SUPABASE_URL  = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_KEY    = Deno.env.get("GEMINI_API_KEY") ?? "";
const WORKER_SECRET = Deno.env.get("WORKER_SECRET") ?? "";
const ENC_KEY_HEX   = Deno.env.get("SMTP_ENCRYPTION_KEY") ?? "";
const TG_BOT        = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT       = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
const TG_JOB_CH     = Deno.env.get("TELEGRAM_JOB_CHANNEL_ID") ?? "";

const SB: Record<string, string> = {
  apikey:          SUPABASE_KEY,
  Authorization:   `Bearer ${SUPABASE_KEY}`,
  "Content-Type":  "application/json",
  Prefer:          "return=representation",
};

// ── ثوابت ─────────────────────────────────────────────────────────────────────
const MAX_PER_DAY          = 10;  // أقصى تقديمات لكل مستخدم يومياً
const MAX_USERS_PER_RUN    = 15;  // أقصى مستخدمين لكل تشغيل
const MAX_CLASSIFY_PER_RUN = 30;  // أقصى وظائف تُصنَّف في كل تشغيل
const DEDUP_DAYS           = 30;  // أيام منع التكرار
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// ── مساعدات Supabase ──────────────────────────────────────────────────────────

async function sbGet<T = Record<string, unknown>>(
  table: string,
  params: Record<string, string> = {},
  select = "*",
): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { headers: SB });
  if (!r.ok) { console.error(`sbGet(${table}) ${r.status}: ${await r.text().catch(() => "")}`); return []; }
  return r.json();
}

async function sbInsert(table: string, data: Record<string, unknown>): Promise<void> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...SB, Prefer: "return=minimal" }, body: JSON.stringify(data),
  });
  if (!r.ok) console.error(`sbInsert(${table}) ${r.status}: ${await r.text().catch(() => "")}`);
}

async function sbPatch(table: string, filter: Record<string, string>, data: Record<string, unknown>): Promise<void> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(filter)) url.searchParams.set(k, v);
  await fetch(url.toString(), { method: "PATCH", headers: { ...SB, Prefer: "return=minimal" }, body: JSON.stringify(data) });
}

async function sbCount(table: string, params: Record<string, string>): Promise<number> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", "id");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { headers: { ...SB, Prefer: "count=exact" } });
  const range = r.headers.get("content-range") ?? "";
  return parseInt(range.split("/")[1] ?? "0", 10) || 0;
}

// ── AES-256-GCM فك التشفير ───────────────────────────────────────────────────

async function decryptAES(encrypted: string, keyHex: string): Promise<string> {
  const [ivB64, dataB64] = encrypted.split(":");
  if (!ivB64 || !dataB64) throw new Error("تنسيق مشفّر غير صحيح");
  const keyBytes = new Uint8Array(keyHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const iv       = Uint8Array.from(atob(ivB64),   c => c.charCodeAt(0));
  const raw      = Uint8Array.from(atob(dataB64),  c => c.charCodeAt(0));
  const tag = raw.slice(0, 16);
  const ct  = raw.slice(16);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, new Uint8Array([...ct, ...tag]));
  return new TextDecoder().decode(plain);
}

// ── بصمة الوظيفة (لمنع التكرار) ─────────────────────────────────────────────

async function makeFingerprint(title: string, company: string, email: string): Promise<string> {
  const text  = `${title}|${company}|${email}`.toLowerCase().trim();
  const bytes = new TextEncoder().encode(text);
  const hash  = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── تصنيف الوظيفة بالذكاء الاصطناعي (مرة واحدة لكل وظيفة) ─────────────────

interface ClassifyResult {
  job_type:      "job" | "tamheer" | "coop" | "internship" | "training";
  gender_req:    "male" | "female" | "both" | "unknown";
  mapped_majors: string[];
  confidence:    number;
}

async function classifyJob(title: string, desc: string): Promise<ClassifyResult> {
  const fallback: ClassifyResult = { job_type: "job", gender_req: "unknown", mapped_majors: [], confidence: 0 };
  if (!GEMINI_KEY) return fallback;

  const prompt =
    `صنّف هذه الوظيفة وأعد JSON فقط بدون markdown:\n` +
    `{"job_type":"job","gender_req":"unknown","mapped_majors":["تخصص1"],"confidence":0.9}\n\n` +
    `قواعد job_type: tamheer=تمهير، coop=تدريب تعاوني/كوب، internship=تدريب طلاب، training=تدريب فقط، وإلا job\n` +
    `قواعد gender_req: female=للنساء/سيدات/نسائي، male=للرجال/ذكور، unknown=غير محدد، both=للجميع\n` +
    `mapped_majors: قائمة 1-6 تخصصات جامعية عربية (مثل: محاسبة، إدارة أعمال، تقنية معلومات، تسويق، مالية، موارد بشرية، هندسة، طب، قانون، تعليم، إعلام، لوجستيات، تصميم)\n\n` +
    `العنوان: ${title}\nالوصف: ${desc.slice(0, 500)}`;

  for (const model of ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash"]) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      );
      if (!r.ok) continue;
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const m = text.match(/\{[\s\S]*?\}/);
      if (!m) continue;
      const p = JSON.parse(m[0]);
      return {
        job_type:      ["job","tamheer","coop","internship","training"].includes(p.job_type) ? p.job_type : "job",
        gender_req:    ["male","female","both","unknown"].includes(p.gender_req) ? p.gender_req : "unknown",
        mapped_majors: Array.isArray(p.mapped_majors) ? p.mapped_majors.slice(0, 8).map(String) : [],
        confidence:    typeof p.confidence === "number" ? Math.min(1, Math.max(0, p.confidence)) : 0.7,
      };
    } catch { continue; }
  }
  return fallback;
}

// ── الخطوة 1: تصنيف الوظائف الجديدة ─────────────────────────────────────────

async function classifyPendingJobs(): Promise<number> {
  const jobs = await sbGet("admin_jobs", {
    is_classified: "eq.false",
    is_active:     "eq.true",
    order:         "created_at.asc",
    limit:         String(MAX_CLASSIFY_PER_RUN),
  });

  let count = 0;
  for (const job of jobs) {
    const title = String(job.title_ar ?? job.title_en ?? "");
    const desc  = String(job.description_ar ?? job.description_en ?? "");
    try {
      const result = await classifyJob(title, desc);
      await sbPatch("admin_jobs", { id: `eq.${job.id}` }, {
        is_classified:    true,
        job_type:         result.job_type,
        gender_req:       result.gender_req,
        mapped_majors:    result.mapped_majors,
        confidence_score: result.confidence,
        classified_at:    new Date().toISOString(),
      });
      count++;
      console.log(`[classify] ✅ "${title}" → ${result.job_type} | ${result.gender_req} | [${result.mapped_majors.join(", ")}]`);
    } catch (e) {
      console.error(`[classify] ❌ "${title}": ${e}`);
    }
  }
  return count;
}

// ── مطابقة التخصص (بدون AI) ──────────────────────────────────────────────────

function majorMatches(userFields: string[], jobMajors: string[]): boolean {
  if (!userFields.length) return true;  // لا تفضيلات → يُقبل كل شيء
  if (!jobMajors.length)  return true;  // لم تُصنَّف التخصصات → نقبل

  const userSet = userFields.map(f => f.trim().toLowerCase());
  const jobSet  = jobMajors.map(m => m.trim().toLowerCase());

  for (const u of userSet) {
    for (const j of jobSet) {
      if (u.includes(j) || j.includes(u)) return true;
    }
  }
  return false;
}

// ── مطابقة الجنس ─────────────────────────────────────────────────────────────

function genderMatches(userGender: string, jobGenderReq: string): boolean {
  if (jobGenderReq === "both" || jobGenderReq === "unknown") return true;
  return userGender === jobGenderReq;
}

// ── تحميل السيرة الذاتية ─────────────────────────────────────────────────────

async function downloadCv(path: string): Promise<Uint8Array | null> {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/cvs/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
}

// ── رسالة التغطية ────────────────────────────────────────────────────────────

function buildCoverLetter(
  name: string, jobTitle: string, company: string,
  phone: string, email: string, savedBody?: string,
): string {
  const companyLine = company
    ? `إلى فريق التوظيف في <strong>${company}</strong>`
    : `طلب توظيف — <strong>${jobTitle}</strong>`;

  const bodyHtml = savedBody?.trim()
    ? savedBody
        .split(/\n{2,}/)
        .map(p => `<p style="line-height:2;margin:0 0 14px;font-size:15px;">${p.replace(/\n/g, "<br>")}</p>`)
        .join("")
    : `<p style="line-height:2;margin:0 0 14px;font-size:15px;">
         أتقدم بطلبي للوظيفة المعلنة <strong>${jobTitle}</strong>، وأرفق لكم سيرتي الذاتية للاطلاع عليها والنظر في طلبي.
       </p>
       <p style="line-height:2;margin:0 0 14px;font-size:15px;">
         أتطلع لفرصة التواصل معكم لمناقشة كيف يمكنني المساهمة في فريقكم.
       </p>`;

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:24px;background:#f0f2f5;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;">
<div style="background:#0a1e36;color:#fff;padding:40px;border-radius:12px;max-width:600px;margin:0 auto;direction:rtl;">
  <h2 style="margin:0 0 20px;font-size:19px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:16px;">
    ${companyLine}
  </h2>
  <p style="line-height:2;margin:0 0 16px;font-size:15px;">السلام عليكم ورحمة الله وبركاته،</p>
  ${bodyHtml}
  <p style="margin:20px 0 0;font-size:14px;border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;color:#cbd5e1;line-height:2;">
    مع خالص التحية،<br>
    <strong style="color:#fff;">${name}</strong><br>
    ${phone}<br>${email}
  </p>
</div>
</body></html>`;
}

// ── إرسال عبر SMTP ───────────────────────────────────────────────────────────

async function sendSmtp(opts: {
  host: string; port: number; secure: boolean;
  user: string; pass: string; fromName: string;
  to: string; subject: string; html: string;
  cvBytes?: Uint8Array | null; cvName?: string;
}): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: opts.host, port: opts.port, secure: opts.secure,
    auth: { user: opts.user, pass: opts.pass },
    connectionTimeout: 20000, greetingTimeout: 15000,
  });
  const mail: Record<string, unknown> = {
    from: `${opts.fromName} <${opts.user}>`,
    to: opts.to, subject: opts.subject, html: opts.html, replyTo: opts.user,
  };
  if (opts.cvBytes && opts.cvName) {
    mail.attachments = [{ filename: opts.cvName, content: opts.cvBytes }];
  }
  await transporter.sendMail(mail);
}

// ── الدورة الرئيسية ───────────────────────────────────────────────────────────

type Detail = { user: string; job: string; status: "sent" | "skipped" | "error"; reason?: string };

async function runCycle() {
  const t0      = Date.now();
  const errors: string[]  = [];
  const details: Detail[] = [];
  let applied = 0, activeUsers = 0;

  if (!ENC_KEY_HEX) return { applied: 0, users: 0, errors: ["SMTP_ENCRYPTION_KEY غير معرّف"], details: [] };

  // ── الخطوة 1: تصنيف الوظائف الجديدة ─────────────────────────────────────
  const classified = await classifyPendingJobs();
  if (classified) console.log(`[worker] 🏷️ صُنِّفت ${classified} وظيفة جديدة`);

  // ── الخطوة 2: جلب الوظائف الجاهزة (مصنفة + فعالة + نوع "job") ────────────
  const allJobs = await sbGet("admin_jobs", {
    is_active:     "eq.true",
    is_classified: "eq.true",
    job_type:      "eq.job",
    order:         "created_at.desc",
    limit:         "500",
  });

  const validJobs = allJobs.filter(j => EMAIL_RE.test(String(j.application_email ?? "").trim()));
  console.log(`[worker] 📋 وظائف جاهزة: ${validJobs.length}`);
  if (!validJobs.length) return { applied: 0, users: 0, errors: [], details: [] };

  // ── الخطوة 3: جلب المستخدمين النشطين ─────────────────────────────────────
  const now   = new Date().toISOString();
  const today = now.split("T")[0];
  const users = await sbGet("users", { subscription_ends_at: `gt.${now}` });

  // عدد تقديمات اليوم لكل مستخدم
  const todayCounts = await Promise.all(
    users.map(u => sbCount("applications", {
      user_id:    `eq.${u.id}`,
      applied_at: `gte.${today}`,
      status:     "eq.sent",
    }))
  );

  // ترتيب: الأقل تقديماً أولاً، تجاهل من وصل للحد
  const queue = users
    .map((user, i) => ({ user, today: todayCounts[i] }))
    .filter(x => x.today < MAX_PER_DAY)
    .sort((a, b) => a.today - b.today)
    .slice(0, MAX_USERS_PER_RUN);

  // جلب تخصصات الوظائف مرة واحدة
  const fieldsRaw = await sbGet("job_fields");
  const thirtyAgo = new Date(Date.now() - DEDUP_DAYS * 86400000).toISOString();

  // ── الخطوة 4: معالجة كل مستخدم ──────────────────────────────────────────
  for (const { user, today: countToday } of queue) {
    const uid    = String(user.id);
    const name   = String(user.full_name ?? "المتقدم");
    const gender = String(user.gender ?? "male");
    const phone  = String(user.phone ?? "");

    // جلب بيانات المستخدم
    const [settingsRows, cvRows, prefsRows] = await Promise.all([
      sbGet("user_settings",        { user_id: `eq.${uid}` }),
      sbGet("user_cvs",             { user_id: `eq.${uid}` }),
      sbGet("user_job_preferences", { user_id: `eq.${uid}` }),
    ]);

    const settings = settingsRows[0] ?? {};
    const cv       = cvRows[0];

    // ── فحص المتطلبات ────────────────────────────────────────────────────
    if (!cv) {
      details.push({ user: name, job: "—", status: "skipped", reason: "لا توجد سيرة ذاتية" });
      continue;
    }

    const smtpEmail   = String(settings.smtp_email ?? "").trim();
    const encryptedPw = String(settings.smtp_app_password_encrypted ?? "").trim();
    const hasSmtp     = !!(settings.email_connected && smtpEmail && encryptedPw);

    if (!smtpEmail) {
      details.push({ user: name, job: "—", status: "skipped", reason: "لم يُضف إيميله" });
      continue;
    }
    if (!hasSmtp) {
      details.push({ user: name, job: "—", status: "skipped", reason: "لم يربط Gmail App Password" });
      continue;
    }

    // فك تشفير كلمة مرور SMTP
    let appPassword: string;
    try {
      appPassword = await decryptAES(encryptedPw, ENC_KEY_HEX);
    } catch {
      errors.push(`${name}: فشل فك التشفير`);
      continue;
    }

    // تخصصات المستخدم
    const prefIds    = new Set(prefsRows.map(p => String(p.job_field_id)));
    const userFields = fieldsRaw
      .filter(f => prefIds.has(String(f.id)))
      .map(f => String(f.name_ar ?? f.name_en ?? ""));

    // التقديمات السابقة (30 يوم) لمنع التكرار
    const recentApps = await sbGet<{ job_id: string; job_fingerprint: string }>(
      "applications",
      { user_id: `eq.${uid}`, applied_at: `gte.${thirtyAgo}` },
      "job_id,job_fingerprint",
    );
    const usedIds = new Set(recentApps.map(a => String(a.job_id)));
    const usedFps = new Set(recentApps.map(a => String(a.job_fingerprint ?? "")).filter(Boolean));

    // تحميل السيرة الذاتية
    const cvPath  = String(cv.storage_path ?? "").trim();
    const cvName  = String(cv.file_name ?? "cv.pdf");
    const cvBytes = cvPath ? await downloadCv(cvPath) : null;

    const smtpHost   = String(settings.smtp_host   ?? "smtp.gmail.com");
    const smtpPort   = Number(settings.smtp_port   ?? 465);
    const smtpSecure = settings.smtp_secure !== false;
    const savedBody  = String(settings.cover_letter_body ?? "").trim() || undefined;

    const remaining = MAX_PER_DAY - countToday;
    let sent = 0;
    activeUsers++;

    // ── الخطوة 5: فلترة وإرسال ───────────────────────────────────────────
    for (const job of validJobs) {
      if (sent >= remaining) break;

      const jobId    = String(job.id);
      const jobTitle = String(job.title_ar ?? job.title_en ?? "وظيفة");
      const company  = String(job.company ?? "").trim();
      const toEmail  = String(job.application_email ?? "").trim();
      const genderReq = String(job.gender_req ?? "unknown");
      const majors    = Array.isArray(job.mapped_majors) ? (job.mapped_majors as string[]) : [];

      // منع التكرار (job_id + fingerprint)
      const fp = await makeFingerprint(jobTitle, company, toEmail);
      if (usedIds.has(jobId) || usedFps.has(fp)) continue;

      // فحص الجنس
      if (!genderMatches(gender, genderReq)) {
        // نسجل مرة واحدة حتى لا يتكرر الفحص
        await sbInsert("applications", {
          user_id: uid, job_id: jobId, job_title: jobTitle,
          applied_at: new Date().toISOString(),
          status: "skipped", application_status: "invalid",
          hidden_from_user: true,
          skip_reason: `تعارض جنس: الوظيفة تطلب ${genderReq}`,
          job_fingerprint: fp,
        });
        usedIds.add(jobId);
        usedFps.add(fp);
        continue;
      }

      // فحص التخصص
      if (!majorMatches(userFields, majors)) continue;

      // ── إرسال التقديم ─────────────────────────────────────────────────
      const sentAt  = new Date().toISOString();
      const subject = `التقديم على وظيفة: ${jobTitle}`;
      const cover   = buildCoverLetter(name, jobTitle, company, phone, smtpEmail, savedBody);

      try {
        await sendSmtp({
          host: smtpHost, port: smtpPort, secure: smtpSecure,
          user: smtpEmail, pass: appPassword, fromName: name,
          to: toEmail, subject, html: cover,
          cvBytes: cvBytes ?? undefined, cvName,
        });

        await sbInsert("applications", {
          user_id: uid, job_id: jobId, job_title: jobTitle,
          applied_at: sentAt, status: "sent",
          application_status: "applied", hidden_from_user: false,
          sent_at: sentAt, job_fingerprint: fp, provider_used: "smtp",
        });

        usedIds.add(jobId);
        usedFps.add(fp);
        sent++; applied++;
        details.push({ user: name, job: jobTitle, status: "sent" });
        console.log(`[worker] ✅ ${name} → ${jobTitle} (${toEmail})`);

        await new Promise(r => setTimeout(r, 4000));

      } catch (e) {
        const msg = String(e).slice(0, 250);
        errors.push(`${name} → ${jobTitle}: ${msg}`);
        details.push({ user: name, job: jobTitle, status: "error", reason: msg });
        console.error(`[worker] ❌ ${name} → ${jobTitle}: ${msg}`);
        // خطأ مصادقة → لا فائدة من متابعة هذا المستخدم
        if (msg.toLowerCase().includes("535") || msg.includes("534") || msg.includes("password") || msg.includes("credentials")) {
          console.warn(`[worker] ⏩ تخطي ${name} — خطأ مصادقة SMTP`);
          break;
        }
      }
    }

    if (sent > 0) console.log(`[worker] 👤 ${name}: ${sent} تقديم`);
  }

  const durationMs = Date.now() - t0;
  return { applied, users: activeUsers, errors, details, durationMs };
}

// ── Telegram (Admin) ──────────────────────────────────────────────────────────

async function tgSend(text: string) {
  if (!TG_BOT || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "HTML" }),
    });
  } catch { /* silent */ }
}

// ── نشر القناة ────────────────────────────────────────────────────────────────

const PROMO_MESSAGES = [
  `💡 <b>تعرف وش يسوي بوت Jobbots؟</b>\n\nيقدّم عنك على الوظائف كل نص ساعة تلقائي\nبدون ما تفتح أي موقع أو تكتب ولا إيميل واحد!\n\n🎯 ارفع سيرتك مرة وخلّ البوت يشتغل عنك\n\n👇 اشترك الحين\nhttps://www.jobbots.org/store`,
  `⏰ <b>وقتك غالي!</b>\n\nوانت تتصفح وظيفة وحدة، بوت Jobbots يرسل عشرات الطلبات عنك\n\n✅ ذكاء اصطناعي يكتب رسالة مخصصة لكل وظيفة\n✅ تقديم تلقائي طول اليوم\n✅ يراقب وظائف جديدة كل 30 دقيقة\n\n👇 ابدأ الحين\nhttps://www.jobbots.org/store`,
  `🏆 <b>ليش Jobbots؟</b>\n\nلأن التقديم اليدوي يأكل ساعات من يومك\nوالبوت يسويها في دقائق — كل يوم، بدون ما توقفه\n\n📊 مشتركينا يحصلون على 10 تقديمات يومياً تلقائي\n\n👇 جرّبه الحين\nhttps://www.jobbots.org/store`,
  `📢 <b>قناة وظائف Jobbots</b>\n\nنجمع أحسن الوظائف من مئات المصادر لحظة بلحظة\nوبوتنا يقدّم عليها تلقائي باسمك\n\n🔔 فعّل الإشعارات وتوصلك الوظائف على طول ما تنزل\n\n👇 اشترك في الخدمة\nhttps://www.jobbots.org/store`,
];

async function tgChannelPost(text: string): Promise<number | null> {
  if (!TG_BOT || !TG_JOB_CH) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_JOB_CH, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const d = await r.json();
    return d?.result?.message_id ?? null;
  } catch { return null; }
}

async function publishJobToChannel(): Promise<boolean> {
  if (!TG_BOT || !TG_JOB_CH) return false;

  const jobs = await sbGet("admin_jobs", {
    is_active:         "eq.true",
    tg_message_id:     "is.null",
    application_email: "not.is.null",
    order:             "created_at.asc",
    limit:             "1",
  }, "id,title_ar,company,description_ar,application_email,link_url");

  if (!jobs.length) { console.log("[channel] لا وظائف جديدة لنشرها"); return false; }

  const job     = jobs[0];
  const title   = String(job.title_ar ?? "وظيفة شاغرة").trim();
  const company = String(job.company  ?? "").trim();
  const email   = String(job.application_email ?? "").trim();
  const desc    = String(job.description_ar    ?? "").slice(0, 300).trim();
  const link    = String(job.link_url          ?? "").trim();

  const lines: string[] = [`🚀 <b>وظيفة جديدة — ${title}</b>`];
  if (company) lines.push(`🏢 <b>الجهة:</b> ${company}`);
  lines.push("");
  if (desc) { lines.push(desc); lines.push(""); }
  if (email) { lines.push("📧 <b>البريد للتقديم:</b>"); lines.push(email); lines.push(""); }
  if (link)  { lines.push(`🔗 ${link}`); lines.push(""); }
  lines.push("🤖 <b>قدّم تلقائياً على عشرات الوظائف يومياً بالذكاء الاصطناعي:</b>");
  lines.push("https://www.jobbots.org/store");

  const msgId = await tgChannelPost(lines.join("\n"));
  if (!msgId) return false;

  await sbPatch("admin_jobs", { id: `eq.${job.id}` }, { tg_message_id: msgId });
  console.log(`[channel] ✅ نُشرت: "${title}" (msg_id=${msgId})`);
  return true;
}

async function publishPromoIfDue(): Promise<void> {
  if (!TG_BOT || !TG_JOB_CH) return;

  // فحص آخر رسالة دعائية
  const last = await sbGet("worker_logs", {
    status: "eq.channel_promo",
    order:  "ran_at.desc",
    limit:  "1",
  }, "ran_at");

  const lastAt  = last[0] ? new Date(String(last[0].ran_at)).getTime() : 0;
  const minsAgo = (Date.now() - lastAt) / 60000;
  if (minsAgo < 58) {
    console.log(`[channel] دعاية: آخر واحدة قبل ${Math.round(minsAgo)} دقيقة — تأجيل`);
    return;
  }

  // اختيار رسالة دورية بناءً على العدد الإجمالي
  const allCount = await sbCount("worker_logs", { status: "eq.channel_promo" });
  const text     = PROMO_MESSAGES[allCount % PROMO_MESSAGES.length];

  const msgId = await tgChannelPost(text);
  if (msgId) {
    await fetch(`${SUPABASE_URL}/rest/v1/worker_logs`, {
      method: "POST",
      headers: { ...SB, Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "channel_promo", applied_count: 0, active_users: 0,
        errors: "[]", duration_ms: 0, ran_at: new Date().toISOString(),
      }),
    });
    console.log(`[channel] ✅ دعاية #${allCount + 1} نُشرت`);
  }
}

// ── HTTP Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization" } });
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (WORKER_SECRET && auth !== `Bearer ${WORKER_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const t0 = Date.now();
  console.log("[worker] 🚀 بدء الدورة —", new Date().toISOString());

  try {
    // ── نشر وظيفة في القناة ───────────────────────────────────────────────
    await publishJobToChannel();

    const result = await runCycle();

    // ── نشر دعاية إذا حان وقتها (بعد دورة التقديم = فاصل طبيعي) ──────────
    await publishPromoIfDue();
    const dur = Math.round((result.durationMs ?? (Date.now() - t0)) / 1000);

    // ملخص Telegram
    if (result.applied > 0 || result.errors.length > 0) {
      const sentLines = (result.details as Detail[])
        .filter(d => d.status === "sent")
        .map(d => `  ✅ ${d.user} ← ${d.job}`)
        .slice(0, 20);
      const errLines = (result.errors as string[]).slice(0, 5).map(e => `  ⚠️ ${e.slice(0, 80)}`);

      let msg = `🤖 <b>Worker اكتمل</b>\nتقديمات: <b>${result.applied}</b> | مستخدمين: ${result.users} | ${dur}ث`;
      if (sentLines.length) msg += `\n\n<b>قُدِّم بنجاح:</b>\n${sentLines.join("\n")}`;
      if (errLines.length)  msg += `\n\n<b>أخطاء:</b>\n${errLines.join("\n")}`;
      await tgSend(msg);
    }

    // تسجيل في worker_logs
    await fetch(`${SUPABASE_URL}/rest/v1/worker_logs`, {
      method: "POST", headers: { ...SB, Prefer: "return=minimal" },
      body: JSON.stringify({
        applied_count: result.applied, active_users: result.users,
        errors: JSON.stringify(result.errors ?? []),
        duration_ms: Date.now() - t0,
        status: (result.errors?.length ?? 0) > 0 ? "partial" : "ok",
        ran_at: new Date().toISOString(),
      }),
    });

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    console.error("[worker] 💥 خطأ عام:", e);
    await tgSend(`💥 <b>Worker — خطأ عام</b>\n${String(e).slice(0, 300)}`);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
