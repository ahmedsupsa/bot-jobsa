// Supabase Edge Function — Auto Apply Worker
// يعمل تلقائياً كل 30 دقيقة عبر pg_cron — مستقل تماماً عن Replit
// الإرسال عبر SMTP الشخصي لكل مستخدم

import nodemailer from "npm:nodemailer@6";

const SUPABASE_URL    = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SUPABASE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_KEY      = Deno.env.get("GEMINI_API_KEY") ?? "";
const WORKER_SECRET   = Deno.env.get("WORKER_SECRET") ?? "";
const ENC_KEY_HEX     = Deno.env.get("SMTP_ENCRYPTION_KEY") ?? "";
const TG_BOT          = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT         = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

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
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: SB, body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.text().catch(() => "");
    console.error(`[worker] sbInsert(${table}) فشل ${r.status}: ${err.slice(0, 200)}`);
  }
}

async function sbUpsert(table: string, data: Record<string, unknown>) {
  const headers = {
    ...SB,
    "Prefer": "resolution=merge-duplicates,return=minimal",
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers, body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.text().catch(() => "");
    console.error(`[worker] sbUpsert(${table}) فشل ${r.status}: ${err.slice(0, 200)}`);
  }
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

// ─── Gender Validation — كشف جنس الوظيفة ─────────────────────────────────────

// كلمات صريحة تدل على وظائف نسائية (أي منها يكفي)
const FEMALE_EXPLICIT = [
  "للسيدات", "للنساء", "للإناث", "نسائي", "نسائية", "قسم نسائي",
  "موظفات", "موظفة", "مشرفة", "كاشيرة", "سكرتيرة", "مساعدة",
  "استقبال نسائي", "مبيعات نسائي", "خدمة نسائي", "فرع نسائي",
  "للمرأة", "بنات", "سيدات", "امرأة", "انثى", "أنثى",
];

// كلمات صريحة تدل على وظائف رجالية
const MALE_EXPLICIT = [
  "للرجال", "رجال فقط", "موظفين رجال", "ذكور", "للذكور",
  "سائق", "حارس أمن", "عمال", "فني رجال", "ميكانيكي",
  "حارس", "بواب", "نجار", "سباك", "كهربائي", "لحام",
  "رجل أمن", "أمن رجالي",
];

// نهايات تاء مربوطة محايدة (ليست مؤشر تأنيث)
const NEUTRAL_ENDINGS_AR = new Set([
  "شركة", "جهة", "وظيفة", "خبرة", "صناعة", "هندسة", "تجربة", "مجموعة",
  "ممارسة", "خدمة", "برمجة", "إدارة", "رعاية", "رياضة", "تجارة", "علاقة",
  "مهارة", "سلامة", "قيادة", "محاسبة", "مالية", "تقنية", "سياحة", "صحة",
  "جودة", "موارد", "بيئة", "سياسة", "طاقة", "زراعة", "حوكمة", "ريادة",
  "مقابلة", "وساطة", "رقابة", "متابعة", "مراجعة", "مراقبة", "ممارسة",
  "متجر", "منشأة", "مؤسسة", "هيئة", "وزارة", "جامعة", "مدرسة",
]);

type GenderCheckResult = {
  jobGender: "female" | "male" | "neutral";
  confidence: "explicit" | "implicit" | "none";
  reason: string;
};

function detectJobGender(job: Record<string, unknown>): GenderCheckResult {
  const titleAr = String(job.title_ar ?? "").toLowerCase().trim();
  const titleEn = String(job.title_en ?? "").toLowerCase().trim();
  const desc    = (String(job.description_ar ?? "") + " " + String(job.description_en ?? "")).toLowerCase();
  const spec    = String(job.specializations ?? "").toLowerCase();
  const allText = `${titleAr} ${titleEn} ${desc} ${spec}`;

  // ── 1. فحص صريح: كلمات دالة مباشرة على الأنثى ──
  for (const kw of FEMALE_EXPLICIT) {
    if (allText.includes(kw.toLowerCase())) {
      return {
        jobGender: "female", confidence: "explicit",
        reason: `الوظيفة مخصصة للنساء (كلمة دالة: "${kw}")`,
      };
    }
  }

  // ── 2. فحص صريح: كلمات دالة مباشرة على الذكر ──
  for (const kw of MALE_EXPLICIT) {
    if (allText.includes(kw.toLowerCase())) {
      return {
        jobGender: "male", confidence: "explicit",
        reason: `الوظيفة مخصصة للرجال (كلمة دالة: "${kw}")`,
      };
    }
  }

  // ── 3. فحص ضمني: عنوان الوظيفة يحتوي كلمة مؤنثة بتاء مربوطة ──
  const titleWords = titleAr.split(/[\s,،\/\-()]+/).filter(Boolean);
  for (const w of titleWords) {
    if (w.length > 3 && w.endsWith("ة") && !NEUTRAL_ENDINGS_AR.has(w)) {
      return {
        jobGender: "female", confidence: "implicit",
        reason: `عنوان الوظيفة يشير للتأنيث (كلمة: "${w}")`,
      };
    }
  }

  // ── 4. محايد ──
  return { jobGender: "neutral", confidence: "none", reason: "الوظيفة محايدة أو غير محدد الجنس" };
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

  const hasCv = !!(cvParsedText?.trim());
  const cvSection = hasCv
    ? `\nالسيرة الذاتية:\n${cvParsedText}\n`
    : "\nالسيرة الذاتية:\nغير متاحة — اذكر المؤهل والاهتمام بالفرصة فقط.\n";

  const prompt = `أنت مساعد توظيف احترافي متخصص في كتابة رسائل التقديم الوظيفي الواقعية اعتمادًا على السيرة الذاتية فقط.

مهمتك:
قراءة السيرة الذاتية كاملة بدقة شديدة ثم كتابة رسالة تغطية ${lang === "ar" ? "عربية" : "إنجليزية"} رسمية قصيرة واحترافية للتقديم على الوظيفة المطلوبة بدون أي اختلاق أو مبالغة.

السيرة الذاتية هي المصدر الوحيد للحقيقة، وأي معلومة غير موجودة فيها تعتبر ممنوعة تمامًا.

التعليمات الأساسية:
* اكتب رسالة احترافية من 3 إلى 5 جمل فقط.
* ابدأ بالتعريف باسم المتقدم وتخصصه أو مؤهله الحالي.
* اربط بين السيرة الذاتية ومتطلبات الوظيفة بشكل واقعي فقط.
* استخدم لغة رسمية واضحة وبشرية.
* لا تستخدم إيموجي.
* لا تستخدم أسلوب تسويقي مبالغ فيه.
* لا تضف معلومات من عندك.
* لا تكرر وصف الوظيفة بشكل أعمى.
* لا تكتب مقدمة طويلة أو فلسفة.
* لا تضف توقيع أو معلومات تواصل.
* لا تستخدم كلمات توحي بخبرة قوية إذا السيرة الذاتية لا تدعم ذلك.

قيود صارمة جدًا — ممنوع تمامًا اختلاق أو افتراض أي:
خبرة عملية، سنوات خبرة، وظيفة سابقة، مهارة تقنية، لغة، شهادة، دورة، مشروع، تدريب، تطوع، مسؤوليات وظيفية، إنجازات، برامج أو أنظمة، أدوات تقنية، شهادات احترافية، عضويات، اعتمادات، دعم حكومي (هدف، تمهير، صندوق الموارد البشرية، إعانة باحثين عن عمل، أي برنامج حكومي أو أهلي).

إذا لم يتم ذكر الشيء نصيًا داخل السيرة الذاتية: ممنوع ذكره أو التلميح له أو استنتاجه.

إذا كانت السيرة الذاتية لا تحتوي على خبرة مباشرة:
* اذكر المؤهل أو التخصص فقط.
* اذكر الاهتمام بالتعلم والتطوير والاستعداد للعمل.
* كن صادقًا ومهنيًا بدون تجميل وهمي.

قاعدة إلزامية: عند الشك تجاهل المعلومة. الواقعية أهم من الإقناع.

اسم المتقدم:
${name}

المسمى الوظيفي:
${jobTitle}

الشركة:
${company || "غير محددة"}

وصف الوظيفة:
${desc.slice(0, 600) || "غير متاح"}
${cvSection}
المطلوب:
إخراج رسالة تغطية رسمية قصيرة فقط بدون أي شرح إضافي.`;

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
      content: opts.cvBytes,
    }];
  }

  await transporter.sendMail(mailOptions);
}

// ─── بصمة بيانات الوظيفة (لكشف التغيير والسماح بإعادة التقديم) ─────────────

async function jobFingerprint(title: string, email: string, desc: string): Promise<string> {
  const text  = `${title}|${email}|${desc.slice(0, 500)}`;
  const bytes = new TextEncoder().encode(text);
  const hash  = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── تحليل مدى ملاءمة المستخدم للوظيفة (Gemini AI) ───────────────────────────

interface JobFitResult {
  score: number;       // 0-100
  decision: "apply" | "skip";
  reasons: string[];   // أسباب القبول أو الرفض
  missing: string[];   // متطلبات ناقصة في الملف
  matched: string[];   // مهارات/متطلبات مطابقة في الملف
}

async function analyzeJobFit(
  jobTitle: string,
  company: string,
  jobDesc: string,
  cvParsedText: string | null,
  fieldNames: string[],
  certifications: Array<{ type: string; name: string; issuer?: string }>,
): Promise<JobFitResult> {
  // الـ fallback يرفض التقديم بشكل افتراضي — لا نقدّم بدون تحليل AI حقيقي
  const fallback: JobFitResult = { score: 0, decision: "skip", reasons: ["تعذّر الاتصال بـ Gemini — تم التخطي احترازياً"], missing: [], matched: [] };
  if (!GEMINI_KEY) return fallback;

  const certText = certifications.length
    ? certifications.map((c) => `- ${c.type}: ${c.name}${c.issuer ? " (" + c.issuer + ")" : ""}`).join("\n")
    : "لا توجد شهادات أو رخص مسجّلة";

  const prefsText = fieldNames.length ? fieldNames.join("، ") : "غير محدد";

  const prompt =
    `أنت محلل توظيف متخصص وصارم جداً. مهمتك حماية سمعة المتقدمين — لا تسمح بالتقديم إلا إذا كان المرشح مناسباً فعلاً.\n\n` +
    `⚠️ قواعد صارمة لا تُكسر:\n` +
    `- إذا طالبت الوظيفة بخبرة سنتين+ والمرشح حديث تخرج أو عنده أقل → قرار حتمي: skip\n` +
    `- إذا كانت الوظيفة Senior/Lead/Manager والمرشح junior أو حديث تخرج → skip\n` +
    `- لا تحوّل 'تدريب صيفي' أو 'مشاريع جامعية' إلى خبرة عمل حقيقية\n\n` +
    `=== الوظيفة ===\n` +
    `المسمى: ${jobTitle}\n` +
    `الشركة: ${company || "غير محدد"}\n` +
    `الوصف: ${jobDesc.slice(0, 900) || "غير متاح"}\n\n` +
    `=== ملف المرشح ===\n` +
    `التفضيلات المهنية: ${prefsText}\n` +
    `الشهادات والرخص:\n${certText}\n` +
    `ملخص السيرة الذاتية:\n${(cvParsedText ?? "غير متاح").slice(0, 1200)}\n\n` +
    `=== المطلوب ===\n` +
    `أعد JSON فقط (بدون markdown) بهذا الشكل بالضبط:\n` +
    `{"score":75,"decision":"apply","reasons":["سبب1"],"missing":["نقص1"],"matched":["مهارة1"],"cv_experience_years":3,"job_required_years":2}\n` +
    `- score: رقم من 0 إلى 100\n` +
    `- decision: "apply" فقط إذا score >= 70 ولا توجد متطلبات إلزامية ناقصة وسنوات الخبرة كافية\n` +
    `- reasons: 1-2 سبب موجز للقرار بالعربية (اذكر ما وُجد أو ما غاب بالتحديد)\n` +
    `- missing: الشروط الإلزامية الناقصة (رخص/شهادات/مؤهل/خبرة/مهارة) — فارغة إذا لا يوجد\n` +
    `- matched: المهارات والمؤهلات الموجودة في السيرة وتتطابق مع الوظيفة — فارغة إذا لا يوجد\n` +
    `- cv_experience_years: سنوات خبرة المرشح كرقم (0 إذا حديث تخرج، -1 إذا غير واضح)\n` +
    `- job_required_years: سنوات الخبرة المطلوبة كرقم (0 إذا لا يوجد شرط، -1 إذا غير واضح)\n` +
    `أعد JSON فقط، بلا نص إضافي.`;

  const MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash"];
  for (const model of MODELS) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (r.status === 429 || r.status === 503 || r.status === 404) continue;
      if (!r.ok) continue;
      const data = await r.json();
      const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
      if (!text) continue;
      // استخراج JSON من الرد (قد يكون محاطاً بـ markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]) as Partial<JobFitResult>;
      const score   = Math.max(0, Math.min(100, Number(parsed.score ?? 0)));
      const missing = Array.isArray(parsed.missing) ? parsed.missing.filter(Boolean).slice(0, 4) : [];
      const aiCvYears  = typeof parsed.cv_experience_years  === "number" ? parsed.cv_experience_years  : -1;
      const aiJobYears = typeof parsed.job_required_years   === "number" ? parsed.job_required_years   : -1;

      // حاجز 1: threshold 70 + لا متطلبات ناقصة
      let decision: "apply" | "skip" = (score >= 70 && missing.length === 0) ? "apply" : "skip";

      // حاجز 2: خبرة المرشح أقل من المطلوب → skip حتمي
      if (aiCvYears >= 0 && aiJobYears > 0 && aiCvYears < aiJobYears) {
        decision = "skip";
        const expMsg = `مطلوب ${aiJobYears}+ سنة — لديك ${aiCvYears} سنة`;
        if (!missing.includes(expMsg)) missing.unshift(expMsg);
      }

      const matched = Array.isArray((parsed as any).matched) ? (parsed as any).matched.filter(Boolean).slice(0, 6) : [];
      return {
        score,
        decision,
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 4) : [],
        missing,
        matched,
      };
    } catch { continue; }
  }
  return fallback;
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

  // حد 2 تقديمات لكل مستخدم في كل دورة لضمان وصول كل المستخدمين
  const MAX_PER_CYCLE = 2;
  // حد 2 مستخدمين لكل run لتجنب تجاوز resource limit في Supabase free tier
  const MAX_USERS_PER_RUN = 2;
  let processedUsers = 0;

  for (const { user, countToday } of usersWithCount) {
    if (processedUsers >= MAX_USERS_PER_RUN) break;
    if (countToday >= 10) continue;
    activeUsers++;
    processedUsers++;

    const uid = String(user.id);

    const [settingsRows, cvRows, prefsRows, certRows] = await Promise.all([
      sbGet("user_settings",        { user_id: `eq.${uid}` }),
      sbGet("user_cvs",             { user_id: `eq.${uid}` }),
      sbGet("user_job_preferences", { user_id: `eq.${uid}` }),
      sbGet("user_certifications",  { user_id: `eq.${uid}` }),
    ]);

    const settings = settingsRows[0] ?? {};

    // SMTP فقط — لا Resend
    const smtpEmail   = String(settings.smtp_email ?? "").trim();
    const smtpHost    = String(settings.smtp_host  ?? "smtp.gmail.com");
    const smtpPort    = Number(settings.smtp_port  ?? 465);
    const smtpSecure  = settings.smtp_secure !== false;
    const encryptedPw = String(settings.smtp_app_password_encrypted ?? "").trim();
    const hasSmtp     = !!(settings.email_connected && smtpEmail && encryptedPw);

    if (!smtpEmail) {
      details.push({ user: String(user.full_name ?? uid), job: "—", status: "skipped", reason: "لم يُضف إيميله بعد" });
      continue;
    }
    if (!hasSmtp) {
      details.push({ user: String(user.full_name ?? uid), job: "—", status: "skipped", reason: "لم يربط Gmail App Password بعد" });
      continue;
    }

    let appPassword = "";
    try {
      appPassword = await decryptAES(encryptedPw, ENC_KEY_HEX);
    } catch (e) {
      errors.push(`${String(user.full_name ?? uid)}: فشل فك التشفير — ${String(e)}`);
      continue;
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

    const certifications = certRows.map((c) => ({
      type:   String(c.type   ?? ""),
      name:   String(c.name   ?? ""),
      issuer: String(c.issuer ?? "") || undefined,
    }));

    const name      = String(user.full_name ?? "المتقدم");
    const phone     = String(user.phone ?? "");
    const lang      = String(settings.application_language ?? "ar");
    // حد اليوم (10) مع حد الدورة الواحدة (MAX_PER_CYCLE) لضمان العدالة بين المستخدمين
    const remaining = Math.min(MAX_PER_CYCLE, 10 - countToday);
    let sent = 0;

    // جلب جميع تقديمات المستخدم في آخر 30 يوم دفعةً واحدة (بدلاً من استعلام لكل وظيفة)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentAppsAll = await sbGet("applications", {
      user_id:    `eq.${uid}`,
      applied_at: `gte.${thirtyDaysAgo}`,
      "select":   "job_id,job_title,job_fingerprint",
    });
    const appliedJobIds    = new Set(recentAppsAll.map((a) => String(a.job_id)));
    const appliedJobTitles = new Set(recentAppsAll.map((a) => String(a.job_title)));
    const appliedFps       = new Set(recentAppsAll.map((a) => String(a.job_fingerprint ?? "")).filter(Boolean));

    for (const job of jobs) {
      if (sent >= remaining) break;

      const jobId    = String(job.id);
      const jobTitle = String(job.title_ar ?? job.title_en ?? "وظيفة");
      const company  = String(job.company ?? "");
      const desc     = String(job.description_ar ?? job.description_en ?? "").slice(0, 1200);
      const toEmail  = String(job.application_email ?? "").trim();

      // فحص التكرار محلياً بدون استعلامات DB إضافية
      const fingerprint = await jobFingerprint(jobTitle, toEmail, desc);

      if (appliedJobIds.has(jobId) || appliedJobTitles.has(jobTitle)) {
        const hasFp = appliedFps.has(fingerprint);
        if (!hasFp || appliedFps.size === 0) {
          details.push({ user: name, job: jobTitle, status: "skipped", reason: "قُدِّم مؤخراً (أقل من 30 يوم)" });
          continue;
        }
        // بيانات الوظيفة تغيّرت بشكل مثبت → السماح بإعادة التقديم
        console.log(`[worker] 🔄 ${name} ← ${jobTitle}: بيانات الوظيفة تغيّرت — إعادة التقديم مسموحة`);
      }

      // ── الفلاتر الرخيصة قبل استدعاء AI ─────────────────────────────────────

      if (!isValidEmail(toEmail)) {
        details.push({ user: name, job: jobTitle, status: "skipped", reason: `إيميل غير صالح: ${toEmail}` });
        continue;
      }

      if (!jobMatchesUser(job, fieldNames)) {
        details.push({ user: name, job: jobTitle, status: "skipped", reason: "لا يطابق التفضيلات" });
        continue;
      }

      // ── Gender Validation Check (قبل AI لتوفير التكاليف) ─────────────────────
      const userGender  = String(user.gender ?? "male");
      const genderCheck = detectJobGender(job);

      if (genderCheck.jobGender !== "neutral") {
        const conflict =
          (genderCheck.jobGender === "female" && userGender === "male") ||
          (genderCheck.jobGender === "male"   && userGender === "female");

        if (conflict) {
          const genderReason =
            genderCheck.jobGender === "female"
              ? `لم يتم التقديم لأن الوظيفة مخصصة للنساء بينما حساب المستخدم ذكر — ${genderCheck.reason}`
              : `لم يتم التقديم لأن الوظيفة مخصصة للرجال بينما حساب المستخدم أنثى — ${genderCheck.reason}`;

          const missingSkill = genderCheck.jobGender === "female"
            ? "شرط الجنس: أنثى" : "شرط الجنس: ذكر";

          console.log(`[worker] 🚫 Gender Block: ${name} ← ${jobTitle} | ${genderReason}`);
          details.push({ user: name, job: jobTitle, status: "skipped", reason: genderReason });
          await sbUpsert("applications", {
            user_id: uid, job_id: jobId, job_title: jobTitle,
            applied_at: new Date().toISOString(),
            status: "skipped",
            application_status: "invalid",
            hidden_from_user: true,
            invalid_application: true,
            hidden_reason: "تعارض الجنس — " + genderCheck.reason,
            skip_reason: genderReason,
            decision_reasons: [genderCheck.reason, `جنس المستخدم: ${userGender === "male" ? "ذكر" : "أنثى"}`],
            missing_skills: [missingSkill],
            matched_skills: [],
            match_score: 0, job_fingerprint: fingerprint,
            provider_used: null,
          });
          continue;
        }
      }

      // ── تحليل AI لمدى ملاءمة الوظيفة ────────────────────────────────────────
      const fit = await analyzeJobFit(jobTitle, company, desc, cvParsedText, fieldNames, certifications);
      console.log(`[worker] 🤖 ${name} ← ${jobTitle} | score=${fit.score} | ${fit.decision} | gender=${genderCheck.jobGender}(${genderCheck.confidence}) | missing=${fit.missing.join(", ") || "لا يوجد"}`);

      if (fit.decision === "skip") {
        const reason = `AI رفض (${fit.score}/100): ${fit.reasons.slice(0, 2).join("؛ ")}${fit.missing.length ? " | ناقص: " + fit.missing.slice(0, 2).join("، ") : ""}`;
        details.push({ user: name, job: jobTitle, status: "skipped", reason });
        await sbUpsert("applications", {
          user_id: uid, job_id: jobId, job_title: jobTitle,
          applied_at: new Date().toISOString(),
          status: "skipped",
          application_status: "rejected",
          hidden_from_user: false,
          invalid_application: false,
          skip_reason: reason,
          decision_reasons: fit.reasons,
          missing_skills: fit.missing,
          matched_skills: fit.matched,
          match_score: fit.score, job_fingerprint: fingerprint,
          provider_used: null,
        });
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

        await sendSmtp({
          smtpHost, smtpPort, smtpSecure, smtpEmail, appPassword,
          to: toEmail, subject, html, fromName: name, cvBytes, cvName,
        });

        sent++; applied++;
        details.push({ user: name, job: jobTitle, status: "sent", reason: `score=${fit.score}/100 — ${fit.reasons.slice(0, 1).join("")}` });
        console.log(`[worker] ✅ ${name} → ${jobTitle} (${toEmail}) | score=${fit.score}`);

        await new Promise((r) => setTimeout(r, 5000));
      } catch (e) {
        status = "error";
        errorReason = String(e).slice(0, 500);
        errors.push(`${name} → ${jobTitle}: ${errorReason}`);
        details.push({ user: name, job: jobTitle, status: "error", reason: errorReason });
        console.error(`[worker] ❌ ${name} → ${jobTitle}: ${errorReason}`);
      }

      await sbUpsert("applications", {
        user_id: uid, job_id: jobId, job_title: jobTitle,
        applied_at: sentAt, status, provider_used: "smtp",
        application_status: status === "sent" ? "applied" : "error",
        hidden_from_user: false,
        invalid_application: false,
        error_reason: errorReason, sent_at: status === "sent" ? sentAt : null,
        match_score: fit.score, job_fingerprint: fingerprint,
        decision_reasons: fit.reasons,
        missing_skills: fit.missing,
        matched_skills: fit.matched,
        skip_reason: null,
      });
    }
  }

  return { applied, users: activeUsers, errors, details };
}

// ─── تنظيف تلقائي: إخفاء أي تقديم خاطئ قديم لم يُعالَج ──────────────────────

async function cleanupInvalidApplications() {
  try {
    // إخفاء أي تقديم ذكر←وظيفة نسائية أو أنثى←وظيفة رجالية لم يُعلَّم بعد
    const url = new URL(`${SUPABASE_URL}/rest/v1/applications`);
    url.searchParams.set("hidden_from_user", "eq.false");
    url.searchParams.set("invalid_application", "eq.false");
    url.searchParams.set("or", "(skip_reason.ilike.*نساء*ذكر*,skip_reason.ilike.*رجال*أنثى*)");

    const r = await fetch(url.toString(), {
      method: "PATCH",
      headers: { ...SB, "Prefer": "return=minimal" },
      body: JSON.stringify({
        hidden_from_user: true,
        invalid_application: true,
        application_status: "invalid",
        hidden_reason: "تعارض الجنس — كُشف في دورة التنظيف",
      }),
    });
    if (r.ok) {
      console.log("[worker] 🧹 تنظيف: تقديمات خاطئة سابقة أُخفيت");
    }
  } catch (e) {
    console.error("[worker] تنظيف فشل:", e);
  }
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

// ─── التقرير الأسبوعي ─────────────────────────────────────────────────────────

async function maybeSendWeeklyReport() {
  const APP_URL      = Deno.env.get("APP_URL") ?? "";
  const workerSecret = WORKER_SECRET;
  if (!APP_URL || !workerSecret) return;

  // تحقق: هل اليوم الأحد (بتوقيت الرياض)؟ وهل الساعة بين 8 و 9 صباحاً؟
  const now = new Date();
  const ksa = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  const isSunday = ksa.getDay() === 0;
  const hour     = ksa.getHours();
  if (!isSunday || hour < 8 || hour >= 9) return;

  // تحقق: هل أُرسل التقرير هذا الأسبوع بالفعل؟
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/worker_status?select=weekly_report_last_sent&limit=1`, { headers: SB });
    const rows: Array<{ weekly_report_last_sent: string | null }> = await r.json();
    const lastSent = rows?.[0]?.weekly_report_last_sent;
    if (lastSent) {
      const daysSince = (Date.now() - new Date(lastSent).getTime()) / 86400000;
      if (daysSince < 6) {
        console.log(`[worker] التقرير الأسبوعي أُرسل منذ ${daysSince.toFixed(1)} يوم — تخطي`);
        return;
      }
    }
  } catch { /* نتجاهل الخطأ ونكمل */ }

  console.log("[worker] 📊 إرسال التقرير الأسبوعي...");
  try {
    const res = await fetch(`${APP_URL}/api/internal/weekly-report`, {
      method: "POST",
      headers: { "x-worker-secret": workerSecret, "Content-Type": "application/json" },
    });
    const json = await res.json();
    if (json.ok) {
      console.log(`[worker] ✅ التقرير الأسبوعي أُرسل إلى ${json.sentTo}`);
      await tgSend(`📊 <b>التقرير الأسبوعي أُرسل</b>\nإلى: ${json.sentTo}\nالتقديمات: ${json.stats?.totalSent || 0} ✅ | ${json.stats?.totalSkipped || 0} ⏭️ | ${json.stats?.totalError || 0} ❌`);
    } else {
      console.error("[worker] ❌ فشل التقرير الأسبوعي:", json.error);
    }
  } catch (e) {
    console.error("[worker] ❌ خطأ في إرسال التقرير الأسبوعي:", e);
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  console.log("[worker] بدء دورة التقديم التلقائي عبر SMTP");
  const t0 = Date.now();
  try {
    const result = await runCycle();
    const duration_ms = Date.now() - t0;
    const status = result.errors.length === 0 ? "success" : result.applied > 0 ? "partial" : "error";
    await logRun({ applied_count: result.applied, active_users: result.users, errors: result.errors, duration_ms, status });
    console.log("[worker] انتهت الدورة:", JSON.stringify({ applied: result.applied, users: result.users, errors: result.errors.length }));
    await tgWorkerResult(result.applied, result.users, Math.round(duration_ms / 1000), result.details);
    // تنظيف: إخفاء أي تقديم خاطئ قديم لم يُعالَج بعد
    await cleanupInvalidApplications();
    // التقرير الأسبوعي (يُرسَل مرة واحدة كل أحد ٨-٩ ص بتوقيت الرياض)
    await maybeSendWeeklyReport();
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
