// Supabase Edge Function — Auto Apply Worker
// يعمل تلقائياً كل 30 دقيقة عبر pg_cron — مستقل تماماً عن Replit
// الإرسال عبر SMTP الشخصي لكل مستخدم

import nodemailer from "npm:nodemailer@6";
import { Buffer } from "node:buffer";

const SUPABASE_URL    = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SUPABASE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_KEY      = Deno.env.get("GEMINI_API_KEY") ?? "";
const WORKER_SECRET   = Deno.env.get("WORKER_SECRET") ?? "";
const ENC_KEY_HEX     = Deno.env.get("SMTP_ENCRYPTION_KEY") ?? "";
const TG_BOT          = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT         = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
const RESEND_API_KEY  = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM     = Deno.env.get("RESEND_FROM_EMAIL") ?? "";
const RESEND_NAME     = Deno.env.get("RESEND_FROM_NAME") ?? "Jobbots";

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

async function sbPatch(table: string, filter: Record<string, string>, data: Record<string, unknown>) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(filter)) url.searchParams.set(k, v);
  await fetch(url.toString(), {
    method: "PATCH", headers: SB, body: JSON.stringify(data),
  });
}

// ─── AES-256-GCM فك التشفير (Web Crypto) ─────────────────────────────────────

async function decryptAES(encrypted: string, keyHex: string): Promise<string> {
  const parts = encrypted.split(":");
  if (parts.length !== 2) throw new Error("تنسيق التشفير غير صحيح");
  const keyBytes  = new Uint8Array(keyHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const iv        = Uint8Array.from(atob(parts[0]), (c) => c.charCodeAt(0));
  const rawData   = Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0));

  // Node.js يخزّن: [tag(16 بايت) + ciphertext]
  // Web Crypto يتوقع: [ciphertext + tag(16 بايت)] — نعكس الترتيب
  const tag        = rawData.slice(0, 16);
  const ciphertext = rawData.slice(16);
  const data       = new Uint8Array([...ciphertext, ...tag]);

  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
  return new TextDecoder().decode(plain);
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

// ─── كشف الوظائف المؤنثة ────────────────────────────────────────────────────

const NEUTRAL_ENDINGS_AR = new Set([
  "شركة", "جهة", "وظيفة", "خبرة", "صناعة", "هندسة", "تجربة", "مجموعة",
  "ممارسة", "خدمة", "برمجة", "إدارة", "رعاية", "رياضة", "تجارة", "علاقة",
  "مهارة", "سلامة", "قيادة", "محاسبة", "مالية", "تقنية", "سياحة", "صحة",
  "جودة", "موارد", "ممارسة", "بيئة", "سياسة", "طاقة", "زراعة", "هندسة",
  "حوكمة", "ريادة", "مقابلة", "وساطة", "رقابة", "متابعة", "مراجعة", "مراقبة",
]);

function isFeminineJob(job: Record<string, unknown>): boolean {
  const titleAr = String(job.title_ar ?? "").trim();
  const desc    = String(job.description_ar ?? "").toLowerCase();
  const spec    = String(job.specializations ?? "").toLowerCase();

  if (titleAr.includes("نسائية") || desc.includes("نسائية") ||
      titleAr.includes("للإناث") || desc.includes("للإناث") ||
      spec.includes("نسائية")) return true;

  const words = titleAr.split(/[\s,،\/\-()]+/).filter(Boolean);
  for (const w of words) {
    if (w.length > 3 && w.endsWith("ة") && !NEUTRAL_ENDINGS_AR.has(w)) return true;
  }
  return false;
}

function jobMatchesUser(job: Record<string, unknown>, fieldNames: string[]): boolean {
  if (!fieldNames.length) return false;

  const spec    = String(job.specializations ?? "").toLowerCase().trim();
  const titleAr = String(job.title_ar ?? "").toLowerCase();
  const titleEn = String(job.title_en ?? "").toLowerCase();
  const descAr  = String(job.description_ar ?? "").toLowerCase();
  const descEn  = String(job.description_en ?? "").toLowerCase();

  // 1. إذا كان حقل التخصصات معبأً — نطابق فقط معه ونرفض إذا لم يتطابق
  if (spec) {
    for (const name of fieldNames) {
      const n = (name ?? "").trim().toLowerCase();
      if (n && spec.includes(n)) return true;
    }
    return false; // الوظيفة لها تصنيف واضح لا يناسب المستخدم
  }

  // 2. لا يوجد تخصص — نطابق مع العنوان فقط (أكثر موثوقية من الوصف)
  const titleBlob = `${titleAr} ${titleEn}`;
  for (const name of fieldNames) {
    const n = (name ?? "").trim().toLowerCase();
    if (n && titleBlob.includes(n)) return true;
  }

  // 3. ملاذ أخير: الوصف مع معايير صارمة (كلمات 6+ أحرف، 3+ تطابقات)
  const descBlob = `${descAr} ${descEn}`;
  const words = new Set<string>();
  for (const name of fieldNames)
    for (const w of (name ?? "").toLowerCase().split(/[\s\-/_,()]+/))
      if (w.trim().length >= 6) words.add(w.trim());
  if (words.size < 2) return false;
  return [...words].filter((w) => descBlob.includes(w)).length >= 3;
}

// ─── CV Download ──────────────────────────────────────────────────────────────

async function downloadCv(storagePath: string): Promise<Uint8Array | null> {
  const url = `${SUPABASE_URL}/storage/v1/object/cvs/${storagePath}`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) return null;
  return new Uint8Array(await r.arrayBuffer());
}

// ─── تحليل السيرة الذاتية وتخزينها (مرة واحدة فقط) ─────────────────────────

async function parseCvWithAI(cvBytes: Uint8Array, cvMime: string): Promise<string | null> {
  if (!GEMINI_KEY || !cvBytes.length) return null;
  const prompt =
    "استخرج من هذه السيرة الذاتية المعلومات التالية بشكل منظّم ومختصر بالعربية:\n" +
    "المؤهل العلمي والتخصص:\n" +
    "سنوات الخبرة الإجمالية:\n" +
    "الوظائف السابقة (مسمى + جهة + مدة):\n" +
    "المهارات التقنية والبرامج:\n" +
    "الشهادات والرخص المهنية:\n" +
    "اللغات:\n" +
    "اكتب فقط المعلومات الموجودة فعلاً. لا تضف تخمينات. إذا لم تجد معلومة اكتب (غير محدد).";
  const parts = [
    { inline_data: { mime_type: cvMime, data: toBase64(cvBytes) } },
    { text: prompt },
  ];
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }] }) }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    return text || null;
  } catch { return null; }
}

async function getOrParseCv(cv: Record<string, unknown>): Promise<{ parsedText: string | null; cvBytes: Uint8Array | null }> {
  const cvId        = String(cv.id ?? "");
  const storagePath = String(cv.storage_path ?? "").trim();
  const cvName      = String(cv.file_name ?? "cv.pdf");
  const cvMime      = cvName.toLowerCase().endsWith(".pdf") ? "application/pdf"
    : cvName.toLowerCase().endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/octet-stream";

  // إذا يوجد نص محفوظ بالفعل — استخدمه مباشرة بدون تنزيل PDF
  const existingText = String(cv.cv_parsed_text ?? "").trim();
  if (existingText) {
    return { parsedText: existingText, cvBytes: null };
  }

  // تنزيل الـ PDF وتحليله
  const cvBytes = storagePath ? await downloadCv(storagePath) : null;
  if (!cvBytes) return { parsedText: null, cvBytes: null };

  const parsedText = await parseCvWithAI(cvBytes, cvMime);
  if (parsedText && cvId) {
    // حفظ الملخص في قاعدة البيانات لاستخدامه مستقبلاً
    await sbPatch("user_cvs", { id: `eq.${cvId}` }, {
      cv_parsed_text: parsedText,
      cv_parsed_at: new Date().toISOString(),
    });
    console.log(`[worker] 💾 حُفظ ملخص السيرة الذاتية للـ cv_id=${cvId}`);
  }

  return { parsedText, cvBytes };
}

// ─── Gemini Cover Letter ──────────────────────────────────────────────────────

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function generateCoverLetter(
  jobTitle: string, name: string, company: string, desc: string, lang: string,
  cvParsedText?: string | null,
): Promise<string> {
  const fallback = lang === "ar"
    ? `أتقدم بكل اهتمام لشغل وظيفة ${jobTitle}${company ? " في " + company : ""}. أنا مهتم بهذه الفرصة وأثق في قدرتي على إضافة قيمة حقيقية لفريقكم.`
    : `I am writing to express my interest in the ${jobTitle} position${company ? " at " + company : ""}. I am confident in my ability to contribute effectively to your team.`;
  if (!GEMINI_KEY) return fallback;

  const noHallucinate = lang === "ar"
    ? "تحذير صارم: لا تذكر أي أرقام أو سنوات خبرة أو برامج أو مهارات تقنية محددة غير موجودة في ملخص السيرة الذاتية أدناه. إذا لم تجد خبرة مباشرة بالوظيفة، اذكر المؤهل العلمي والاهتمام بالفرصة فقط دون اختراع معلومات."
    : "Strict warning: Do not mention any specific years of experience, software, or technical skills not present in the CV summary below. If no direct experience is found, mention the degree and enthusiasm only.";

  const hasCv = !!(cvParsedText?.trim());

  const cvBlock = hasCv
    ? (lang === "ar" ? `\n\n--- ملخص السيرة الذاتية ---\n${cvParsedText}\n---` : `\n\n--- CV Summary ---\n${cvParsedText}\n---`)
    : "";

  const prompt = hasCv
    ? (lang === "ar"
        ? `بناءً على ملخص السيرة الذاتية التالي، اكتب رسالة تغطية رسمية بالعربية (3-4 جمل) للتقديم على وظيفة: ${jobTitle}${company ? " في شركة " + company : ""}${desc ? ". تفاصيل الوظيفة: " + desc.slice(0, 400) : ""}. اسم المتقدم: ${name}. الأسلوب: رسمي، ابدأ بالتعريف بالنفس والمؤهل ثم اذكر خبرات أو مهارات موجودة فعلاً في الملخص تتناسب مع الوظيفة. بدون إيموجي، النص فقط بدون عنوان أو تحية. ${noHallucinate}${cvBlock}`
        : `Based on the following CV summary, write a formal cover letter in English (3-4 sentences) for the position: ${jobTitle}${company ? " at " + company : ""}${desc ? ". Job details: " + desc.slice(0, 400) : ""}. Applicant: ${name}. Style: professional — introduce yourself with your actual qualification, cite only experience or skills clearly present in the summary. No emoji, plain text only. ${noHallucinate}${cvBlock}`)
    : (lang === "ar"
        ? `اكتب رسالة تغطية مختصرة (3-4 جمل) بالعربية للتقديم على وظيفة: ${jobTitle}${company ? " في شركة " + company : ""}${desc ? ". تفاصيل الوظيفة: " + desc.slice(0, 400) : ""}. الاسم: ${name}. اكتب بأسلوب رسمي يُبدي الاهتمام والاستعداد. بدون إيموجي. النص فقط.`
        : `Write a brief cover letter (3-4 sentences) in English for the position: ${jobTitle}${company ? " at " + company : ""}${desc ? ". Job details: " + desc.slice(0, 400) : ""}. Applicant: ${name}. Professional tone, express interest. No emoji, plain text only.`);

  const parts: unknown[] = [{ text: prompt }];

  const MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ];

  for (const model of MODELS) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts }] }),
        }
      );
      if (r.status === 429 || r.status === 503 || r.status === 404) continue;
      if (!r.ok) continue;
      const data = await r.json();
      const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
      if (text) return text;
    } catch { continue; }
  }
  return fallback;
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

// ─── إرسال عبر SMTP الشخصي ────────────────────────────────────────────────────

async function sendSmtp(opts: {
  smtpHost: string; smtpPort: number; smtpSecure: boolean;
  smtpEmail: string; appPassword: string;
  to: string; subject: string; html: string;
  fromName: string; cvBytes?: Uint8Array | null; cvName?: string;
}): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: opts.smtpHost,
    port: opts.smtpPort,
    secure: opts.smtpSecure,
    auth: { user: opts.smtpEmail, pass: opts.appPassword },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
  });

  const mailOptions: Record<string, unknown> = {
    from: `${opts.fromName} <${opts.smtpEmail}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.smtpEmail,
  };

  if (opts.cvBytes && opts.cvName) {
    mailOptions.attachments = [{
      filename: opts.cvName,
      content: Buffer.from(opts.cvBytes),
    }];
  }

  await transporter.sendMail(mailOptions);
}

// ─── Resend (فولباك للمستخدمين بدون SMTP) ────────────────────────────────────

async function sendViaResend(opts: {
  fromName: string; userEmail: string;
  to: string; subject: string; html: string;
  cvBytes?: Uint8Array | null; cvName?: string;
}): Promise<void> {
  if (!RESEND_API_KEY || !RESEND_FROM) throw new Error("Resend غير مكوّن في Supabase Secrets");

  const body: Record<string, unknown> = {
    from: `${RESEND_NAME} <${RESEND_FROM}>`,
    reply_to: opts.userEmail,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  };

  if (opts.cvBytes && opts.cvName) {
    body.attachments = [{
      filename: opts.cvName,
      content: toBase64(opts.cvBytes),
    }];
  }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Resend error ${r.status}: ${err.slice(0, 200)}`);
  }
}

// ─── Main Cycle ───────────────────────────────────────────────────────────────

type Detail = { user: string; job: string; status: "sent" | "skipped" | "error"; reason?: string };

async function runCycle() {
  const errors: string[] = [];
  const details: Detail[] = [];
  let applied = 0, activeUsers = 0;

  if (!ENC_KEY_HEX) {
    return { applied: 0, users: 0, errors: ["SMTP_ENCRYPTION_KEY غير معرّف في Supabase Secrets"], details: [] };
  }

  const jobsRaw = await sbGet("admin_jobs", { is_active: "eq.true" });
  const jobs = jobsRaw.filter((j) => isValidEmail(String(j.application_email ?? "").trim()));
  if (!jobs.length) return { applied: 0, users: 0, errors: [], details: [] };

  const [usersRaw, fieldsRaw] = await Promise.all([sbGet("users"), sbGet("job_fields")]);

  const today = new Date().toISOString().split("T")[0];

  // جمع عدد تقديمات اليوم لكل مستخدم ثم ترتيبهم تصاعدياً (الأقل تقديماً أولاً) لضمان العدالة
  const usersWithCount: Array<{ user: Record<string, unknown>; countToday: number }> = [];
  for (const u of usersRaw) {
    if (!isActiveSubscription(u)) continue;
    const uid = String(u.id);
    const countToday = await sbCount("applications", { user_id: `eq.${uid}`, applied_at: `gte.${today}` });
    usersWithCount.push({ user: u, countToday });
  }
  // ترتيب: الأقل تقديماً اليوم أولاً، ثم عشوائي داخل نفس العدد
  usersWithCount.sort((a, b) => a.countToday - b.countToday || (Math.random() - 0.5));

  // حد 3 تقديمات لكل مستخدم في كل دورة لضمان وصول كل المستخدمين
  const MAX_PER_CYCLE = 3;

  for (const { user, countToday } of usersWithCount) {
    if (countToday >= 10) continue;
    activeUsers++;

    const uid = String(user.id);

    const [settingsRows, cvRows, prefsRows] = await Promise.all([
      sbGet("user_settings",        { user_id: `eq.${uid}` }),
      sbGet("user_cvs",             { user_id: `eq.${uid}` }),
      sbGet("user_job_preferences", { user_id: `eq.${uid}` }),
    ]);

    const settings = settingsRows[0] ?? {};

    // تحديد وسيلة الإرسال: SMTP الشخصي أو Resend (فولباك)
    const smtpEmail   = String(settings.smtp_email ?? "").trim();
    const smtpHost    = String(settings.smtp_host  ?? "smtp.gmail.com");
    const smtpPort    = Number(settings.smtp_port  ?? 465);
    const smtpSecure  = settings.smtp_secure !== false;
    const encryptedPw = String(settings.smtp_app_password_encrypted ?? "").trim();
    const hasSmtp     = !!(settings.email_connected && smtpEmail && encryptedPw);
    const hasResend   = !!(smtpEmail && RESEND_API_KEY && RESEND_FROM);

    if (!hasSmtp && !hasResend) {
      details.push({ user: String(user.full_name ?? uid), job: "—", status: "skipped", reason: "لا توجد وسيلة إرسال (لا SMTP ولا إيميل)" });
      continue;
    }
    if (!smtpEmail) {
      details.push({ user: String(user.full_name ?? uid), job: "—", status: "skipped", reason: "لم يُضف إيميله بعد" });
      continue;
    }

    let appPassword = "";
    if (hasSmtp) {
      try {
        appPassword = await decryptAES(encryptedPw, ENC_KEY_HEX);
      } catch (e) {
        errors.push(`${String(user.full_name ?? uid)}: فشل فك التشفير — ${String(e)}`);
        continue;
      }
    }

    const cv = cvRows[0];
    if (!cv) {
      details.push({ user: String(user.full_name ?? uid), job: "—", status: "skipped", reason: "لا توجد سيرة ذاتية" });
      continue;
    }

    // تحليل السيرة الذاتية مرة واحدة وتخزينها — الدورات التالية تستخدم النص المحفوظ
    const cvName = String(cv.file_name ?? "cv.pdf");
    const { parsedText: cvParsedText, cvBytes } = await getOrParseCv(cv);

    const prefIds    = new Set(prefsRows.map((p) => String(p.job_field_id)).filter(Boolean));
    const fieldNames = fieldsRaw
      .filter((f) => prefIds.has(String(f.id)))
      .map((f) => String(f.name_ar ?? f.name_en ?? ""));

    const name      = String(user.full_name ?? "المتقدم");
    const phone     = String(user.phone ?? "");
    const lang      = String(settings.application_language ?? "ar");
    // حد اليوم (10) مع حد الدورة الواحدة (MAX_PER_CYCLE) لضمان العدالة بين المستخدمين
    const remaining = Math.min(MAX_PER_CYCLE, 10 - countToday);
    let sent = 0;

    for (const job of jobs) {
      if (sent >= remaining) break;

      const jobId = String(job.id);
      const already = await sbCount("applications", { user_id: `eq.${uid}`, job_id: `eq.${jobId}`, status: "eq.sent" });
      if (already > 0) {
        details.push({ user: name, job: String(job.title_ar ?? job.title_en ?? ""), status: "skipped", reason: "قُدِّم سابقاً" });
        continue;
      }
      if (!jobMatchesUser(job, fieldNames)) {
        details.push({ user: name, job: String(job.title_ar ?? job.title_en ?? ""), status: "skipped", reason: "لا يطابق التفضيلات" });
        continue;
      }

      const userGender = String(user.gender ?? "male");
      if (userGender === "male" && isFeminineJob(job)) {
        details.push({ user: name, job: String(job.title_ar ?? job.title_en ?? ""), status: "skipped", reason: "وظيفة نسائية — المستخدم ذكر" });
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
        let cover = await generateCoverLetter(jobTitle, name, company, desc, lang, cvParsedText);
        cover = stripEmojis(cover);
        const html    = buildEmailHtml(name, phone, jobTitle, company, cover, lang);
        const subject = lang === "ar"
          ? `التقديم على وظيفة: ${stripEmojis(jobTitle)}`
          : `Application for: ${stripEmojis(jobTitle)}`;

        if (hasSmtp) {
          await sendSmtp({
            smtpHost, smtpPort, smtpSecure, smtpEmail, appPassword,
            to: toEmail, subject, html, fromName: name, cvBytes, cvName,
          });
        } else {
          // Resend فولباك — يرسل من إيميل المنصة مع Reply-To للمتقدم
          await sendViaResend({
            fromName: name, userEmail: smtpEmail,
            to: toEmail, subject, html, cvBytes, cvName,
          });
        }

        sent++; applied++;
        details.push({ user: name, job: jobTitle, status: "sent" });
        console.log(`[worker] ✅ ${name} → ${jobTitle} (${toEmail})`);

        await new Promise((r) => setTimeout(r, 5000));
      } catch (e) {
        status = "error";
        errorReason = String(e).slice(0, 500);
        errors.push(`${name} → ${jobTitle}: ${errorReason}`);
        details.push({ user: name, job: jobTitle, status: "error", reason: errorReason });
        console.error(`[worker] ❌ ${name} → ${jobTitle}: ${errorReason}`);
      }

      await sbInsert("applications", {
        user_id: uid, job_id: jobId, job_title: jobTitle,
        applied_at: sentAt, status, provider_used: "smtp",
        error_reason: errorReason, sent_at: status === "sent" ? sentAt : null,
      });
    }
  }

  return { applied, users: activeUsers, errors, details };
}

// ─── Telegram Notification ────────────────────────────────────────────────────

async function tgSend(text: string) {
  if (!TG_BOT || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "HTML" }),
    });
  } catch { /* silent */ }
}

function nowAr(): string {
  return new Date().toLocaleString("ar-SA", {
    timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

async function tgWorkerResult(
  applied: number, users: number, durationSec: number,
  details: Array<{ user: string; job: string; status: string; reason?: string }>
) {
  const successLines = details
    .filter(d => d.status === "sent")
    .map(d => `  ✅ ${d.user} ← ${d.job}`);
  const errorLines = details
    .filter(d => d.status === "error")
    .map(d => `  ⚠️ ${d.user} → ${d.job}: ${(d.reason ?? "خطأ").slice(0, 80)}`);

  if (applied === 0 && errorLines.length === 0) return; // لا شيء يستحق الإشعار

  let msg =
    `🤖 <b>Worker اكتمل</b>\n` +
    `التقديمات: ${applied} | المستفيدون: ${users} | المدة: ${durationSec}ث\n`;

  if (successLines.length) {
    msg += `\n<b>قُدِّم بنجاح:</b>\n` + successLines.slice(0, 15).join("\n");
    if (successLines.length > 15) msg += `\n  ... و${successLines.length - 15} أخرى`;
  }
  if (errorLines.length) {
    msg += `\n\n<b>أخطاء في الإرسال:</b>\n` + errorLines.slice(0, 8).join("\n");
  }
  msg += `\n🕐 ${nowAr()}`;
  await tgSend(msg);
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

  console.log("[worker] بدء دورة التقديم التلقائي عبر SMTP");
  const t0 = Date.now();
  try {
    const result = await runCycle();
    const duration_ms = Date.now() - t0;
    const status = result.errors.length === 0 ? "success" : result.applied > 0 ? "partial" : "error";
    await logRun({ applied_count: result.applied, active_users: result.users, errors: result.errors, duration_ms, status });
    console.log("[worker] انتهت الدورة:", JSON.stringify({ applied: result.applied, users: result.users, errors: result.errors.length }));
    await tgWorkerResult(result.applied, result.users, Math.round(duration_ms / 1000), result.details);
    return new Response(JSON.stringify({ ok: true, ...result, duration_ms }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const duration_ms = Date.now() - t0;
    await logRun({ applied_count: 0, active_users: 0, errors: [String(e)], duration_ms, status: "error" });
    console.error("[worker] خطأ:", e);
    await tgSend(`🚨 <b>Worker — خطأ فادح</b>\nالخطأ: ${String(e).slice(0, 300)}\n🕐 ${nowAr()}`);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
