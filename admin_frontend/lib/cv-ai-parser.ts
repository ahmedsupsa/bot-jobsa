import { CvProfile, parseCvText } from "./cv-parser";

export type { CvProfile } from "./cv-parser";

let _hfToken: string | null = null;
export function setHfToken(token: string) { _hfToken = token; }

function getHfToken(): string | null {
  if (_hfToken) return _hfToken;
  if (typeof process !== "undefined" && process.env?.HF_TOKEN) return process.env.HF_TOKEN;
  return null;
}

const HF_API = "https://api-inference.huggingface.co/models";

async function hfGenerate(prompt: string, model: string): Promise<string | null> {
  const token = getHfToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${HF_API}/${model}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 1024, temperature: 0.1, return_full_text: false },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[cv-ai] HF API error ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    return data?.[0]?.generated_text || null;
  } catch {
    return null;
  }
}

const MODELS = [
  "google/gemma-2-2b-it",
  "microsoft/Phi-3-mini-4k-instruct",
];

function extractJson(text: string): Record<string, unknown> | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try { return JSON.parse(jsonMatch[0]); } catch { return null; }
}

function mapToProfile(data: Record<string, unknown>): Partial<CvProfile> {
  const p: Partial<CvProfile> = {};

  if (typeof data.name === "string" && data.name.trim().length > 3) p.name = data.name.trim();

  if (typeof data.phone === "string") {
    const clean = data.phone.replace(/[\s\-]/g, "");
    if (clean.length >= 9) p.phone = clean;
  }

  if (typeof data.email === "string" && data.email.includes("@")) p.email = data.email.trim();

  if (typeof data.city === "string" && data.city.trim().length > 1) p.city = data.city.trim();

  if (data.degree || data.major || data.university) {
    p.education = {};
    if (typeof data.degree === "string") p.education.degree = data.degree;
    if (typeof data.major === "string") p.education.major = data.major;
    if (typeof data.university === "string") p.education.university = data.university;
    if (typeof data.graduation_year === "number") p.education.year = String(data.graduation_year);
    else if (typeof data.graduation_year === "string") p.education.year = data.graduation_year;
    if (typeof data.gpa === "string") p.education.gpa = data.gpa;
    if (Object.keys(p.education).length === 0) p.education = undefined;
  }

  if (typeof data.experience_years === "number") p.experience_years = data.experience_years;

  if (Array.isArray(data.skills)) {
    p.skills = data.skills.filter(s => typeof s === "string" && s.length > 1);
    if (p.skills.length === 0) p.skills = undefined;
  }

  if (Array.isArray(data.soft_skills)) {
    p.soft_skills = data.soft_skills.filter(s => typeof s === "string" && s.length > 1);
    if (p.soft_skills.length === 0) p.soft_skills = undefined;
  }

  if (typeof data.english_level === "string") {
    const level = data.english_level.toLowerCase();
    if (level.includes("adv") || level.includes("fluent") || level.includes("native") || level.includes("متقدم")) p.english_level = "Advanced";
    else if (level.includes("int") || level.includes("good") || level.includes("متوسط")) p.english_level = "Intermediate";
    else if (level.includes("beg") || level.includes("fair") || level.includes("مبتدئ") || level.includes("ضعيف")) p.english_level = "Beginner";
  }

  if (Array.isArray(data.certifications)) {
    p.certifications = data.certifications.filter(s => typeof s === "string" && s.length > 1);
    if (p.certifications.length === 0) p.certifications = undefined;
  }

  if (typeof data.summary === "string" && data.summary.trim().length > 10) p.summary = data.summary.trim().slice(0, 500);

  return p;
}

function buildPrompt(cvText: string): string {
  const truncated = cvText.slice(0, 3500);
  return ("<bos><start_of_turn>user\n" +
    "Extract CV information from the Arabic text. Return ONLY valid JSON.\n\n" +
    'Fields: name, phone, email, city, degree, major, university, graduation_year, gpa, experience_years, skills[], soft_skills[], english_level, certifications[], summary\n\n' +
    'CV:\n"""' + truncated + '"""\n' +
    "<end_of_turn>\n<start_of_turn>model\n" +
    '{"name":"');
}

function mergeProfiles(ai: Partial<CvProfile>, rules: CvProfile): CvProfile {
  return {
    name: ai.name || rules.name,
    city: ai.city || rules.city,
    email: ai.email || rules.email,
    phone: ai.phone || rules.phone,
    education: ai.education || rules.education,
    experience_years: ai.experience_years || rules.experience_years,
    experience: rules.experience,
    skills: ai.skills || rules.skills,
    soft_skills: ai.soft_skills || rules.soft_skills,
    english_level: ai.english_level || rules.english_level,
    certifications: ai.certifications || rules.certifications,
    summary: ai.summary || rules.summary,
    job_categories: ai.job_categories || rules.job_categories,
    overall_score: ai.overall_score || rules.overall_score || 0,
  };
}

export async function parseCvWithAI(cvText: string): Promise<CvProfile> {
  const fallback = parseCvText(cvText);

  const token = getHfToken();
  if (!token) return fallback;

  for (const model of MODELS) {
    const prompt = buildPrompt(cvText);
    const raw = await hfGenerate(prompt, model);
    if (!raw) continue;

    const json = extractJson('{"name":"' + raw);
    if (!json) continue;

    const aiProfile = mapToProfile(json);
    return mergeProfiles(aiProfile, fallback) as CvProfile;
  }

  return fallback;
}
