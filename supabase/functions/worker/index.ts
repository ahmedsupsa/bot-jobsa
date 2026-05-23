// ─── Auto Apply Worker v2 ─────────────────────────────────────────────────────
// معمارية جديدة: Normalizer → Matcher → Score → Filter → Queue → Apply
// لا AI في خطوة المطابقة — يعتمد على jobs_taxonomy.json فقط
// AI يُستخدم فقط لـ: تحليل PDF السيرة الذاتية (مرة واحدة ومحفوظة)

import nodemailer from "npm:nodemailer@6";
import { buildUserProfile, getMajorNames }    from "./matcher.ts";
import { scoreJob, MINIMUM_SCORE }            from "./scoring.ts";
import {
  isTrainingJob, cityMatches, detectJobGender, genderConflict,
  MAX_PER_DAY, MAX_PER_CYCLE, MAX_USERS_PER_RUN,
} from "./filters.ts";
import { buildCoverLetterHtml, buildPlainBody, stripEmojis } from "./apply.ts";
import { processQueue }                        from "./queue.ts";
import type { QueueItem }                      from "./queue.ts";

// ─── Env ──────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_KEY    = Deno.env.get("GEMINI_API_KEY") ?? "";
const WORKER_SECRET = Deno.env.get("WORKER_SECRET") ?? "";
const ENC_KEY_HEX   = Deno.env.get("SMTP_ENCRYPTION_KEY") ?? "";
const TG_BOT        = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT       = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
const APP_URL       = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

const SB = {
  apikey:         SUPABASE_KEY,
  Authorization:  `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer:         "return=representation",
};

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// ─── Supabase Helpers ─────────────────────────────────────────────────────────

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

async function sbUpsert(table: string, data: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...SB, "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(data),
  });
  if (!r.ok) console.error(`[worker] sbUpsert(${table}) ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function sbPatch(table: string, filter: Record<string, string>, data: Record<string, unknown>) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(filter)) url.searchParams.set(k, v);
  await fetch(url.toString(), { method: "PATCH", headers: SB, body: JSON.stringify(data) });
}

async function sbInsert(table: string, data: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: SB, body: JSON.stringify(data),
  });
  if (!r.ok) console.error(`[worker] sbInsert(${table}) ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

// ─── AES-256-GCM Decryption ───────────────────────────────────────────────────

async function decryptAES(encrypted: string, keyHex: string): Promise<string> {
  const parts = encrypted.split(":");
  if (parts.length !== 2) throw new Error("تنسيق التشفير غير صحيح");
  const keyBytes  = new Uint8Array(keyHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const iv        = Uint8Array.from(atob(parts[0]), c => c.charCodeAt(0));
  const rawData   = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
  const tag        = rawData.slice(0, 16);
  const ciphertext = rawData.slice(16);
  const data       = new Uint8Array([...ciphertext, ...tag]);
  const cryptoKey  = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain      = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
  return new TextDecoder().decode(plain);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActiveSubscription(user: Record<string, unknown>): boolean {
  const ends = String(user.subscription_ends_at ?? "");
  if (!ends) return false;
  try { return new Date(ends) > new Date(); } catch { return false; }
}

function isValidEmail(addr: string): boolean {
  return EMAIL_RE.test((addr ?? "").trim());
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function jobFingerprint(title: string, email: string, desc: string): Promise<string> {
  const text  = `${title}|${email}|${desc.slice(0, 500)}`;
  const bytes = new TextEncoder().encode(text);
  const hash  = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── CV Parsing (يُخزَّن مرة واحدة فقط) ──────────────────────────────────────

interface CvProfile {
  degree:           string;
  specialization:   string;
  experience_years: number;
  skills:           string[];
  languages:        string[];
  prev_jobs:        string[];
  is_fresh_graduate: boolean;
}

async function downloadCv(storagePath: string): Promise<Uint8Array | null> {
  const url = `${SUPABASE_URL}/storage/v1/object/cvs/${storagePath}`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) return null;
  return new Uint8Array(await r.arrayBuffer());
}

async function parseCvBytesWithAI(cvBytes: Uint8Array, cvMime: string): Promise<string | null> {
  if (!GEMINI_KEY || !cvBytes.length) return null;
  const parts = [
    { inline_data: { mime_type: cvMime, data: toBase64(cvBytes) } },
    { text: "استخرج من هذه السيرة الذاتية: المؤهل والتخصص، سنوات الخبرة، الوظائف السابقة، المهارات، اللغات. اكتب فقط ما هو موجود." },
  ];
  for (const model of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"]) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }] }) },
      );
      if (!r.ok) continue;
      const d = await r.json();
      const text = (d?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
      if (text) return text;
    } catch { continue; }
  }
  return null;
}

async function parseCvProfileFromText(cvText: string): Promise<CvProfile | null> {
  if (!GEMINI_KEY || !cvText.trim()) return null;
  const prompt =
    `استخرج البيانات من السيرة الذاتية. أعد JSON فقط بدون markdown:\n` +
    `{"degree":"المؤهل","specialization":"التخصص","experience_years":0,"skills":["مهارة"],"languages":["العربية"],"prev_jobs":["مسمى - جهة"],"is_fresh_graduate":false}\n` +
    `experience_years: -1=غير محدد | 0=حديث تخرج | رقم موجب=سنوات\n\n${cvText.slice(0, 1800)}`;
  for (const model of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"]) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) },
      );
      if (!r.ok) continue;
      const d = await r.json();
      const text = (d?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) continue;
      const p = JSON.parse(m[0]);
      return {
        degree:           String(p.degree || ""),
        specialization:   String(p.specialization || ""),
        experience_years: typeof p.experience_years === "number" ? p.experience_years : -1,
        skills:           Array.isArray(p.skills)    ? p.skills.slice(0, 15).map(String) : [],
        languages:        Array.isArray(p.languages) ? p.languages.map(String)           : [],
        prev_jobs:        Array.isArray(p.prev_jobs) ? p.prev_jobs.slice(0, 5).map(String) : [],
        is_fresh_graduate: !!p.is_fresh_graduate,
      };
    } catch { continue; }
  }
  return null;
}

async function getOrParseCv(cv: Record<string, unknown>): Promise<{
  parsedText: string | null;
  profile:    CvProfile | null;
}> {
  const cvId     = String(cv.id ?? "");
  const cvName   = String(cv.file_name ?? "cv.pdf");
  const cvMime   = cvName.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : cvName.toLowerCase().endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/octet-stream";

  const existingText    = String(cv.cv_parsed_text ?? "").trim() || null;
  const existingProfile = (cv.cv_profile ?? null) as CvProfile | null;

  if (existingText && existingProfile) return { parsedText: existingText, profile: existingProfile };

  let parsedText = existingText;
  if (!parsedText) {
    const path     = String(cv.storage_path ?? "").trim();
    const cvBytes  = path ? await downloadCv(path) : null;
    if (!cvBytes) return { parsedText: null, profile: null };
    parsedText = await parseCvBytesWithAI(cvBytes, cvMime);
    if (parsedText && cvId) {
      await sbPatch("user_cvs", { id: `eq.${cvId}` }, {
        cv_parsed_text: parsedText, cv_parsed_at: new Date().toISOString(),
      });
    }
  }

  let profile: CvProfile | null = existingProfile;
  if (!profile && parsedText) {
    profile = await parseCvProfileFromText(parsedText);
    if (profile && cvId) {
      await sbPatch("user_cvs", { id: `eq.${cvId}` }, { cv_profile: profile });
    }
  }

  return { parsedText, profile };
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

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

// ─── Weekly Report ────────────────────────────────────────────────────────────

async function maybeSendWeeklyReport() {
  if (!APP_URL || !WORKER_SECRET) return;
  const now = new Date();
  const ksa = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  if (ksa.getDay() !== 0) return;
  const hour = ksa.getHours();
  if (hour < 8 || hour >= 9) return;

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/worker_status?select=weekly_report_last_sent&limit=1`, { headers: SB });
    const rows: Array<{ weekly_report_last_sent: string | null }> = await r.json();
    const lastSent = rows?.[0]?.weekly_report_last_sent;
    if (lastSent && (Date.now() - new Date(lastSent).getTime()) / 86_400_000 < 6) return;
  } catch { /* نتجاهل */ }

  try {
    const res  = await fetch(`${APP_URL}/api/internal/weekly-report`, {
      method: "POST",
      headers: { "x-worker-secret": WORKER_SECRET, "Content-Type": "application/json" },
    });
    const json = await res.json();
    if (json.ok) {
      await tgSend(`📊 <b>التقرير الأسبوعي أُرسل</b>\nإلى: ${json.sentTo}\nالتقديمات: ${json.stats?.totalSent || 0} ✅`);
    }
  } catch { /* silent */ }
}

// ─── Achievement Notifications ────────────────────────────────────────────────

async function notifyAchievements() {
  if (!APP_URL || !WORKER_SECRET) return;
  try {
    await fetch(`${APP_URL}/api/internal/notify-achievements`, {
      method: "POST",
      headers: { "x-worker-secret": WORKER_SECRET, "Content-Type": "application/json" },
    });
  } catch { /* silent */ }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanupInvalidApplications() {
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/applications`);
    url.searchParams.set("hidden_from_user", "eq.false");
    url.searchParams.set("invalid_application", "eq.false");
    url.searchParams.set("or", "(skip_reason.ilike.*نساء*ذكر*,skip_reason.ilike.*رجال*أنثى*)");
    await fetch(url.toString(), {
      method: "PATCH",
      headers: { ...SB, "Prefer": "return=minimal" },
      body: JSON.stringify({ hidden_from_user: true, invalid_application: true, application_status: "invalid" }),
    });
  } catch { /* silent */ }
}

// ─── Log Run ──────────────────────────────────────────────────────────────────

async function logRun(data: {
  applied_count: number; active_users: number;
  errors: string[]; duration_ms: number; status: string;
}) {
  try {
    await sbInsert("worker_logs", {
      ...data,
      errors:  JSON.stringify(data.errors),
      ran_at:  new Date().toISOString(),
    });
  } catch { /* silent */ }
}

// ─── Main Cycle ───────────────────────────────────────────────────────────────

type Detail = { user: string; job: string; status: "sent" | "skipped" | "error"; reason?: string };

async function runCycle() {
  const errors:  string[] = [];
  const details: Detail[] = [];
  let applied = 0, activeUsers = 0;

  // ── فحص إيقاف التقديمات ─────────────────────────────────────────────────────
  try {
    const pauseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/system_settings?key=eq.applications_pause&select=value`,
      { headers: SB },
    );
    if (pauseRes.ok) {
      const cfg = ((await pauseRes.json()) as Array<{ value: { paused: boolean; until?: string; reason?: string } }>)?.[0]?.value;
      if (cfg?.paused) {
        const until = cfg.until ? new Date(cfg.until) : null;
        if (!until || until > new Date()) {
          const msg = `التقديمات موقوفة${cfg.reason ? ` — ${cfg.reason}` : ""}`;
          console.log(`[worker] ⏸️ ${msg}`);
          await tgSend(`⏸️ <b>Worker — تقديمات موقوفة</b>\n${msg}`);
          return { applied: 0, users: 0, errors: [], details: [], paused: true };
        }
        await fetch(`${SUPABASE_URL}/rest/v1/system_settings?key=eq.applications_pause`, {
          method: "PATCH", headers: SB,
          body: JSON.stringify({ value: { paused: false, until: null, reason: "", paused_at: null } }),
        });
      }
    }
  } catch { /* silent */ }

  if (!ENC_KEY_HEX) {
    return { applied: 0, users: 0, errors: ["SMTP_ENCRYPTION_KEY غير معرّف"], details: [] };
  }

  // ── جلب الوظائف النشطة ────────────────────────────────────────────────────
  const jobsRaw = await sbGet("admin_jobs", { is_active: "eq.true" });
  const jobs    = jobsRaw.filter(j =>
    isValidEmail(String(j.application_email ?? "").trim())
  );
  if (!jobs.length) {
    console.log("[worker] لا توجد وظائف نشطة.");
    return { applied: 0, users: 0, errors: [], details: [] };
  }
  console.log(`[worker] 📋 ${jobs.length} وظيفة نشطة`);

  // ── جلب المستخدمين ───────────────────────────────────────────────────────
  const usersRaw      = await sbGet("users");
  const activeRaw     = usersRaw.filter(isActiveSubscription);
  const today         = new Date().toISOString().split("T")[0];

  const todayCounts   = await Promise.all(
    activeRaw.map(u => sbCount("applications", { user_id: `eq.${String(u.id)}`, applied_at: `gte.${today}` }))
  );

  const usersWithCount = activeRaw
    .map((user, i) => ({ user, countToday: todayCounts[i] }))
    .filter(x => x.countToday < MAX_PER_DAY)
    .sort((a, b) => a.countToday - b.countToday || (Math.random() - 0.5));

  console.log(`[worker] 👥 ${usersWithCount.length} مستخدم نشط (لم يبلغ حد اليوم)`);

  let processedUsers = 0;

  for (const { user, countToday } of usersWithCount) {
    if (processedUsers >= MAX_USERS_PER_RUN) break;
    processedUsers++;
    activeUsers++;

    const uid  = String(user.id);
    const name = String(user.full_name ?? uid);

    // ── جلب بيانات المستخدم بالتوازي ─────────────────────────────────────────
    const [settingsRows, cvRows] = await Promise.all([
      sbGet("user_settings", { user_id: `eq.${uid}` }),
      sbGet("user_cvs",      { user_id: `eq.${uid}` }),
    ]);

    const settings    = settingsRows[0] ?? {};
    const smtpEmail   = String(settings.smtp_email ?? "").trim();
    const smtpHost    = String(settings.smtp_host  ?? "smtp.gmail.com");
    const smtpPort    = Number(settings.smtp_port  ?? 465);
    const smtpSecure  = settings.smtp_secure !== false;
    const encryptedPw = String(settings.smtp_app_password_encrypted ?? "").trim();
    const hasSmtp     = !!(settings.email_connected && smtpEmail && encryptedPw);
    const savedBody   = String(settings.cover_letter_body ?? "").trim();
    const userCity    = String(user.city ?? "").trim();
    const userGender  = String(user.gender ?? "male");
    const lang        = String(settings.preferred_language ?? "ar");

    if (!smtpEmail) {
      details.push({ user: name, job: "—", status: "skipped", reason: "لم يُضف إيميله" });
      continue;
    }
    if (!hasSmtp) {
      details.push({ user: name, job: "—", status: "skipped", reason: "لم يربط Gmail App Password" });
      continue;
    }

    let appPassword = "";
    try {
      appPassword = await decryptAES(encryptedPw, ENC_KEY_HEX);
    } catch (e) {
      errors.push(`${name}: فشل فك التشفير — ${String(e)}`);
      continue;
    }

    const cv = cvRows[0];
    if (!cv) {
      details.push({ user: name, job: "—", status: "skipped", reason: "لا توجد سيرة ذاتية" });
      continue;
    }

    // ── جلب وتحليل السيرة الذاتية (مرة واحدة فقط، ثم تُخزَّن) ───────────────
    const { profile: cvProfile } = await getOrParseCv(cv);
    const cvName = String(cv.file_name ?? "cv.pdf");

    // ── بناء ملف التاكسونومي للمستخدم ─────────────────────────────────────────
    const majorIds: string[] = Array.isArray(settings.taxonomy_major_ids)
      ? (settings.taxonomy_major_ids as string[]).map(String)
      : [];

    const taxonomyKws: string[] = Array.isArray(settings.taxonomy_keywords)
      ? (settings.taxonomy_keywords as string[]).map(String).filter(Boolean)
      : [];

    // إذا لم يحدد المستخدم تخصصات ولا cv_profile → تخطّى
    const hasProfile = !!(cvProfile?.specialization || cvProfile?.degree);
    if (!majorIds.length && !taxonomyKws.length && !hasProfile) {
      details.push({ user: name, job: "—", status: "skipped", reason: "لا توجد تفضيلات وظيفية ولا ملف سيرة محلَّل" });
      continue;
    }

    const taxonomyProfile = buildUserProfile(majorIds);
    const majorNames      = getMajorNames(majorIds);
    console.log(`[worker] 👤 ${name} | تخصصات: ${majorNames.join("، ") || "—"} | كلمات: ${taxonomyKws.join("، ") || "—"}`);

    // ── تاريخ التقديمات السابقة (30 يوم) ──────────────────────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentApps    = await sbGet("applications", {
      user_id:    `eq.${uid}`,
      applied_at: `gte.${thirtyDaysAgo}`,
      select:     "job_id,job_title,job_fingerprint",
    });
    const appliedJobIds    = new Set(recentApps.map(a => String(a.job_id)));
    const appliedJobTitles = new Set(recentApps.map(a => String(a.job_title)));
    const appliedFps       = new Set(recentApps.map(a => String(a.job_fingerprint ?? "")).filter(Boolean));

    const remaining = Math.min(MAX_PER_CYCLE, MAX_PER_DAY - countToday);
    const queue: QueueItem[] = [];

    // ─── بناء Queue ──────────────────────────────────────────────────────────
    for (const job of jobs) {
      if (queue.length >= remaining) break;

      const jobId    = String(job.id);
      const jobTitle = String(job.title_ar ?? job.title_en ?? "وظيفة");
      const company  = String(job.company ?? "");
      const desc     = String(job.description_ar ?? job.description_en ?? "").slice(0, 1200);
      const toEmail  = String(job.application_email ?? "").trim();
      const jobCity  = String(job.city ?? "").trim();

      // ── فلتر التكرار ───────────────────────────────────────────────────────
      const fingerprint = await jobFingerprint(jobTitle, toEmail, desc);
      if (appliedJobIds.has(jobId) || appliedJobTitles.has(jobTitle) || appliedFps.has(fingerprint)) {
        details.push({ user: name, job: jobTitle, status: "skipped", reason: "قُدِّم مؤخراً (أقل من 30 يوم)" });
        continue;
      }

      // ── فلتر البريد الإلكتروني ─────────────────────────────────────────────
      if (!isValidEmail(toEmail)) continue;

      // ── فلتر التمهير / التدريب ─────────────────────────────────────────────
      if (isTrainingJob(jobTitle, desc)) {
        details.push({ user: name, job: jobTitle, status: "skipped", reason: "وظيفة تمهير/تدريب" });
        continue;
      }

      // ── فلتر الجنس ─────────────────────────────────────────────────────────
      const genderResult = detectJobGender(jobTitle, desc);
      const gConflict    = genderConflict(userGender, genderResult);
      if (gConflict) {
        details.push({ user: name, job: jobTitle, status: "skipped", reason: gConflict });
        await sbUpsert("applications", {
          user_id: uid, job_id: jobId, job_title: jobTitle,
          applied_at: new Date().toISOString(),
          status: "skipped", application_status: "invalid",
          hidden_from_user: true, invalid_application: true,
          hidden_reason: gConflict, skip_reason: gConflict,
          match_score: 0, job_fingerprint: fingerprint,
          provider_used: null,
        });
        continue;
      }

      // ── Score Engine (بدون AI) ──────────────────────────────────────────────
      const scored = scoreJob({
        jobTitle,
        jobDesc:   desc,
        profile:   taxonomyProfile,
        keywords:  taxonomyKws,
        userCity,
        jobCity,
        cvProfile: cvProfile as Record<string, unknown> | null,
      });

      console.log(`[worker] 🎯 ${name} ← ${jobTitle} | score=${scored.score} | ${scored.reason}`);

      if (!scored.apply) {
        details.push({ user: name, job: jobTitle, status: "skipped", reason: scored.reason });
        continue;
      }

      // ── تنزيل ملف السيرة الذاتية (للإرفاق) ────────────────────────────────
      const storagePath = String(cv.storage_path ?? "").trim();
      const cvBytes     = storagePath ? await downloadCv(storagePath) : null;

      queue.push({
        userId:      uid,
        userName:    name,
        userPhone:   String(user.phone ?? ""),
        userEmail:   smtpEmail,
        smtpHost, smtpPort, smtpSecure, appPassword,
        jobId, jobTitle, company, toEmail, jobDesc: desc,
        savedBody,
        cvBytes, cvName,
        cvProfile: cvProfile as Record<string, unknown> | null,
        score:       scored.score,
        matchedTerms: scored.matched,
        fingerprint, lang,
      });
    }

    if (!queue.length) {
      console.log(`[worker] ${name}: لا توجد وظائف تستوفي الحد الأدنى (${MINIMUM_SCORE})`);
      continue;
    }

    console.log(`[worker] 📬 ${name}: ${queue.length} وظيفة في القائمة`);

    // ─── معالجة Queue ─────────────────────────────────────────────────────────
    const qResult = await processQueue(queue, async (item) => {
      const sentAt = new Date().toISOString();
      let status: "sent" | "error" = "sent";
      let errorReason: string | null = null;

      try {
        // إذا ما في saved body → ابنِ من القالب واحفظ
        let currentSavedBody = item.savedBody;
        if (!currentSavedBody) {
          currentSavedBody = buildPlainBody(item);
          await sbPatch("user_settings", { user_id: `eq.${item.userId}` }, { cover_letter_body: currentSavedBody });
          console.log(`[worker] 💾 حُفظ cover letter لـ ${item.userName}`);
          item = { ...item, savedBody: currentSavedBody };
        }

        const rawHtml = buildCoverLetterHtml(item);
        const html    = stripEmojis(rawHtml);

        // SMTP إرسال
        const transporter = nodemailer.createTransport({
          host: item.smtpHost, port: item.smtpPort, secure: item.smtpSecure,
          auth: { user: item.userEmail, pass: item.appPassword },
          connectionTimeout: 20_000, greetingTimeout: 15_000,
        });
        const mailOptions: Record<string, unknown> = {
          from:    `${item.userName} <${item.userEmail}>`,
          to:      item.toEmail,
          subject: `التقديم على وظيفة: ${stripEmojis(item.jobTitle)}`,
          html,
          replyTo: item.userEmail,
        };
        if (item.cvBytes && item.cvName) {
          mailOptions.attachments = [{ filename: item.cvName, content: item.cvBytes }];
        }
        await transporter.sendMail(mailOptions);

        applied++;
        details.push({ user: item.userName, job: item.jobTitle, status: "sent", reason: `score=${item.score}/100 — ${item.matchedTerms[0] ?? ""}` });
        console.log(`[worker] ✅ ${item.userName} → ${item.jobTitle} (${item.toEmail}) | score=${item.score}`);

      } catch (e) {
        status = "error";
        errorReason = String(e).slice(0, 500);
        errors.push(`${item.userName} → ${item.jobTitle}: ${errorReason}`);
        details.push({ user: item.userName, job: item.jobTitle, status: "error", reason: errorReason });
        console.error(`[worker] ❌ ${item.userName} → ${item.jobTitle}: ${errorReason}`);
      }

      await sbUpsert("applications", {
        user_id: item.userId,    job_id:  item.jobId,     job_title:          item.jobTitle,
        applied_at: sentAt,     status,                   provider_used:      "smtp",
        application_status:     status === "sent" ? "applied" : "error",
        hidden_from_user:       false,
        invalid_application:    false,
        error_reason:           errorReason,
        sent_at:                status === "sent" ? sentAt : null,
        match_score:            item.score,
        job_fingerprint:        item.fingerprint,
        decision_reasons:       item.matchedTerms,
        missing_skills:         [],
        matched_skills:         item.matchedTerms,
        skip_reason:            null,
      });

      return { result: status };
    }, 5);

    console.log(`[worker] ${name}: أُرسل ${qResult.sent} | خطأ ${qResult.errors}`);
  }

  return { applied, users: activeUsers, errors, details };
}

// ─── Telegram Report ──────────────────────────────────────────────────────────

async function tgWorkerResult(
  applied: number, users: number, durationSec: number,
  details: Detail[],
) {
  const successLines = details.filter(d => d.status === "sent")
    .map(d => `  ✅ ${d.user} ← ${d.job}`);
  const errorLines = details.filter(d => d.status === "error")
    .map(d => `  ⚠️ ${d.user} → ${d.job}: ${(d.reason ?? "خطأ").slice(0, 80)}`);

  if (applied === 0 && !errorLines.length) return;

  let msg = `🤖 <b>Worker اكتمل</b>\nالتقديمات: ${applied} | المستفيدون: ${users} | المدة: ${durationSec}ث\n`;
  if (successLines.length) {
    msg += `\n<b>قُدِّم بنجاح:</b>\n` + successLines.slice(0, 15).join("\n");
    if (successLines.length > 15) msg += `\n  ... و${successLines.length - 15} أخرى`;
  }
  if (errorLines.length) {
    msg += `\n\n<b>أخطاء:</b>\n` + errorLines.slice(0, 8).join("\n");
  }
  msg += `\n🕐 ${nowAr()}`;
  await tgSend(msg);
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // التحقق من الـ Authorization header
  const auth = req.headers.get("Authorization") ?? "";
  if (WORKER_SECRET && auth !== `Bearer ${WORKER_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  // وضع التجربة (test_email)
  if (body.test_email && typeof body.test_email === "string") {
    return new Response(
      JSON.stringify({ ok: false, error: "استخدم بوت التجربة في لوحة التحكم" }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  console.log(`[worker] 🚀 بدء دورة Worker v2 — ${nowAr()}`);
  const t0 = Date.now();

  try {
    const result      = await runCycle();
    const duration_ms = Date.now() - t0;
    const status      = result.errors.length === 0 ? "success"
      : result.applied > 0 ? "partial" : "error";

    await Promise.all([
      logRun({ applied_count: result.applied, active_users: result.users, errors: result.errors, duration_ms, status }),
      tgWorkerResult(result.applied, result.users, Math.round(duration_ms / 1000), result.details),
      cleanupInvalidApplications(),
      maybeSendWeeklyReport(),
      notifyAchievements(),
    ]);

    // تحديث worker_status
    try {
      const statusUrl = new URL(`${SUPABASE_URL}/rest/v1/worker_status`);
      statusUrl.searchParams.set("select", "id");
      const existing = await fetch(statusUrl.toString(), { headers: SB });
      const rows     = await existing.json() as Array<{ id: string }>;
      const method   = rows?.length ? "PATCH" : "POST";
      const patchUrl = rows?.length
        ? `${SUPABASE_URL}/rest/v1/worker_status?id=eq.${rows[0].id}`
        : `${SUPABASE_URL}/rest/v1/worker_status`;
      await fetch(patchUrl, {
        method, headers: SB,
        body: JSON.stringify({ last_run: new Date().toISOString(), last_applied: result.applied }),
      });
    } catch { /* silent */ }

    console.log(`[worker] ✅ انتهت الدورة: ${result.applied} تقديم | ${Math.round(duration_ms / 1000)}ث`);
    return new Response(
      JSON.stringify({ ok: true, ...result, duration_ms }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    const duration_ms = Date.now() - t0;
    const msg = String(e);
    console.error(`[worker] ❌ خطأ عام: ${msg}`);
    await logRun({ applied_count: 0, active_users: 0, errors: [msg], duration_ms, status: "error" });
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
