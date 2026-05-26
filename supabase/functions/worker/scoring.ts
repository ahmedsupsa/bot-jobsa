// ─── Score Engine — يعطي درجة تطابق بدون AI ────────────────────────────────────
// قرار التقديم يعتمد على الدرجة فقط — لا Gemini في هذه الخطوة

import type { TaxonomyProfile } from "./matcher.ts";

export const MINIMUM_SCORE = 60; // حد أدنى للتقديم

export interface ScoreResult {
  score:   number;        // 0 – 100
  matched: string[];      // أسباب التطابق
  reason:  string;        // ملخص قصير
  apply:   boolean;       // قرار التقديم
}

interface ScoreInput {
  jobTitle:    string;
  jobDesc:     string;
  profile:     TaxonomyProfile;
  keywords:    string[];          // كلمات مفتاحية إضافية من المستخدم
  userCity?:   string;
  jobCity?:    string;
  cvProfile?:  {
    specialization?: string;
    experience_years?: number;
    skills?: string[];
  } | null;
}

// تقطيع النص لكلمات ذات معنى (>2 أحرف)
function words(text: string): string[] {
  return text.split(/[\s\-\/،,.،]+/).filter(w => w.length > 2);
}

// حساب تقاطع كلمتين
function wordOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter(w => setB.has(w)).length;
}

export function scoreJob(input: ScoreInput): ScoreResult {
  const { jobTitle, jobDesc, profile, keywords, cvProfile } = input;

  const titleLower = jobTitle.toLowerCase().trim();
  const descLower  = jobDesc.slice(0, 500).toLowerCase();
  const jobBlob    = `${titleLower} ${descLower}`;
  const titleWords = words(titleLower);

  const matched: string[] = [];
  let score = 0;

  // ── 1. تطابق تام مع مسمى في التاكسونومي → 100 ─────────────────────────────
  if (profile.titles.has(titleLower)) {
    score = 100;
    matched.push(`تطابق تام: "${jobTitle}"`);
    return { score, matched, reason: "تطابق تام مع التاكسونومي", apply: true };
  }

  // ── 2. المسمى الوظيفي يحتوي على مسمى تاكسونومي (أو العكس) → 90 ────────────
  for (const t of profile.titles) {
    const tWords = words(t);
    if (titleLower.includes(t) || t.includes(titleLower)) {
      score = Math.max(score, 90);
      matched.push(`شبه تطابق: "${t}"`);
      break;
    }
    // 2.5: تقاطع كلمتين أو أكثر مع مسمى تاكسونومي → 82
    const overlap = wordOverlap(titleWords, tWords);
    if (overlap >= 2) {
      score = Math.max(score, 82);
      matched.push(`تشابه ${overlap} كلمات مع: "${t}"`);
    } else if (overlap === 1 && titleWords.length <= 3) {
      // كلمة واحدة مشتركة في مسمى قصير — اعتبره 70
      score = Math.max(score, 70);
    }
  }

  // ── 3. تطابق اسم الفئة في نص الوظيفة → 65 ──────────────────────────────────
  if (score < 65) {
    for (const cat of profile.categories) {
      if (jobBlob.includes(cat) || cat.split(" ").some(w => w.length > 3 && titleLower.includes(w))) {
        score = Math.max(score, 65);
        matched.push(`فئة: "${cat}"`);
        break;
      }
    }
  }

  // ── 4. تطابق اسم التخصص (major) في نص الوظيفة → 65 ────────────────────────
  if (score < 65) {
    for (const maj of profile.majors) {
      if (jobBlob.includes(maj)) {
        score = Math.max(score, 65);
        matched.push(`تخصص: "${maj}"`);
        break;
      }
    }
  }

  // ── 5. كلمات مفتاحية مخصصة → 72 ────────────────────────────────────────────
  if (score < 72 && keywords.length) {
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase().trim();
      if (kwLower.length > 2 && jobBlob.includes(kwLower)) {
        score = Math.max(score, 72);
        matched.push(`كلمة مفتاحية: "${kw}"`);
        break;
      }
    }
  }

  // ── 6. تخصص السيرة الذاتية → 75 ────────────────────────────────────────────
  if (score < 75 && cvProfile?.specialization) {
    const spec = cvProfile.specialization.toLowerCase();
    const specWords = words(spec);
    const hit = specWords.some(w => w.length > 3 && jobBlob.includes(w));
    if (hit) {
      score = Math.max(score, 75);
      matched.push(`تخصص السيرة: "${cvProfile.specialization}"`);
    }
  }

  // ── مكافآت طفيفة ────────────────────────────────────────────────────────────
  if (score > 0) {
    // مهارات السيرة الذاتية
    if (cvProfile?.skills?.length) {
      const skillHits = cvProfile.skills.filter(s => s.length > 2 && jobBlob.includes(s.toLowerCase())).length;
      score = Math.min(100, score + Math.min(skillHits * 2, 6));
      if (skillHits) matched.push(`${skillHits} مهارة مطابقة`);
    }
  }

  const apply  = score >= MINIMUM_SCORE;
  const reason = apply
    ? `✅ مؤهل (${score}/100): ${matched.slice(0, 2).join("، ") || "—"}`
    : `❌ لا يطابق (${score}/100)${matched.length ? ": " + matched[0] : ""}`;

  return { score, matched, reason, apply };
}
