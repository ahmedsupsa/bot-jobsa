// Rule-Based CV Parser — يفهم العربي والإنجليزي بقواعد (بدون LLM)

export interface CvProfile {
  name?: string;
  city?: string;
  email?: string;
  phone?: string;
  education?: {
    degree?: string;
    major?: string;
    university?: string;
    year?: string;
    gpa?: string;
  };
  experience_years?: number;
  experience?: {
    title?: string;
    company?: string;
    from?: string;
    to?: string;
    duration_years?: number;
  }[];
  skills?: string[];
  soft_skills?: string[];
  english_level?: string;
  certifications?: string[];
  summary?: string;
  job_categories?: string[];
  overall_score?: number;
}

const PHONE_PATTERNS = [
  /(?:05|5|\+9665|9665)(?:\d[\s\-]?){8}/,
  /(?:٠٥|٥)(?:\d[\s\-]?){8}/,
  /(?:\+?\d{1,3})?[\s\-]?\d{9,10}/,
];

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.]+/;

const SAUDI_CITIES = [
  "الرياض", "جدة", "مكة", "المدينة", "الدمام", "الخبر", "ظهران",
  "تبوك", "بريدة", "حائل", "الطائف", "نجران", "جيزان", "أبها",
  "خميس مشيط", "ينبع", "الجبيل", "عنيزة", "سكاكا", "عرعر",
  "Riyadh", "Jeddah", "Makkah", "Madinah", "Dammam", "Khobar",
  "Dhahran", "Tabuk", "Buraydah", "Hail", "Taif", "Najran",
  "Jazan", "Abha", "Yanbu", "Jubail",
];

const DEGREE_PATTERNS = [
  /(?:بكالوريوس|بكالوريس|Bachelor|B\.?Sc|B\.?A)/i,
  /(?:ماجستير|Master|M\.?Sc|M\.?A|MBA)/i,
  /(?:دكتوراه|دكتوراة|PhD|Doctorate)/i,
  /(?:دبلوم|Diploma)/i,
  /(?:ثانوية|ثانوي|High School)/i,
];

const SKILL_DB: Record<string, string[]> = {
  programming: ["Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "PHP", "Ruby", "Go", "Rust", "Swift", "Kotlin", "Dart"],
  web: ["React", "Vue", "Angular", "Next.js", "Node.js", "Express", "Django", "Flask", "Laravel", "ASP.NET", "HTML", "CSS", "jQuery", "Bootstrap", "Tailwind"],
  mobile: ["Flutter", "React Native", "Android", "iOS", "SwiftUI", "Jetpack Compose"],
  database: ["SQL", "MySQL", "PostgreSQL", "MongoDB", "Oracle", "SQLite", "Redis", "Firebase", "Supabase"],
  cloud: ["AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "CloudFormation", "Serverless", "Linux"],
  data: ["Machine Learning", "Deep Learning", "AI", "Data Science", "NLP", "Computer Vision", "TensorFlow", "PyTorch", "Pandas", "NumPy", "Tableau", "Power BI"],
  design: ["Photoshop", "Illustrator", "Figma", "UI/UX", "Adobe XD", "Sketch", "Canva"],
  office: ["Excel", "Word", "PowerPoint", "Outlook", "Office 365", "Google Sheets"],
  erp: ["SAP", "Oracle ERP", "Odoo", "Microsoft Dynamics", "Salesforce"],
};

const SOFT_SKILLS = [
  "قيادة", "إدارة", "تواصل", "عمل جماعي", "Teamwork", "Leadership",
  "Communication", "Problem Solving", "حل مشكلات", "اتخاذ قرار",
  "Decision Making", "تحليل", "Analysis", "تخطيط", "Planning",
  "تنظيم", "Organization", "إبداع", "Creativity", "مرونة", "Flexibility",
  "تفاوض", "Negotiation", "إقناع", "Persuasion", "إدارة وقت", "Time Management",
];

const ENGLISH_LEVELS: [RegExp, string][] = [
  [/(?:إجادة تامة|متقدم|متقدم جدا|Advanced|Fluent|Very Good|Native)/i, "Advanced"],
  [/(?:IELTS|TOEFL|STEP|CAE|CPF)/, "Advanced"],
  [/(?:متوسط|Intermediate|Good)/i, "Intermediate"],
  [/(?:مبتدئ|ضعيف|Beginner|Elementary)/i, "Beginner"],
];

const JOB_CATEGORY_KEYWORDS: Record<string, { keywords: string[]; weight: number }> = {
  "تقنية معلومات": { keywords: ["IT", "تقنية", "برمج", "مطور", "مبرمج", "شبكات", "أمن", "سايبر", "برمجيات", "Software", "Developer", "Programmer", "Network", "Security", "Database", "system", "sysadmin", "DevOps", "cloud"], weight: 10 },
  "مبيعات": { keywords: ["مبيعات", "بيع", "Sales", "account manager", "مندوب", "تسويق", "business development", "retail"], weight: 10 },
  "تسويق": { keywords: ["تسويق", "Marketing", "Digital Marketing", "SEO", "SEM", "Social Media", "content", "brand", "إعلان", "دعاية"], weight: 8 },
  "موارد بشرية": { keywords: ["HR", "Human Resources", "موارد", "توظيف", "recruitment", "payroll", "training", "تطوير", "أداء"], weight: 8 },
  "محاسبة ومالية": { keywords: ["محاسبة", "Accounting", "مالية", "Finance", "audit", "تدقيق", "tax", "ضرائب", "CFO", "controller", "ميزانية", "Budget"], weight: 9 },
  "هندسة": { keywords: ["مهندس", "Engineering", "Civil", "ميكانيك", "كهرباء", "معماري", "صناعي", "Engineer", "Mechanical", "Electrical", "Structural", "Project Manager", "PMO"], weight: 9 },
  "إدارة": { keywords: ["إدارة", "Management", "مدير", "Manager", "CEO", "COO", "رئيس", "supervisor", "مشرف", "team lead"], weight: 7 },
  "خدمة عملاء": { keywords: ["خدمة عملاء", "Customer Service", "Call Center", "Support", "دعم", "help desk", "خدمة"], weight: 8 },
  "سلسلة توريد": { keywords: ["سلسلة توريد", "Supply Chain", "Logistics", "لوجستي", "مشتريات", "Procurement", "warehouse", "مستودع", "inventory", "مخزون"], weight: 7 },
  "قانون": { keywords: ["قانون", "Law", "Legal", "محام", "مستشار", "Attorney", "Compliance", "regulatory"], weight: 7 },
  "تعليم": { keywords: ["تعليم", "Education", "Teaching", "تدريس", "أستاذ", "teacher", "professor", "trainer", "مدرب", "training"], weight: 6 },
  "طب ورعاية صحية": { keywords: ["طبيب", "Doctor", "ممرض", "Nurse", "صحي", "Healthcare", "Medical", "سريري", "صيدلة", "Pharmacy", "علاج", "علاج طبيعي"], weight: 8 },
  "هندسة برمجيات": { keywords: ["Software Engineer", "مهندس برمجيات", "Full Stack", "Frontend", "Backend", "API", "microservice", "architecture"], weight: 10 },
};

function extractName(raw: string): string | undefined {
  // First 2-3 lines, skip header words
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (line.length < 4 || line.length > 50) continue;
    if (/^(?:CV|Resume|السيرة|سيرة|اسم|Name|C\.V|Curriculum)/i.test(line)) continue;
    if (/@|http|www|\+?\d{7,}/.test(line)) continue;
    // Arabic name: 2-4 words
    const arWords = line.match(/[\u0600-\u06FF]+/g);
    if (arWords && arWords.length >= 2 && arWords.length <= 5) {
      return arWords.join(" ");
    }
    // English name: 2-3 capitalized words
    const enName = line.match(/^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3}$/);
    if (enName) return enName[0];
  }
  return undefined;
}

function extractPhone(text: string): string | undefined {
  for (const p of PHONE_PATTERNS) {
    const m = text.match(p);
    if (m) return m[0].replace(/[\s\-]/g, "");
  }
  return undefined;
}

function extractCity(text: string): string | undefined {
  for (const c of SAUDI_CITIES) {
    const re = new RegExp(c, "i");
    if (re.test(text)) return c;
  }
  // Try patterns like "المدينة: الرياض" or "Riyadh"
  const cityPatterns = [
    /(?:المدينة|العنوان|المنطقة|city|location|address)\s*[:：]\s*([\u0600-\u06FF\s]{3,})/i,
    /(?:الرياض|جدة|مكة|المدينة|الدمام|الخبر|أبها)/,
  ];
  for (const p of cityPatterns) {
    const m = text.match(p);
    if (m) return m[1]?.trim() || m[0];
  }
  return undefined;
}

function extractEducation(text: string): CvProfile["education"] {
  const edu: CvProfile["education"] = {};

  // Try degree section first
  const eduSection = text.match(/(?:التعليم|المؤهل|Education|Qualification|Degree)[\s\S]{0,500}/i);
  const source = eduSection?.[0] || text;

  // Degree
  for (const d of DEGREE_PATTERNS) {
    const m = source.match(d);
    if (m) {
      const deg = m[0];
      if (/بكالوريوس|Bachelor|B\.?Sc|B\.?A/i.test(deg)) edu.degree = "بكالوريوس";
      else if (/ماجستير|Master|M\.?Sc|M\.?A|MBA/i.test(deg)) edu.degree = "ماجستير";
      else if (/دكتوراه|PhD|Doctorate/i.test(deg)) edu.degree = "دكتوراه";
      else if (/دبلوم|Diploma/i.test(deg)) edu.degree = "دبلوم";
      else edu.degree = deg;
      break;
    }
  }

  // Year
  const yearM = source.match(/(?:19|20)\d{2}/);
  if (yearM) edu.year = yearM[0];

  // GPA
  const gpaM = source.match(/(?:GPA|معدل|تقدير|درجة)\s*[:：]?\s*(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)/i);
  if (gpaM) edu.gpa = gpaM[1].trim();
  else {
    const simpleGpa = source.match(/(\d\.\d{1,2})\s*(?:\/|من|out of)\s*(?:5|4\.?0)/i);
    if (simpleGpa) edu.gpa = simpleGpa[0];
  }

  // University
  const uniPatterns = [
    /(?:جامعة|University|College)\s*[:：]?\s*([\u0600-\u06FF\w\s]{3,40})/i,
    /([\u0600-\u06FF\s]{5,30}(?:جامعة|University))(?:\s|[:：]|$)/i,
  ];
  for (const p of uniPatterns) {
    const m = source.match(p);
    if (m) {
      edu.university = m[1]?.trim() || m[0]?.trim() || undefined;
      if (edu.university && edu.university.length > 50) edu.university = edu.university.slice(0, 50);
      break;
    }
  }

  // Major from text near degree
  const majorPatterns = [
    /(?:تخصص|قسم|major|field)\s*[:：]?\s*([\u0600-\u06FF\w\s]{3,30})/i,
    /(?:بكالوريوس|ماجستير|دكتوراه|Bachelor|Master)\s+(?:في|of|in|–|-)\s+([\u0600-\u06FF\w\s]{3,30})/i,
  ];
  for (const p of majorPatterns) {
    const m = source.match(p);
    if (m) {
      edu.major = m[1]?.trim() || undefined;
      if (edu.major && edu.major.length > 40) edu.major = edu.major.slice(0, 40);
      break;
    }
  }

  return Object.keys(edu).length > 0 ? edu : undefined;
}

function extractExperience(text: string): CvProfile["experience"] {
  const experiences: CvProfile["experience"] = [];
  const section = text.match(/(?:الخبرات|الخبرة|خبرات|Experience|Work History|Employment)[\s\S]{0,3000}/i);
  const source = section?.[0] || text;

  // Find date ranges
  const dateRanges = source.matchAll(/(\d{4})\s*(?:-|–|to|إلى|الى)\s*(\d{4}|Present|حتى الآن|الآن|current|now)/gi);
  for (const d of dateRanges) {
    const from = d[1];
    const to = d[2];
    const dur = to.match(/\d{4}/) ? parseInt(to) - parseInt(from) : undefined;
    // Try to find title/company before this date range
    const before = source.slice(0, Math.max(0, d.index! - 50));
    const lines = before.split("\n");
    const contextLines = lines.slice(-3);
    let title: string | undefined;
    let company: string | undefined;
    for (const cl of contextLines.reverse()) {
      if (!title && cl.length > 3 && cl.length < 100 && !/\d/.test(cl.slice(0, 3))) {
        title = cl.trim();
      }
    }
    experiences.push({
      from,
      to: to.match(/\d{4}/) ? to : undefined,
      duration_years: dur && dur > 0 ? dur : undefined,
      title,
      company,
    });
  }

  return experiences.length > 0 ? experiences : undefined;
}

function extractExperienceYears(experiences: CvProfile["experience"]): number | undefined {
  if (!experiences || experiences.length === 0) return undefined;
  let total = 0;
  for (const e of experiences) {
    if (e.duration_years) total += e.duration_years;
    else if (e.from && e.to) total += parseInt(e.to) - parseInt(e.from);
  }
  return total > 0 ? total : undefined;
}

function extractSkills(text: string): { technical: string[]; soft: string[] } {
  const technical: string[] = [];
  const soft: string[] = [];
  const found = new Set<string>();

  // Check skill section
  const skillSection = text.match(/(?:المهارات|مهارات|Skills|Competencies|Expertise)[\s\S]{0,1000}/i);
  const source = skillSection?.[0] || text;

  // Match against skill DB
  for (const [, skills] of Object.entries(SKILL_DB)) {
    for (const s of skills) {
      if (!found.has(s) && new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(source)) {
        technical.push(s);
        found.add(s);
      }
    }
  }

  // Soft skills
  for (const s of SOFT_SKILLS) {
    if (!found.has(s) && new RegExp(s, "i").test(source)) {
      soft.push(s);
      found.add(s);
    }
  }

  return { technical, soft };
}

function extractEnglishLevel(text: string): string | undefined {
  for (const [re, level] of ENGLISH_LEVELS) {
    if (re.test(text)) return level;
  }
  return undefined;
}

function extractCertifications(text: string): string[] {
  const certs: string[] = [];
  const section = text.match(/(?:الشهادات|شهادات|Certifications|Certificates|Licenses)[\s\S]{0,500}/i);
  if (!section) return [];

  // Common certifications
  const knownCerts = [
    /(?:PMP|PMI)/, /(?:CMA|CFA|CPA|ACCA)/, /(?:MOS|ICDL)/,
    /(?:AWS|Azure|GCP)\s*(?:Certified|Solutions|Developer|Architect)?/i,
    /(?:CISSP|CISM|CEH|CompTIA|Security\+|Network\+)/,
    /(?:TOEFL|IELTS|STEP)/,
    /(?:Six Sigma|Lean|Scrum|Agile|SAFe)/,
    /(?:IOSH|NEBOSH|OSHA)/,
    /(?:SAP|Oracle)\s*(?:Certified)?/i,
    /(?:PRINCE2|ITIL)/,
  ];

  for (const p of knownCerts) {
    const m = section[0].match(p);
    if (m) certs.push(m[0]);
  }

  return certs;
}

function scoreJobCategories(skills: string[], experience: CvProfile["experience"], text: string): { categories: string[]; scores: Record<string, number> } {
  const scores: Record<string, number> = {};
  const skillText = skills.join(" ");
  const expText = (experience || []).map(e => `${e.title || ""} ${e.company || ""}`).join(" ");
  const allText = `${skillText} ${expText} ${text}`.toLowerCase();

  for (const [cat, data] of Object.entries(JOB_CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of data.keywords) {
      const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const matches = allText.match(re);
      if (matches) score += matches.length * data.weight;
    }
    if (score > 0) scores[cat] = score;
  }

  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return {
    categories: sorted.map(([c]) => c),
    scores,
  };
}

export function parseCvText(text: string): CvProfile {
  const profile: CvProfile = {};

  profile.name = extractName(text);
  profile.email = text.match(EMAIL_PATTERN)?.[0] || undefined;
  profile.phone = extractPhone(text);
  profile.city = extractCity(text);
  profile.education = extractEducation(text);
  profile.experience = extractExperience(text);
  profile.experience_years = extractExperienceYears(profile.experience);
  const { technical, soft } = extractSkills(text);
  if (technical.length > 0) profile.skills = technical;
  if (soft.length > 0) profile.soft_skills = soft;
  profile.english_level = extractEnglishLevel(text);
  profile.certifications = extractCertifications(text);

  // Summary / overview (first meaningful paragraph)
  const lines = text.split("\n").filter(l => l.trim().length > 20);
  const profileLine = lines.find(l => /^(?:نبذة|ملخص|Profile|Summary|Objective|هدف)/i.test(l));
  if (profileLine) {
    const idx = lines.indexOf(profileLine);
    profile.summary = lines.slice(idx, idx + 3).join(" ").slice(0, 400);
  } else {
    profile.summary = lines.slice(0, 3).join(" ").slice(0, 400);
  }

  // Job categories scoring
  const allSkillText = `${(profile.skills || []).join(" ")} ${(profile.certifications || []).join(" ")} ${profile.summary || ""} ${profile.education?.major || ""}`;
  const { categories } = scoreJobCategories(profile.skills || [], profile.experience, text);
  profile.job_categories = categories;

  // Overall CV quality / fitness score (0-100)
  let score = 30; // base
  if (profile.email) score += 10;
  if (profile.phone) score += 10;
  if (profile.name) score += 10;
  if (profile.city) score += 5;
  if (profile.education) score += 10;
  if (profile.experience_years) score += Math.min(profile.experience_years * 3, 15);
  if (profile.skills && profile.skills.length > 3) score += Math.min(profile.skills.length * 2, 10);
  if (profile.certifications && profile.certifications.length > 0) score += 5;
  if (profile.job_categories && profile.job_categories.length > 0) score += 5;
  profile.overall_score = Math.min(score, 100);

  return profile;
}

// Get matching score for a specific job category (0-100)
export function matchCategory(profile: CvProfile, category: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const catKey = category.toLowerCase();

  // Check job categories
  if (profile.job_categories?.some(c => c.includes(category) || category.includes(c))) {
    score += 30;
    reasons.push("مناسب للمجال");
  }

  // Check skills
  const catSkills = Object.entries(JOB_CATEGORY_KEYWORDS).find(([k]) => k.includes(category) || category.includes(k));
  if (catSkills) {
    const matched = catSkills[1].keywords.filter(kw =>
      profile.skills?.some(s => s.toLowerCase().includes(kw.toLowerCase()))
    );
    if (matched.length > 0) {
      score += matched.length * 8;
      reasons.push(`يملك ${matched.length} مهارة مناسبة`);
    }
  }

  // Experience
  if (profile.experience_years && profile.experience_years > 0) {
    const expScore = Math.min(profile.experience_years * 5, 25);
    score += expScore;
    reasons.push(`${profile.experience_years} سنوات خبرة`);
  }

  // Education bonus
  if (profile.education?.degree?.includes("بكالوريوس") || profile.education?.degree?.includes("ماجستير")) {
    score += 10;
    reasons.push("مؤهل عالي");
  }

  // English bonus
  if (profile.english_level === "Advanced") {
    score += 10;
    reasons.push("إجادة اللغة الإنجليزية");
  }

  return { score: Math.min(score, 100), reasons };
}
