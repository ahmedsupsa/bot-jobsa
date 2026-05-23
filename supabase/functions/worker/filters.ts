// ─── Filters — فلاتر رخيصة (بدون AI) ─────────────────────────────────────────

import { normalizeCity } from "./normalizer.ts";

// ── فلتر التمهير والتدريب التعاوني ────────────────────────────────────────────
const TRAINING_KEYWORDS = [
  "تمهير", "tamheer",
  "تدريب تعاوني", "cooperative training", "co-op",
  "تدريب طلاب", "برنامج تدريبي للطلاب",
  "internship for students",
];

export function isTrainingJob(jobTitle: string, jobDesc: string): boolean {
  const blob = `${jobTitle} ${jobDesc.slice(0, 400)}`.toLowerCase();
  return TRAINING_KEYWORDS.some(kw => blob.includes(kw.toLowerCase()));
}

// ── فلتر المدينة ──────────────────────────────────────────────────────────────
const REMOTE_KEYWORDS = ["عن بعد", "remote", "أونلاين", "online", "work from home"];

export function cityMatches(userCity: string, jobCity: string): boolean {
  if (!userCity || !jobCity) return true;
  if (REMOTE_KEYWORDS.some(kw => jobCity.toLowerCase().includes(kw))) return true;

  const u = normalizeCity(userCity);
  const j = normalizeCity(jobCity);
  return u === j || j.includes(u) || u.includes(j);
}

// ── فلتر الجنس ────────────────────────────────────────────────────────────────

const FEMALE_EXPLICIT = [
  "للسيدات", "للنساء", "للإناث", "نسائي", "نسائية", "قسم نسائي",
  "موظفات", "استقبال نسائي", "مبيعات نسائية", "فرع نسائي",
  "للمرأة", "سيدات فقط", "إناث فقط", "قسم النساء", "أقسام نسائية",
  "سيدة", "امرأة فقط", "بنات فقط",
];

const FEMALE_JOB_TITLES = [
  "سكرتيرة", "سكرتيره", "موظفة استقبال", "موظفه استقبال",
  "مساعدة إدارية", "مساعده ادارية", "أمينة سر", "امينة سر",
  "كاشيرة", "كاشيره", "مشرفة مبيعات", "مندوبة مبيعات",
  "موظفة مبيعات", "بائعة",
  "ممرضة", "ممرضه", "قابلة", "مولّدة",
  "معلمة", "مدرّسة", "مدرسة", "مشرفة طالبات",
  "مصففة", "خياطة", "حلاقة", "مكيّجة", "إخصائية تجميل", "أخصائية تجميل",
  "مربية", "حاضنة", "عاملة منزلية",
  "أخصائية", "إخصائية", "مشرفة", "مديرة",
  "مستشارة", "مصممة", "مهندسة", "محللة", "منسقة",
  "مدققة", "مقيّمة", "باحثة", "مطورة",
  "موظفة", "مسؤولة",
];

const MALE_EXPLICIT = [
  "للرجال", "رجال فقط", "موظفين رجال", "ذكور فقط", "للذكور",
  "حارس أمن", "رجل أمن", "أمن رجالي", "نجار", "سباك", "لحام", "بواب",
];

export type JobGender = "female" | "male" | "neutral";

export interface GenderCheckResult {
  jobGender:  JobGender;
  confidence: "explicit" | "implicit" | "none";
  reason:     string;
}

export function detectJobGender(
  title: string,
  description: string,
): GenderCheckResult {
  const blob = `${title} ${description}`.toLowerCase();

  for (const kw of FEMALE_EXPLICIT) {
    if (blob.includes(kw.toLowerCase())) {
      return { jobGender: "female", confidence: "explicit", reason: `مخصصة للنساء: "${kw}"` };
    }
  }

  for (const kw of MALE_EXPLICIT) {
    if (blob.includes(kw.toLowerCase())) {
      return { jobGender: "male", confidence: "explicit", reason: `مخصصة للرجال: "${kw}"` };
    }
  }

  const titleLower = title.toLowerCase();
  for (const ft of FEMALE_JOB_TITLES) {
    if (titleLower.includes(ft.toLowerCase())) {
      return { jobGender: "female", confidence: "implicit", reason: `عنوان نسائي: "${ft}"` };
    }
  }

  return { jobGender: "neutral", confidence: "none", reason: "محايدة" };
}

export function genderConflict(userGender: string, job: GenderCheckResult): string | null {
  if (job.jobGender === "neutral") return null;
  const isConflict =
    (job.jobGender === "female" && userGender !== "female") ||
    (job.jobGender === "male"   && userGender === "female");
  if (!isConflict) return null;
  return job.jobGender === "female"
    ? `الوظيفة للنساء — حساب المستخدم ذكر (${job.reason})`
    : `الوظيفة للرجال — حساب المستخدم أنثى (${job.reason})`;
}

// ── فلتر الحد اليومي ──────────────────────────────────────────────────────────
export const MAX_PER_DAY    = 10;
export const MAX_PER_CYCLE  = 3;  // أقصى عدد تقديمات لكل مستخدم في دورة واحدة
export const MAX_USERS_PER_RUN = 6; // أقصى عدد مستخدمين لكل تشغيل
