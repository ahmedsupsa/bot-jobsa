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

// كلمات أو عبارات صريحة تدل على وظائف نسائية
const FEMALE_EXPLICIT = [
  "للسيدات", "للنساء", "للإناث", "نسائي", "نسائية", "قسم نسائي",
  "موظفات", "استقبال نسائي", "مبيعات نسائية", "فرع نسائي",
  "للمرأة", "سيدات فقط", "إناث فقط", "قسم النساء", "أقسام نسائية",
  "سيدة", "امرأة فقط", "بنات فقط",
];

// عناوين وظائف مؤنثة — قائمة شاملة
const FEMALE_JOB_TITLES = [
  // استقبال وإدارة
  "سكرتيرة", "سكرتيره", "موظفة استقبال", "موظفه استقبال",
  "مساعدة إدارية", "مساعده ادارية", "أمينة سر", "امينة سر",
  // مبيعات وخدمة عملاء
  "كاشيرة", "كاشيره", "مشرفة مبيعات", "مندوبة مبيعات",
  "موظفة مبيعات", "بائعة",
  // صحة وتمريض
  "ممرضة", "ممرضه", "قابلة", "مولّدة",
  // تعليم
  "معلمة", "مدرّسة", "مدرسة", "مشرفة طالبات",
  // خياطة وتجميل
  "مصففة", "خياطة", "حلاقة", "مكيّجة", "إخصائية تجميل", "أخصائية تجميل",
  // رعاية
  "مربية", "حاضنة", "عاملة منزلية",
  // تقنية وإدارة (مؤنثة — صيغة تأنيث صريحة فقط، لا أسماء تخصصات)
  "أخصائية", "إخصائية", "مشرفة", "مديرة",
  "مستشارة", "مصممة", "مهندسة", "محللة", "منسقة",
  "مدققة", "مقيّمة", "باحثة", "مطورة",
  "موظفة", "مسؤولة",
];

// كلمات صريحة تدل على وظائف رجالية
const MALE_EXPLICIT = [
  "للرجال", "رجال فقط", "موظفين رجال", "ذكور فقط", "للذكور",
  "حارس أمن", "رجل أمن", "أمن رجالي", "نجار", "سباك", "لحام", "بواب",
];

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

  // ── 3. فحص ضمني: عنوان الوظيفة يطابق عنوان وظيفة نسائي محدد ──
  // (نستخدم قائمة صريحة بدلاً من فحص نهايات الكلمات لتجنب الإيجابيات الكاذبة)
  for (const femTitle of FEMALE_JOB_TITLES) {
    if (titleAr.includes(femTitle.toLowerCase())) {
      return {
        jobGender: "female", confidence: "implicit",
        reason: `عنوان الوظيفة يدل على وظيفة نسائية: "${femTitle}"`,
      };
    }
  }

  // ── 4. محايد ──
  return { jobGender: "neutral", confidence: "none", reason: "الوظيفة محايدة أو غير محدد الجنس" };
}

// خريطة التخصصات المرتبطة — توسّع بحث المطابقة لتخصصات قريبة
const RELATED_FIELDS: Record<string, string[]> = {
  "محاسبة":        ["مالية", "مال", "أعمال", "إدارة", "تدقيق", "ضرائب", "ميزانية"],
  "مالية":         ["محاسبة", "أعمال", "إدارة", "استثمار", "بنوك", "اقتصاد"],
  "إدارة أعمال":   ["محاسبة", "مالية", "موارد بشرية", "تسويق", "مبيعات"],
  "موارد بشرية":   ["إدارة", "أعمال", "تدريب", "توظيف"],
  "تسويق":         ["مبيعات", "إعلام", "علاقات عامة", "تجارة"],
  "مبيعات":        ["تسويق", "تجارة", "خدمة عملاء"],
  "تقنية معلومات": ["حاسب", "برمجة", "شبكات", "أمن معلومات", "software", "it"],
  "حاسب":          ["تقنية", "برمجة", "software", "it", "شبكات"],
  "هندسة":         ["تقنية", "صناعة", "ميكانيكا", "كهرباء", "مدني", "كيمياء"],
  "طب":            ["صحة", "تمريض", "صيدلة", "مختبر"],
  "تمريض":         ["صحة", "طب", "رعاية"],
  "تعليم":         ["تدريس", "أكاديمي", "تدريب"],
  "قانون":         ["محاماة", "شريعة", "قضاء", "legal"],
};

function jobMatchesUser(
  job: Record<string, unknown>,
  fieldNames: string[],
  cvProfile?: CvProfile | null,
): boolean {
  // بناء قائمة الكلمات: تفضيلات المستخدم + تخصص السيرة الذاتية
  const keywords = new Set<string>();
  for (const f of fieldNames) if (f.trim()) keywords.add(f.trim().toLowerCase());

  // إضافة كلمات من تخصص السيرة الذاتية
  if (cvProfile?.specialization) {
    keywords.add(cvProfile.specialization.toLowerCase());
    for (const w of cvProfile.specialization.split(/[\s\-،,\/]+/))
      if (w.trim().length > 2) keywords.add(w.trim().toLowerCase());
  }
  if (cvProfile?.degree) {
    for (const w of cvProfile.degree.split(/[\s\-،,\/]+/))
      if (w.trim().length > 3) keywords.add(w.trim().toLowerCase());
  }

  // لا تفضيلات ولا cv_profile → لا يمكن تحديد التخصص، قبول كل الوظائف
  if (!keywords.size) return true;

  // توسيع الكلمات بالتخصصات المرتبطة
  const expanded = new Set<string>(keywords);
  for (const kw of keywords) {
    for (const [key, related] of Object.entries(RELATED_FIELDS)) {
      if (kw.includes(key) || key.includes(kw)) {
        for (const r of related) expanded.add(r.toLowerCase());
      }
    }
  }

  // مسح الوظيفة كاملاً (تخصص + عنوان + وصف)
  const blob = [
    job.specializations, job.title_ar, job.title_en,
    job.description_ar,  job.description_en,
  ].map(v => String(v ?? "")).join(" ").toLowerCase();

  // أي كلمة واحدة تتطابق → يُقدَّم
  return [...expanded].some(k => k && blob.includes(k));
}

// ─── CV Download ──────────────────────────────────────────────────────────────

async function downloadCv(storagePath: string): Promise<Uint8Array | null> {
  const url = `${SUPABASE_URL}/storage/v1/object/cvs/${storagePath}`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) return null;
  return new Uint8Array(await r.arrayBuffer());
}

// ─── Structured CV Profile — يُحلَّل مرة واحدة ويُخزَّن إلى الأبد ─────────────

interface CvProfile {
  degree: string;           // "بكالوريوس علوم حاسب"
  specialization: string;   // "هندسة البرمجيات"
  experience_years: number; // -1=غير محدد، 0=حديث تخرج، N=سنوات
  skills: string[];
  languages: string[];
  prev_jobs: string[];
  is_fresh_graduate: boolean;
}

// استخراج نص من PDF (مرة واحدة فقط)
async function parseCvBytesWithAI(cvBytes: Uint8Array, cvMime: string): Promise<string | null> {
  if (!GEMINI_KEY || !cvBytes.length) return null;
  const prompt =
    "استخرج من هذه السيرة الذاتية المعلومات التالية بشكل منظّم ومختصر بالعربية:\n" +
    "المؤهل العلمي والتخصص:\nسنوات الخبرة الإجمالية:\n" +
    "الوظائف السابقة (مسمى + جهة + مدة):\nالمهارات التقنية والبرامج:\n" +
    "الشهادات والرخص المهنية:\nاللغات:\n" +
    "اكتب فقط المعلومات الموجودة فعلاً. لا تضف تخمينات.";
  const parts = [
    { inline_data: { mime_type: cvMime, data: toBase64(cvBytes) } },
    { text: prompt },
  ];
  for (const model of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"]) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }] }) }
      );
      if (!r.ok) continue;
      const data = await r.json();
      const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
      if (text) return text;
    } catch { continue; }
  }
  return null;
}

// تحويل النص → JSON منظّم (Flash Lite = رخيص جداً، prompt قصير)
async function parseCvProfileFromText(cvText: string): Promise<CvProfile | null> {
  if (!GEMINI_KEY || !cvText.trim()) return null;
  const prompt = `استخرج البيانات من السيرة الذاتية التالية. أعد JSON فقط بدون markdown:
{"degree":"المؤهل","specialization":"التخصص","experience_years":0,"skills":["مهارة1"],"languages":["العربية"],"prev_jobs":["مسمى - جهة - مدة"],"is_fresh_graduate":false}
القواعد: experience_years: -1 غير محدد | 0 حديث تخرج | رقم موجب سنوات. is_fresh_graduate: true إذا لا وظائف سابقة. skills: حد 15.

السيرة الذاتية:
${cvText.slice(0, 1800)}`;

  for (const model of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"]) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      );
      if (!r.ok) continue;
      const data = await r.json();
      const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) continue;
      const p = JSON.parse(m[0]);
      return {
        degree:           String(p.degree || ""),
        specialization:   String(p.specialization || ""),
        experience_years: typeof p.experience_years === "number" ? p.experience_years : -1,
        skills:    Array.isArray(p.skills)    ? p.skills.slice(0, 15).map(String)   : [],
        languages: Array.isArray(p.languages) ? p.languages.map(String)             : [],
        prev_jobs: Array.isArray(p.prev_jobs) ? p.prev_jobs.slice(0, 5).map(String) : [],
        is_fresh_graduate: !!p.is_fresh_graduate,
      };
    } catch { continue; }
  }
  return null;
}

// جلب/تحليل السيرة الذاتية — يُخزّن النص والملف المنظّم مرة واحدة فقط
async function getOrParseCv(cv: Record<string, unknown>): Promise<{
  parsedText: string | null;
  profile: CvProfile | null;
}> {
  const cvId        = String(cv.id ?? "");
  const storagePath = String(cv.storage_path ?? "").trim();
  const cvName      = String(cv.file_name ?? "cv.pdf");
  const cvMime      = cvName.toLowerCase().endsWith(".pdf") ? "application/pdf"
    : cvName.toLowerCase().endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/octet-stream";

  const existingText    = String(cv.cv_parsed_text ?? "").trim() || null;
  const existingProfile = (cv.cv_profile ?? null) as CvProfile | null;

  // كلاهما محفوظ → لا استدعاء Gemini على الإطلاق
  if (existingText && existingProfile) {
    return { parsedText: existingText, profile: existingProfile };
  }

  // جلب النص إذا لم يكن محفوظاً
  let parsedText = existingText;
  if (!parsedText) {
    const cvBytes = storagePath ? await downloadCv(storagePath) : null;
    if (!cvBytes) return { parsedText: null, profile: null };
    parsedText = await parseCvBytesWithAI(cvBytes, cvMime);
    if (parsedText && cvId) {
      await sbPatch("user_cvs", { id: `eq.${cvId}` }, {
        cv_parsed_text: parsedText, cv_parsed_at: new Date().toISOString(),
      });
      console.log(`[worker] 💾 حُفظ نص CV — cv_id=${cvId}`);
    }
  }

  // بناء الملف المنظّم من النص (Flash Lite — رخيص جداً)
  let profile: CvProfile | null = existingProfile;
  if (!profile && parsedText) {
    profile = await parseCvProfileFromText(parsedText);
    if (profile && cvId) {
      await sbPatch("user_cvs", { id: `eq.${cvId}` }, { cv_profile: profile });
      console.log(`[worker] 📊 حُفظ الملف المنظّم — cv_id=${cvId}`);
    }
  }

  return { parsedText, profile };
}

// ─── Local Keyword Scoring — تقييم بدون Gemini ──────────────────────────────

function computeLocalScore(
  profile: CvProfile | null,
  fieldNames: string[],
  jobTitle: string,
  jobDesc: string,
  jobLevel: JobLevel,
): number {
  // بدون profile → دع Gemini يقرر دائماً
  if (!profile) return 55;
  const haystack = `${jobTitle} ${jobDesc}`.toLowerCase();
  let score = 50;

  // تأثير الخبرة — خفيف لأن Gemini هو الحَكَم الأساسي
  const exp = profile.experience_years;
  if (jobLevel === "senior") {
    // وظيفة متخصصة بدون أي خبرة → حذف محلي فقط لتوفير API
    if (exp === 0) score -= 20;
    else if (exp >= 3) score += 10;
  } else if (jobLevel === "mid") {
    // خريج جديد في وظيفة متوسطة → Gemini يقرر
    if (exp === 0) score -= 10;
    else if (exp >= 2) score += 10;
  } else if (jobLevel === "entry") {
    score += 15;
  }

  // تطابق المهارات
  const skillHits = profile.skills.filter(s => s.length > 2 && haystack.includes(s.toLowerCase())).length;
  score += Math.min(skillHits * 10, 30);

  // تطابق التخصص
  if (profile.specialization) {
    const words = profile.specialization.split(/[\s\-،,]+/).filter(w => w.length > 3);
    if (words.some(w => haystack.includes(w.toLowerCase()))) score += 15;
  }

  return Math.max(0, Math.min(100, score));
}

// ─── Cover Letter من القالب المحفوظ للمستخدم ─────────────────────────────────

function buildCoverLetterFromSavedBody(
  name: string,
  jobTitle: string,
  company: string,
  phone: string,
  email: string,
  _lang: string,
  savedBody: string,
): string {
  const companyTrim = (company || "").trim();
  const jobTrimmed = (jobTitle || "").trim();
  const header = companyTrim
    ? `إلى فريق التوظيف في <strong>${companyTrim}</strong>${jobTrimmed ? ` &mdash; <span style="color:#93c5fd;">${jobTrimmed}</span>` : ""}`
    : `طلب توظيف &mdash; <span style="color:#93c5fd;">${jobTrimmed}</span>`;
  const greeting = companyTrim
    ? `<p style="font-size:15px;font-weight:600;margin:20px 0 16px;color:#93c5fd;">السلام عليكم ورحمة الله وبركاته،</p>`
    : "";

  const paragraphs = savedBody
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="line-height:2;margin:0 0 16px;font-size:15px;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:24px;background:#f0f2f5;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;">
<div dir="rtl" style="background-color:#0a1e36;color:#ffffff;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;padding:40px;border-radius:12px;max-width:600px;margin:0 auto;">
  <h2 style="margin-top:0;font-size:20px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:16px;">
    ${header}
  </h2>
  ${greeting}
  <div style="color:#e2e8f0;">${paragraphs}</div>
  <p style="margin:24px 0 0;line-height:2;font-size:14px;border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;color:#cbd5e1;">
    مع خالص التحية،<br><strong style="color:#fff;">${name}</strong><br>${phone}<br>${email}
  </p>
</div>
</body></html>`;
}

// ─── Cover Letter — قالب HTML ثابت (بدون AI) ────────────────────────────────

function buildCoverLetterTemplate(
  name: string,
  jobTitle: string,
  company: string,
  profile: CvProfile | null,
  phone: string,
  email: string,
  lang: string,
  certs?: Array<{ type: string; name: string; issuer?: string }>,
): string {
  const companyTrimmed = (company || "").trim();
  const headerAr = companyTrimmed
    ? `إلى فريق التوظيف في <strong>${companyTrimmed}</strong>`
    : `طلب توظيف &mdash; <strong>${(jobTitle || "").trim()}</strong>`;
  const spec   = profile?.specialization || profile?.degree || "مجال التخصص";
  const exp    = profile?.experience_years ?? -1;
  const skills = (profile?.skills ?? []).slice(0, 5).join("، ") || "مهارات متنوعة في المجال";

  const degreeItem = profile?.degree
    ? profile.degree + (profile.specialization ? " في " + profile.specialization : "")
    : "مؤهل علمي مناسب";
  const expItem = exp > 0
    ? `خبرة ${exp} ${exp === 1 ? "سنة" : "سنوات"} في المجال`
    : "حديث التخرج، لديّ رغبة قوية في التطور والتعلم";
  const skillsItem = skills;
  let certsItem = "";
  if (certs && certs.length > 0) {
    const certList = certs.map(c => c.name + (c.issuer ? ` (${c.issuer})` : "")).join("، ");
    certsItem = `الشهادات والرخص: ${certList}`;
  }

  const greetingLine = companyTrimmed
    ? `<p style="line-height:2;margin:20px 0 8px;font-size:15px;">السلام عليكم ورحمة الله وبركاته،</p>`
    : "";

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:24px;background:#f0f2f5;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;">
<div dir="rtl" style="background-color:#0a1e36;color:#ffffff;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;padding:40px;border-radius:12px;max-width:600px;margin:0 auto;">
  <h2 style="margin-top:0;font-size:20px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:16px;">
    ${headerAr}
  </h2>
  ${greetingLine}
  <p style="line-height:2;margin:16px 0;font-size:15px;">
    أنا <strong>${name}</strong>، متخصص في ${spec}،<br>
    وأرغب بالانضمام إلى فريقكم في وظيفة <strong>${jobTitle}</strong>.
  </p>
  <ul style="line-height:2.2;padding-right:20px;font-size:15px;margin:0 0 20px;">
    <li>${degreeItem}</li>
    <li>${expItem}</li>
    <li>${skillsItem}</li>
    ${certsItem ? `<li>${certsItem}</li>` : ""}
  </ul>
  <p style="line-height:2;font-size:15px;margin:0 0 24px;">
    أرفقت لكم سيرتي الذاتية، وأتطلع لفرصة للتواصل معكم.
  </p>
  <p style="margin:0;line-height:2;font-size:14px;border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;">
    مع خالص التحية،<br>
    <strong>${name}</strong><br>
    ${phone}<br>
    ${email}
  </p>
</div>
</body></html>`;
}

// ─── نص رسالة التغطية (plain text للحفظ في DB وتعديله من البوابة) ──────────────
// النص المحفوظ لا يحتوي على اسم الوظيفة أو الشركة — هما يُضافان فقط في الـ wrapper عند الإرسال
function buildPlainTextBody(
  _jobTitle: string,
  name: string,
  profile: CvProfile | null,
  certs?: Array<{ type: string; name: string; issuer?: string }>,
): string {
  const spec   = profile?.specialization || profile?.degree || "مجال التخصص";
  const exp    = profile?.experience_years ?? -1;
  const skills = (profile?.skills ?? []).slice(0, 5).join("، ") || "مهارات متنوعة في المجال";
  const degreeItem = profile?.degree
    ? profile.degree + (profile.specialization ? " في " + profile.specialization : "")
    : "مؤهل علمي مناسب";
  const expItem = exp > 0
    ? `خبرة ${exp} ${exp === 1 ? "سنة" : "سنوات"} في المجال`
    : "حديث التخرج، لديّ رغبة قوية في التطور والتعلم";
  const certLine = certs && certs.length > 0
    ? "\n- الشهادات: " + certs.map(c => c.name + (c.issuer ? ` (${c.issuer})` : "")).join("، ")
    : "";

  return `أنا ${name}، متخصص في ${spec}، وأتقدم بهذه الرسالة راغباً في الانضمام إلى فريقكم.

أبرز مؤهلاتي:
- ${degreeItem}
- ${expItem}
- المهارات: ${skills}${certLine}

أرفقت لكم سيرتي الذاتية، وأتطلع لفرصة للتواصل معكم.`;
}

// ─── توليد رسالة التقديم (قالب ثابت — بدون استدعاء AI) ───────────────────────

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function generateCoverLetter(
  jobTitle: string, name: string, company: string, _desc: string, lang: string,
  _cvParsedText?: string | null,
  cvProfile?: CvProfile | null,
  _aiScore?: number,
  phone?: string,
  email?: string,
  certs?: Array<{ type: string; name: string; issuer?: string }>,
): string {
  console.log(`[worker] 📝 FixedTemplate → ${jobTitle}`);
  return buildCoverLetterTemplate(name, jobTitle, company, cvProfile ?? null, phone ?? "", email ?? "", lang, certs);
}

// ─── بناء HTML للإيميل ────────────────────────────────────────────────────────

function buildEmailHtml(_name: string, _phone: string, _jobTitle: string, _company: string, cover: string, _lang: string): string {
  return cover;
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

// ─── Job Level Classification & Flexibility Score ─────────────────────────────

type JobLevel = "entry" | "junior" | "mid" | "senior";

// وظائف يسمح فيها بالتقديم حتى بدون خبرة — لأن أصحاب العمل يقبلون مبتدئين غالباً
const BEGINNER_FRIENDLY_KEYWORDS = [
  // عربي
  "كاشير", "صندوق", "استقبال", "موظف استقبال", "استقبالية",
  "خدمة عملاء", "ممثل خدمة", "دعم عملاء", "مركز اتصال", "call center",
  "مساعد إداري", "مساعد اداري", "سكرتير", "سكرتارية",
  "بائع", "بائعة", "موظف مبيعات", "مندوب مبيعات", "مندوبة مبيعات",
  "مسوق", "مسوقة", "تسويق ميداني",
  "منسق", "منسقة", "مدخل بيانات", "إدخال بيانات", "ادخال بيانات",
  "دعم فني", "دعم تقني", "helpdesk", "help desk",
  "مراقب كاميرات", "موظف أمن", "حارس أمن", "أمن", "مراقبة",
  "موظف موارد بشرية", "مساعد موارد بشرية", "أخصائي توظيف مبتدئ",
  "موظف تشغيل", "موظف خدمات", "موظف صندوق", "موظف طلبات",
  "مشرف قاعة", "موظف استعلامات", "متعقب", "سائق توصيل", "توصيل",
  "موزع", "مستودع", "مخزن", "مخازن", "شحن وتغليف",
  "خياط", "عامل", "فني صيانة", "صيانة", "تنسيق اجتماعات",
  // إنجليزي
  "cashier", "receptionist", "customer service", "customer support",
  "sales representative", "sales rep", "sales associate", "retail associate",
  "store associate", "admin assistant", "administrative assistant",
  "data entry", "secretary", "front desk", "operator",
  "security guard", "security officer", "warehouse", "dispatcher",
  "hr assistant", "coordinator", "scheduler", "office assistant",
  "delivery driver", "field sales", "telesales", "telemarketer",
];

// علامات الوظائف المتخصصة التي تتطلب خبرة فعلية
const SENIOR_MARKERS = [
  // عربي
  "أول", "كبير", "مدير", "رئيس قسم", "رئيس", "مستشار",
  "محاسب أول", "مهندس أول", "أخصائي أول", "قيادي",
  // إنجليزي
  "senior", "sr.", "lead", "manager", "director", "head of",
  "principal", "chief", "vp", "vice president",
  "architect", "consultant", "cto", "cfo", "coo",
];

// وظائف متخصصة لا تنفع بدون خبرة حقيقية (حتى لو المسمى بسيط)
const SPECIALIZED_TITLES = [
  "محاسب", "accountant", "مدقق", "auditor",
  "مهندس", "engineer", "طبيب", "doctor", "صيدلاني",
  "محامي", "lawyer", "مستشار قانوني",
  "مطور", "developer", "برمجة", "programmer",
  "مصمم", "designer", "مصور احترافي",
  "معالج", "therapist", "اخصائي نفسي",
  "أخصائي أمن", "security analyst", "cybersecurity",
];

function classifyJobLevel(jobTitle: string, jobDesc: string): JobLevel {
  const t = jobTitle.toLowerCase();
  const d = jobDesc.slice(0, 400).toLowerCase();
  const combined = t + " " + d;

  // Senior أولاً — أي إشارة لـ senior يعني متطلبات حقيقية
  if (SENIOR_MARKERS.some(m => combined.includes(m.toLowerCase()))) return "senior";

  // مصرّح صراحةً بأنه entry/junior
  if (
    t.includes("مبتدئ") || t.includes("مبتدئة") || t.includes("حديث تخرج") ||
    t.includes("entry") || t.includes("junior") || t.includes("trainee") ||
    t.includes("متدرب") || t.includes("متدربة") || t.includes("تدريب")
  ) return "entry";

  // وظائف متخصصة → mid بحد أدنى (تحتاج تطابق مهاري)
  if (SPECIALIZED_TITLES.some(k => t.includes(k.toLowerCase()))) return "mid";

  // وظائف مناسبة للمبتدئين
  if (BEGINNER_FRIENDLY_KEYWORDS.some(k => t.includes(k.toLowerCase()))) return "entry";

  // باقي الوظائف → junior (يُقيَّم بحذر)
  return "junior";
}

// ─── تحليل مدى ملاءمة المستخدم للوظيفة (Gemini AI) ───────────────────────────

interface JobFitResult {
  score: number;       // 0-100
  decision: "apply" | "skip";
  reasons: string[];
  missing: string[];
  matched: string[];
  job_level: JobLevel;
}

async function analyzeJobFit(
  jobTitle: string,
  company: string,
  jobDesc: string,
  cvParsedText: string | null,
  fieldNames: string[],
  certifications: Array<{ type: string; name: string; issuer?: string }>,
  cvProfile?: CvProfile | null,
): Promise<JobFitResult> {
  const jobLevel = classifyJobLevel(jobTitle, jobDesc);

  const fallback: JobFitResult = {
    score: 55, decision: "apply",
    reasons: ["تعذّر الاتصال بـ Gemini — تم التقديم تلقائياً (لا نفوّت فرصة)"],
    missing: [], matched: [], job_level: jobLevel,
  };
  if (!GEMINI_KEY) return fallback;

  // عتبة موحّدة منخفضة — لا نمنع المتقدم بسبب الخبرة
  const scoreThreshold = 42;

  const levelRules: Record<string, string> = {
    entry:  "وظيفة مبتدئين: قيّم بالمؤهل والتخصص. لا ترفض بسبب نقص الخبرة.",
    junior: "قيّم بالتخصص الجامعي والمهارات. لا تمنع بسبب سنوات الخبرة.",
    mid:    "قيّم بالتخصص والمهارات. لا تمنع بسبب سنوات الخبرة — المتقدم يريد المحاولة.",
    senior: "قيّم بالتخصص. لا تمنع فقط بسبب الخبرة — قدّر التطابق بالمجال والمؤهل.",
  };

  // الملف المنظّم → prompt أقصر بكثير (يوفر 60-70% من الـ tokens)
  const candidateSection = cvProfile
    ? [
        `المؤهل: ${cvProfile.degree || "غير محدد"}`,
        `التخصص: ${cvProfile.specialization || "غير محدد"}`,
        `الخبرة: ${cvProfile.experience_years === -1 ? "غير محدد" : cvProfile.experience_years === 0 ? "حديث تخرج" : cvProfile.experience_years + " سنة"}`,
        `مهارات: ${cvProfile.skills.slice(0, 10).join("، ") || "—"}`,
        `لغات: ${cvProfile.languages.join("، ") || "—"}`,
        `وظائف سابقة: ${cvProfile.prev_jobs.slice(0, 3).join(" | ") || "لا يوجد"}`,
      ].join("\n")
    : `ملخص السيرة:\n${(cvParsedText ?? "غير متاح").slice(0, 800)}`;

  const certText = certifications.length
    ? certifications.map(c => `${c.type}: ${c.name}`).join("، ")
    : "لا يوجد";

  const prompt =
    `أنت محلل توظيف. قيّم ملاءمة المرشح للوظيفة وأعد JSON فقط.\n\n` +
    `الوظيفة: ${jobTitle} | ${company || "—"} | مستوى: ${jobLevel.toUpperCase()}\n` +
    `القاعدة: ${levelRules[jobLevel]}\n` +
    `الوصف: ${jobDesc.slice(0, 500) || "غير متاح"}\n\n` +
    `المرشح:\n${candidateSection}\n` +
    `التفضيلات: ${fieldNames.join("، ") || "—"}\n` +
    `الشهادات: ${certText}\n\n` +
    `أعد JSON فقط: {"score":75,"decision":"apply","reasons":["سبب"],"missing":["نقص"],"matched":["مهارة"],"cv_experience_years":2,"job_required_years":1}\n` +
    `decision: "apply" إذا score≥${scoreThreshold} ولا متطلبات إلزامية ناقصة. أعد JSON فقط بلا نص.`;

  const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"];
  for (const model of MODELS) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      );
      if (r.status === 429 || r.status === 503 || r.status === 404) continue;
      if (!r.ok) continue;
      const data = await r.json();
      const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
      if (!text) continue;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]) as Partial<JobFitResult> & { cv_experience_years?: number; job_required_years?: number };
      const score   = Math.max(0, Math.min(100, Number(parsed.score ?? 0)));
      const missing = Array.isArray(parsed.missing) ? parsed.missing.filter(Boolean).slice(0, 4) : [];

      // القرار بناءً على الـ score فقط — لا حواجز خبرة
      // المستخدم يريد التقديم على كل الوظائف المناسبة بغض النظر عن سنوات الخبرة
      const decision: "apply" | "skip" = score >= scoreThreshold ? "apply" : "skip";

      const matched = Array.isArray((parsed as any).matched) ? (parsed as any).matched.filter(Boolean).slice(0, 6) : [];
      return {
        score, decision,
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 4) : [],
        missing, matched, job_level: jobLevel,
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

  // ── التحقق من إيقاف التقديمات ─────────────────────────────────────────────
  try {
    const pauseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/system_settings?key=eq.applications_pause&select=value`,
      { headers: SB }
    );
    if (pauseRes.ok) {
      const pauseData = await pauseRes.json() as Array<{ value: { paused: boolean; until: string | null; reason: string } }>;
      const cfg = pauseData?.[0]?.value;
      if (cfg?.paused) {
        const until = cfg.until ? new Date(cfg.until) : null;
        if (!until || until > new Date()) {
          const msg = until
            ? `التقديمات موقوفة حتى ${until.toLocaleString("ar-SA")}${cfg.reason ? ` — السبب: ${cfg.reason}` : ""}`
            : `التقديمات موقوفة${cfg.reason ? ` — السبب: ${cfg.reason}` : ""}`;
          console.log(`[worker] ⏸️ ${msg}`);
          await tgSend(`⏸️ <b>Worker — تقديمات موقوفة</b>\n${msg}`);
          return { applied: 0, users: 0, errors: [], details: [], paused: true };
        } else {
          // انتهت مدة الإيقاف — ألغِ تلقائياً
          await fetch(`${SUPABASE_URL}/rest/v1/system_settings?key=eq.applications_pause`, {
            method: "PATCH", headers: SB,
            body: JSON.stringify({ value: { paused: false, until: null, reason: "", paused_at: null } }),
          });
        }
      }
    }
  } catch (e) {
    console.warn("[worker] تحذير: تعذّر التحقق من إعداد الإيقاف:", e);
  }
  // ──────────────────────────────────────────────────────────────────────────

  if (!ENC_KEY_HEX) {
    return { applied: 0, users: 0, errors: ["SMTP_ENCRYPTION_KEY غير معرّف في Supabase Secrets"], details: [] };
  }

  const jobsRaw = await sbGet("admin_jobs", { is_active: "eq.true" });
  const jobs = jobsRaw.filter((j) => isValidEmail(String(j.application_email ?? "").trim()));
  if (!jobs.length) return { applied: 0, users: 0, errors: [], details: [] };

  const [usersRaw, fieldsRaw] = await Promise.all([sbGet("users"), sbGet("job_fields")]);

  const today = new Date().toISOString().split("T")[0];

  // جمع عدد تقديمات اليوم لكل مستخدم بالتوازي (Promise.all) لتجنّب timeout
  const activeUsersRaw = usersRaw.filter(u => isActiveSubscription(u));
  const todayCounts = await Promise.all(
    activeUsersRaw.map(u => sbCount("applications", { user_id: `eq.${String(u.id)}`, applied_at: `gte.${today}` }))
  );
  const usersWithCount: Array<{ user: Record<string, unknown>; countToday: number }> = activeUsersRaw.map(
    (user, i) => ({ user, countToday: todayCounts[i] })
  );
  // ترتيب: الأقل تقديماً اليوم أولاً، ثم عشوائي داخل نفس العدد
  usersWithCount.sort((a, b) => a.countToday - b.countToday || (Math.random() - 0.5));

  // حد 2 تقديمات لكل مستخدم في كل دورة لضمان وصول كل المستخدمين
  const MAX_PER_CYCLE = 2;
  // حد 5 مستخدمين لكل run لضمان معالجة جميع المشتركين بشكل عادل
  const MAX_USERS_PER_RUN = 5;
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

    // جلب النص والملف المنظّم — يُخزَّنان مرة واحدة فقط
    const cvName = String(cv.file_name ?? "cv.pdf");
    const { parsedText: cvParsedText, profile: cvProfile } = await getOrParseCv(cv);

    const prefIds    = new Set(prefsRows.map((p) => String(p.job_field_id)).filter(Boolean));
    const fieldNamesBase = fieldsRaw
      .filter((f) => prefIds.has(String(f.id)))
      .map((f) => String(f.name_ar ?? f.name_en ?? ""));

    // دمج taxonomy_keywords من user_settings (تم توسيعها عند الحفظ)
    const taxonomyKws = Array.isArray(settings.taxonomy_keywords)
      ? (settings.taxonomy_keywords as string[]).map(String).filter(Boolean)
      : [];
    const fieldNames = [...new Set([...fieldNamesBase, ...taxonomyKws])];

    const certifications = certRows.map((c) => ({
      type:   String(c.type   ?? ""),
      name:   String(c.name   ?? ""),
      issuer: String(c.issuer ?? "") || undefined,
    }));

    const name      = String(user.full_name ?? "المتقدم");
    const phone     = String(user.phone ?? "");
    // حد اليوم (10) مع حد الدورة الواحدة (MAX_PER_CYCLE) لضمان العدالة بين المستخدمين
    const remaining = Math.min(MAX_PER_CYCLE, 10 - countToday);
    // إذا ما في تفضيلات ولا cv_profile ولا taxonomy → لا يمكن تحديد التخصص → تخطّى
    const hasPrefs   = fieldNames.length > 0;
    const hasProfile = !!(cvProfile?.specialization || cvProfile?.degree || cvProfile?.major);
    if (!hasPrefs && !hasProfile) {
      details.push({
        user: name, job: "—", status: "skipped",
        reason: "لا توجد تفضيلات وظيفية ولا ملف سيرة ذاتية محلَّل — يرجى إضافة التفضيلات أو رفع السيرة الذاتية",
      });
      continue;
    }

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
      const jobTitle = String(job.title_ar ?? job.title_en ?? "وظيفة"); // دائماً عربي للـ DB والتكرار
      const company  = String(job.company ?? "");
      const desc     = String(job.description_ar ?? job.description_en ?? "").slice(0, 1200);
      const toEmail  = String(job.application_email ?? "").trim();

      const displayJobTitle = jobTitle;

      // فحص التكرار محلياً بدون استعلامات DB إضافية
      const fingerprint = await jobFingerprint(jobTitle, toEmail, desc);

      if (
        appliedJobIds.has(jobId) ||
        appliedJobTitles.has(jobTitle) ||
        appliedFps.has(fingerprint)
      ) {
        details.push({ user: name, job: jobTitle, status: "skipped", reason: "قُدِّم مؤخراً (أقل من 30 يوم)" });
        continue;
      }

      // ── الفلاتر الرخيصة قبل استدعاء AI ─────────────────────────────────────

      if (!isValidEmail(toEmail)) {
        details.push({ user: name, job: jobTitle, status: "skipped", reason: `إيميل غير صالح: ${toEmail}` });
        continue;
      }

      // فلتر وظائف التمهير والتدريب التعاوني — ليست وظائف توظيف حقيقية
      const TRAINING_KEYWORDS = [
        "تمهير", "tamheer",
        "تدريب تعاوني", "cooperative training",
        "تدريب طلاب", "برنامج تدريبي للطلاب",
        "internship for students",
      ];
      const jobBlob = `${jobTitle} ${desc}`.toLowerCase();
      if (TRAINING_KEYWORDS.some(kw => jobBlob.includes(kw.toLowerCase()))) {
        details.push({ user: name, job: jobTitle, status: "skipped", reason: "وظيفة تمهير/تدريب تعاوني — محذوفة تلقائياً" });
        continue;
      }

      // مطابقة مبنية على تخصص السيرة الذاتية + تفضيلات المستخدم (بدون قيود كلمات صارمة)
      if (!jobMatchesUser(job, fieldNames, cvProfile)) {
        details.push({ user: name, job: jobTitle, status: "skipped", reason: "لا يطابق تخصص السيرة الذاتية" });
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

      // ── تحليل AI لمدى ملاءمة الوظيفة (prompt مختصر بالملف المنظّم) ─────────
      const fit = await analyzeJobFit(jobTitle, company, desc, cvParsedText, fieldNames, certifications, cvProfile);
      const levelLabel = { entry: "مبتدئ", junior: "جونيور", mid: "متوسط", senior: "متخصص" }[fit.job_level];
      console.log(`[worker] 🤖 ${name} ← ${jobTitle} | level=${fit.job_level}(${levelLabel}) | score=${fit.score} | ${fit.decision} | gender=${genderCheck.jobGender}(${genderCheck.confidence}) | missing=${fit.missing.join(", ") || "لا يوجد"}`);

      if (fit.decision === "skip") {
        const reason = `AI رفض [${levelLabel}] (${fit.score}/100): ${fit.reasons.slice(0, 2).join("؛ ")}${fit.missing.length ? " | ناقص: " + fit.missing.slice(0, 2).join("، ") : ""}`;
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
        const savedBody = String(settings.cover_letter_body ?? "").trim();
        let cover: string;
        if (savedBody) {
          // المستخدم عنده رسالة محفوظة (أو عدّل عليها) — استخدمها مباشرة بدون AI
          cover = buildCoverLetterFromSavedBody(name, displayJobTitle, company, phone, smtpEmail, "ar", savedBody);
        } else {
          // أول مرة: ولّد من القالب واحفظ النص في DB
          cover = generateCoverLetter(displayJobTitle, name, company, desc, "ar", cvParsedText, cvProfile, fit.score, phone, smtpEmail, certifications);
          const plainBody = buildPlainTextBody(displayJobTitle, name, cvProfile, certifications);
          await sbPatch("user_settings", { user_id: `eq.${uid}` }, { cover_letter_body: plainBody });
          settings.cover_letter_body = plainBody; // تحديث في الذاكرة لنفس الدورة
          console.log(`[worker] 💾 حُفظ cover letter لـ ${name}`);
        }
        cover = stripEmojis(cover);
        const html    = buildEmailHtml(name, phone, displayJobTitle, company, cover, "ar");
        const subject = `التقديم على وظيفة: ${stripEmojis(jobTitle)}`;

        // تنزيل ملف CV للإرفاق بالبريد (منفصل عن التحليل المخزّن)
        const storagePath = String(cv.storage_path ?? "").trim();
        const sendCvBytes = storagePath ? await downloadCv(storagePath) : null;

        await sendSmtp({
          smtpHost, smtpPort, smtpSecure, smtpEmail, appPassword,
          to: toEmail, subject, html, fromName: name, cvBytes: sendCvBytes, cvName,
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

// ─── وضع التجربة: إرسال قالب تجريبي لإيميل محدد باستخدام حساب أول مستخدم ─────

async function sendTestEmail(toEmail: string): Promise<{ ok: boolean; from?: string; error?: string }> {
  if (!ENC_KEY_HEX) return { ok: false, error: "SMTP_ENCRYPTION_KEY غير معرّف" };

  const settingsRows = await sbGet("user_settings", {
    select: "user_id,smtp_email,smtp_host,smtp_port,smtp_secure,smtp_app_password_encrypted",
    "email_connected": "eq.true",
    "smtp_app_password_encrypted": "not.is.null",
    "limit": "5",
  });

  if (!Array.isArray(settingsRows) || !settingsRows.length) {
    return { ok: false, error: "لا يوجد مستخدم مكتمل الإعداد" };
  }

  for (const s of settingsRows) {
    try {
      const userRows = await sbGet("users", { select: "full_name,phone", "id": `eq.${s.user_id}`, "limit": "1" });
      const cvRows   = await sbGet("user_cvs", { select: "cv_profile", "user_id": `eq.${s.user_id}`, "limit": "1" });

      const name    = userRows?.[0]?.full_name ?? "اسم المستخدم";
      const phone   = userRows?.[0]?.phone ?? "";
      const profile = (cvRows?.[0]?.cv_profile ?? null) as CvProfile | null;
      const appPw   = await decryptAES(String(s.smtp_app_password_encrypted), ENC_KEY_HEX);

      const html = buildCoverLetterTemplate(
        name, "مطوّر برمجيات (تجربة)", "شركة جوببوتس", profile,
        phone, String(s.smtp_email), "ar",
      );

      await sendSmtp({
        smtpHost: String(s.smtp_host ?? "smtp.gmail.com"),
        smtpPort: Number(s.smtp_port ?? 465),
        smtpSecure: Boolean(s.smtp_secure ?? true),
        smtpEmail: String(s.smtp_email),
        appPassword: appPw,
        to: toEmail,
        subject: "تجربة — قالب رسالة التقديم",
        html,
        fromName: name,
      });

      return { ok: true, from: String(s.smtp_email) };
    } catch (e) {
      console.error("[test-email]", e);
      continue;
    }
  }
  return { ok: false, error: "فشل الإرسال من جميع الحسابات" };
}

Deno.serve(async (req: Request) => {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  // وضع التجربة
  if (body.test_email && typeof body.test_email === "string") {
    console.log(`[worker] 📧 وضع التجربة → ${body.test_email}`);
    const result = await sendTestEmail(body.test_email);
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
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
    await cleanupInvalidApplications();
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
