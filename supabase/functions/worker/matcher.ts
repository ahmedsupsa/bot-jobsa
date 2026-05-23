// ─── Matcher Engine — يبحث في التاكسونومي ويحمله مرة واحدة بالذاكرة ────────────
// لا يحتاج AI — بحث مباشر داخل jobs_taxonomy.json

import taxonomyRaw from "./jobs_taxonomy.json" with { type: "json" };

interface TaxonomyEntry {
  m:    string;   // اسم التخصص (عربي)
  m_en: string;   // اسم التخصص (إنجليزي)
  c:    string;   // الفئة (عربي)
  c_en: string;   // الفئة (إنجليزي)
  j:    string[]; // قائمة المسميات الوظيفية
}

const TAXONOMY = taxonomyRaw as Record<string, TaxonomyEntry>;

export interface TaxonomyProfile {
  majorIds:    string[];          // IDs المختارة من المستخدم
  titles:      Set<string>;       // كل مسميات الوظائف (lowercase)
  categories:  Set<string>;       // أسماء الفئات (للمطابقة العامة)
  majors:      Set<string>;       // أسماء التخصصات
}

// بناء ملف التاكسونومي للمستخدم من قائمة IDs
export function buildUserProfile(majorIds: string[]): TaxonomyProfile {
  const titles     = new Set<string>();
  const categories = new Set<string>();
  const majors     = new Set<string>();

  for (const id of majorIds) {
    const entry = TAXONOMY[id];
    if (!entry) continue;

    for (const title of entry.j) {
      titles.add(title.toLowerCase().trim());
    }

    categories.add(entry.c.toLowerCase().trim());
    if (entry.c_en) categories.add(entry.c_en.toLowerCase().trim());
    majors.add(entry.m.toLowerCase().trim());
    if (entry.m_en) majors.add(entry.m_en.toLowerCase().trim());
  }

  return { majorIds, titles, categories, majors };
}

// جلب جميع مسميات التاكسونومي (للـ normalizer)
export function getAllTitles(): string[] {
  const all: string[] = [];
  for (const entry of Object.values(TAXONOMY)) {
    all.push(...entry.j);
  }
  return all;
}

// إيجاد الـ ID المناسب لاسم تخصص معين
export function findMajorIdByName(name: string): string | null {
  const lower = name.toLowerCase().trim();
  for (const [id, entry] of Object.entries(TAXONOMY)) {
    if (
      entry.m.toLowerCase() === lower ||
      entry.m_en.toLowerCase() === lower ||
      entry.c.toLowerCase() === lower ||
      entry.c_en.toLowerCase() === lower
    ) {
      return id;
    }
  }
  return null;
}

// جلب معلومات مجموعة IDs (للعرض والتسجيل)
export function getMajorNames(majorIds: string[]): string[] {
  return majorIds
    .map(id => TAXONOMY[id]?.m)
    .filter(Boolean) as string[];
}
