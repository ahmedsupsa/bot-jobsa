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
  /(?:05|5|\+9665|9665|009665)(?:\d[\s\-]?){8}/,
  /(?:٠٥|٥)(?:\d[\s\-]?){8}/,
  /(?:\+?\d{1,3})?[\s\-]?\d{9,10}/,
];

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.]+/;

const SAUDI_CITIES = [
  "الرياض", "جدة", "مكة المكرمة", "مكة", "المدينة المنورة", "المدينة",
  "الدمام", "الخبر", "الظهران", "الأحساء", "الهفوف", "الطائف", "تبوك",
  "بريدة", "عنيزة", "خميس مشيط", "حائل", "الجبيل", "نجران", "أبها",
  "ينبع", "الخرج", "القطيف", "عرعر", "سكاكا", "جازان", "جيزان", "الباحة",
  "حفر الباطن", "الدوادمي", "بيشة", "وادي الدواسر", "القريات", "رفحاء",
  "المجمعة", "الزلفي", "الرس", "المذنب", "البدائع", "صبياء", "صبيـا",
  "محايل", "رابغ", "الليث", "القنفذة", "سراة عبيدة", "شرورة", "طريف",
  "الوجه", "ضباء", "تيماء", "دومة الجندل", "الحناكية", "المهد", "خيبر",
  "بدر", "ينبع النخل", "العلا", "الموية", "الخرمة", "تربة", "رنية",
  "ظهران الجنوب", "الحديدة", "الحجرة", "بقيق", "النعيرية", "قرية العليا",
  "الخفجي", "رأس تنورة", "سيهات", "عنك", "تاروت", "القديح",
  "Riyadh", "Jeddah", "Makkah", "Madinah", "Dammam", "Khobar",
  "Dhahran", "Tabuk", "Buraydah", "Hail", "Taif", "Najran",
  "Jazan", "Abha", "Yanbu", "Jubail", "Al Ahsa", "Hofuf",
];

const DEGREE_PATTERNS = [
  /(?:بكالوريوس|بكالوريس|Bachelor|B\.?\s*Sc|B\.?\s*A)/i,
  /(?:ماجستير|Master|M\.?\s*Sc|M\.?\s*A|MBA)/i,
  /(?:دكتوراه|دكتوراة|PhD|Doctorate)/i,
  /(?:دبلوم|Diploma)/i,
  /(?:ثانوية|ثانوي|High\s*School)/i,
  /(?:فني|Technical\s*Diploma)/i,
];

const UNIVERSITIES = [
  "جامعة الملك سعود", "جامعة الملك عبدالعزيز", "جامعة الملك فهد",
  "جامعة الإمام محمد بن سعود", "جامعة الأمام", "جامعة الملك خالد",
  "جامعة الملك فيصل", "جامعة أم القرى", "جامعة الأميرة نورة",
  "جامعة الطائف", "جامعة تبوك", "جامعة حائل", "جامعة جازان",
  "جامعة نجران", "جامعة الباحة", "جامعة الجوف", "جامعة القصيم",
  "جامعة الدمام", "جامعة الإمام عبدالرحمن بن فيصل",
  "جامعة الملك عبدالله للعلوم", "KAUST",
  "جامعة اليمامة", "جامعة الفيصل", "جامعة الأمير سلطان",
  "جامعة دار الحكمة", "جامعة عفت", "جامعة الأعمال والتكنولوجيا",
  "جامعة سطام", "جامعة شقراء", "جامعة المجمعة", "جامعة الحدود الشمالية",
  "جامعة بيشة", "جامعة حفر الباطن", "الكلية التقنية",
  "المعهد التقني", "المعهد العالي", "كلية الاتصالات",
  "كلية الهندسة", "كلية العلوم", "كلية الطب", "كلية إدارة الأعمال",
  "كلية المجتمع", "جامعة الملك سعود بن عبدالعزيز",
];

const SKILL_DB: Record<string, string[]> = {
  programming: [
    "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "PHP",
    "Ruby", "Go", "Rust", "Swift", "Kotlin", "Dart", "Scala", "Perl",
    "Shell Script", "Bash", "PowerShell",
  ],
  web: [
    "React", "Vue", "Vue.js", "Angular", "Next.js", "Nuxt", "Svelte",
    "Node.js", "Express", "Django", "Flask", "Laravel", "ASP.NET",
    "HTML", "CSS", "jQuery", "Bootstrap", "Tailwind", "Sass", "LESS",
    "Webpack", "Vite", "GraphQL", "REST API", "RESTful",
  ],
  mobile: [
    "Flutter", "React Native", "Android", "iOS", "SwiftUI",
    "Jetpack Compose", "Xamarin", "Ionic",
  ],
  database: [
    "SQL", "MySQL", "PostgreSQL", "MongoDB", "Oracle", "SQLite",
    "Redis", "Firebase", "Supabase", "MariaDB", "Elasticsearch",
    "DynamoDB", "Cassandra", "BigQuery",
  ],
  cloud: [
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform",
    "CloudFormation", "Serverless", "Linux", "Jenkins", "CI/CD",
    "GitHub Actions", "GitLab CI", "Ansible", "Chef", "Puppet",
    "Nginx", "Apache",
  ],
  data: [
    "Machine Learning", "Deep Learning", "AI", "Artificial Intelligence",
    "Data Science", "NLP", "Computer Vision", "TensorFlow", "PyTorch",
    "Pandas", "NumPy", "Tableau", "Power BI", "Big Data", "Spark",
    "Hadoop", "Scikit-learn", "Keras", "LangChain", "LLM",
  ],
  design: [
    "Photoshop", "Illustrator", "Figma", "UI/UX", "Adobe XD",
    "Sketch", "Canva", "InDesign", "Premiere", "After Effects",
    "Blender", "3ds Max", "AutoCAD", "SolidWorks",
  ],
  office: [
    "Excel", "Word", "PowerPoint", "Outlook", "Office 365",
    "Google Sheets", "Google Docs",
  ],
  erp: [
    "SAP", "Oracle ERP", "Odoo", "Microsoft Dynamics", "Salesforce",
    "ERP", "HRIS",
  ],
  networking: [
    "TCP/IP", "DNS", "DHCP", "VPN", "Firewall", "Cisco",
    "CCNA", "CCNP", "Network Security", "SDWAN", "MPLS",
  ],
};

const SOFT_SKILLS = [
  "قيادة", "إدارة", "تواصل", "عمل جماعي", "Teamwork", "Leadership",
  "Communication", "Problem Solving", "حل مشكلات", "اتخاذ قرار",
  "Decision Making", "تحليل", "Analysis", "تخطيط", "Planning",
  "تنظيم", "Organization", "إبداع", "Creativity", "مرونة", "Flexibility",
  "تفاوض", "Negotiation", "إقناع", "Persuasion", "إدارة وقت", "Time Management",
  "إدارة فرق", "Team Management", "مبادرة", "Initiative",
  "تحمل ضغط", "Work under Pressure", "توجيه", "Mentoring",
  "تفكير نقدي", "Critical Thinking", "بحث", "Research",
  "تواصل كتابي", "Written Communication", "تواصل شفهي", "Verbal Communication",
];

const ENGLISH_LEVELS: [RegExp, string][] = [
  [/(?:إجادة تامة|متقدم جدا|متقدم|Advanced|Fluent|Native|Very Good|[Bb]ilingual|Proficient|Mother Tongue)/, "Advanced"],
  [/(?:IELTS|TOEFL|STEP|CAE|CPE)/, "Advanced"],
  [/(?:متوسط|Intermediate|Good)/, "Intermediate"],
  [/(?:مبتدئ|ضعيف|Beginner|Elementary|Fair)/, "Beginner"],
];

const JOB_CATEGORY_KEYWORDS: Record<string, { keywords: string[]; weight: number }> = {
  "تقنية معلومات": { keywords: ["IT", "تقنية", "برمج", "مطور", "مبرمج", "شبكات", "أمن", "سايبر", "برمجيات", "Software", "Developer", "Programmer", "Network", "Security", "Database", "system", "sysadmin", "DevOps", "cloud", "help desk", "دعم فني", "تقنية معلومات"], weight: 10 },
  "مبيعات": { keywords: ["مبيعات", "بيع", "Sales", "account manager", "مندوب", "تسويق", "business development", "retail", "أعمال", "تجاري"], weight: 10 },
  "تسويق": { keywords: ["تسويق", "Marketing", "Digital Marketing", "SEO", "SEM", "Social Media", "content", "brand", "إعلان", "دعاية", "تسويق إلكتروني"], weight: 8 },
  "موارد بشرية": { keywords: ["HR", "Human Resources", "موارد", "توظيف", "recruitment", "payroll", "training", "تطوير", "أداء", "موارد بشرية"], weight: 8 },
  "محاسبة ومالية": { keywords: ["محاسبة", "Accounting", "مالية", "Finance", "audit", "تدقيق", "tax", "ضرائب", "CFO", "controller", "ميزانية", "Budget", "حسابات"], weight: 9 },
  "هندسة": { keywords: ["مهندس", "Engineering", "Civil", "ميكانيك", "كهرباء", "معماري", "صناعي", "Engineer", "Mechanical", "Electrical", "Structural", "Project Manager", "PMO", "مدني", "معماري"], weight: 9 },
  "إدارة": { keywords: ["إدارة", "Management", "مدير", "Manager", "CEO", "COO", "رئيس", "supervisor", "مشرف", "team lead", "رئيس قسم"], weight: 7 },
  "خدمة عملاء": { keywords: ["خدمة عملاء", "Customer Service", "Call Center", "Support", "دعم", "help desk", "خدمة", "خدمة عملاء"], weight: 8 },
  "سلسلة توريد": { keywords: ["سلسلة توريد", "Supply Chain", "Logistics", "لوجستي", "مشتريات", "Procurement", "warehouse", "مستودع", "inventory", "مخزون", "توريد"], weight: 7 },
  "قانون": { keywords: ["قانون", "Law", "Legal", "محام", "مستشار", "Attorney", "Compliance", "regulatory", "أنظمة"], weight: 7 },
  "تعليم": { keywords: ["تعليم", "Education", "Teaching", "تدريس", "أستاذ", "teacher", "professor", "trainer", "مدرب", "training", "أكاديمي"], weight: 6 },
  "طب ورعاية صحية": { keywords: ["طبيب", "Doctor", "ممرض", "Nurse", "صحي", "Healthcare", "Medical", "سريري", "صيدلة", "Pharmacy", "علاج", "علاج طبيعي", "تمريض", "صحي"], weight: 8 },
  "هندسة برمجيات": { keywords: ["Software Engineer", "مهندس برمجيات", "Full Stack", "Frontend", "Backend", "API", "microservice", "architecture", "Software Development"], weight: 10 },
};

function extractName(raw: string): string | undefined {
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const skipHeaders = [
    /^(?:CV|Resume|السيرة|سيرة|C\.V|Curriculum|سي في)/i,
    /^(?:الاسم|Name|البيانات|بيانات)/i,
    /^(?:السيرة الذاتية)/i,
    /^[\d\s\-_]+$/, /^[|\\/]+$/,
  ];

  for (const line of lines.slice(0, 8)) {
    if (line.length < 4 || line.length > 60) continue;
    if (/@|http|www|\+?\d{7,}/.test(line)) continue;
    if (skipHeaders.some(r => r.test(line))) continue;
    if (/^(?:بكالوريوس|ماجستير|دكتوراه|مهندس|طبيب|جامعة|كلية|شركة|مؤسسة|شركة)/.test(line)) continue;

    const arWords = line.match(/[\u0600-\u06FF]+/g);
    if (arWords && arWords.length >= 2 && arWords.length <= 6) {
      return arWords.join(" ");
    }
    const enName = line.match(/^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3}(?:\s(?:Jr|Sr|II|III|IV))?$/);
    if (enName) return enName[0];
  }

  for (const line of lines.slice(0, 8)) {
    if (line.length < 4 || line.length > 60) continue;
    if (/@|http|www/.test(line)) continue;
    const cleaned = line.replace(/^(?:الاسم|Name|الاسم:|Name:)\s*/i, "").trim();
    const arWords = cleaned.match(/[\u0600-\u06FF]+/g);
    if (arWords && arWords.length >= 2 && arWords.length <= 6) {
      return arWords.join(" ");
    }
  }
  return undefined;
}

function extractPhone(text: string): string | undefined {
  for (const p of PHONE_PATTERNS) {
    const m = text.match(p);
    if (m) {
      const cleaned = m[0].replace(/[\s\-]/g, "");
      if (cleaned.length >= 9) return cleaned;
    }
  }
  return undefined;
}

function extractCity(text: string): string | undefined {
  const cityPatterns = [
    /(?:المدينة|العنوان|المنطقة|city|location|address)\s*[:：]\s*([\u0600-\u06FF\s]{3,})/i,
    /(?:أنا\s+)?(?:من|أسكن\s+في|أقيم\s+في|ساكن\s+في|resident\s+of|living\s+in)\s+([\u0600-\u06FF\s]{3,})/i,
  ];
  for (const p of cityPatterns) {
    const m = text.match(p);
    if (m) {
      const c = m[1]?.trim();
      if (c && c.length < 30) return c;
    }
  }
  for (const c of SAUDI_CITIES) {
    const re = new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (re.test(text)) return c;
  }
  return undefined;
}

function extractEducation(text: string): CvProfile["education"] {
  const edu: CvProfile["education"] = {};

  const eduSection = text.match(
    /(?:التعليم|المؤهل|Education|Qualification|Degree|المؤهلات|المؤهل العلمي)[\s\S]{0,800}/i
  );
  const source = eduSection?.[0] || text;

  for (const d of DEGREE_PATTERNS) {
    const m = source.match(d);
    if (m) {
      const deg = m[0];
      if (/بكالوريوس|Bachelor|B\.?\s*Sc|B\.?\s*A/i.test(deg)) edu.degree = "بكالوريوس";
      else if (/ماجستير|Master|M\.?\s*Sc|M\.?\s*A|MBA/i.test(deg)) edu.degree = "ماجستير";
      else if (/دكتوراه|PhD|Doctorate/i.test(deg)) edu.degree = "دكتوراه";
      else if (/دبلوم|Diploma/i.test(deg)) edu.degree = "دبلوم";
      else if (/ثانوية|ثانوي|High\s*School/i.test(deg)) edu.degree = "ثانوية";
      else edu.degree = deg;
      break;
    }
  }

  const yearM = source.match(/(?:19|20)\d{2}/);
  if (yearM) edu.year = yearM[0];

  const gpaM = source.match(
    /(?:GPA|معدل|تقدير|درجة|المعدل|التقدير)\s*[:：]?\s*(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)/i
  );
  if (gpaM) edu.gpa = gpaM[1].trim();
  else {
    const simpleGpa = source.match(/(\d\.\d{1,2})\s*(?:\/|من|out\s*of)\s*(?:5|4\.?0)/i);
    if (simpleGpa) edu.gpa = simpleGpa[0];
  }

  for (const uni of UNIVERSITIES) {
    const re = new RegExp(uni.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (re.test(source)) {
      edu.university = uni;
      break;
    }
  }
  if (!edu.university) {
    const uniPatterns = [
      /(?:جامعة|University|College|أكاديمية|Institute|معهد)\s*[:：]?\s*([\u0600-\u06FF\w\s]{3,60})/i,
      /([\u0600-\u06FF\s]{5,40}(?:جامعة|University|College))(?:\s|[:：]|$)/i,
    ];
    for (const p of uniPatterns) {
      const m = source.match(p);
      if (m) {
        edu.university = (m[1] || m[0]).trim();
        if (edu.university.length > 60) edu.university = edu.university.slice(0, 60);
        break;
      }
    }
  }

  const majorPatterns = [
    /(?:تخصص|قسم|major|field|التخصص|القسم)\s*[:：]?\s*([\u0600-\u06FF\w\s]{3,40})/i,
    /(?:بكالوريوس|ماجستير|دكتوراه|Bachelor|Master|PhD)\s+(?:في|of|in|–|-|–)\s+([\u0600-\u06FF\w\s]{3,40})/i,
  ];
  for (const p of majorPatterns) {
    const m = source.match(p);
    if (m) {
      edu.major = m[1]?.trim();
      if (edu.major && edu.major.length > 50) edu.major = edu.major.slice(0, 50);
      break;
    }
  }

  return Object.keys(edu).length > 0 ? edu : undefined;
}

function extractExperience(text: string): CvProfile["experience"] {
  const experiences: CvProfile["experience"] = [];
  const section = text.match(
    /(?:الخبرات|الخبرة|خبرات|خبرة|Experience|Work History|Employment|Work Experience|الخبرات السابقة|الخبرات المهنية)[\s\S]{0,4000}/i
  );
  const source = section?.[0] || text;

  const dateRangePatterns = [
    /(\d{4})\s*(?:-|–|—|to|إلى|الى|الي)\s*(\d{4}|Present|حتى الآن|الآن|current|now|حتى\s+الآن)/gi,
    /من\s*(\d{4})\s*(?:إلى|الى|الي)\s*(\d{4}|حتى الآن|الآن|Present|now)/gi,
    /(\d{2}\/\d{4})\s*(?:-|–|إلى|الى)\s*(\d{2}\/\d{4}|Present|حتى الآن)/gi,
    /(\d{4})\s*(?:-|–)\s*(?:حتى|to)?\s*(\d{4}|Present)/gi,
  ];

  const parsed: Array<{ from: string; to?: string; idx: number }> = [];
  for (const pattern of dateRangePatterns) {
    for (const d of source.matchAll(pattern)) {
      let from = d[1].trim();
      let toRaw = d[2].trim();
      if (from.includes("/")) {
        const parts = from.split("/");
        from = parts[1] || parts[0];
      }
      const to = /present|حتى الآن|الآن|current|now|حتى/i.test(toRaw)
        ? undefined
        : toRaw.includes("/")
          ? (toRaw.split("/")[1] || toRaw.split("/")[0])
          : toRaw;
      parsed.push({ from, to, idx: d.index! });
    }
  }

  if (parsed.length === 0) return undefined;

  parsed.sort((a, b) => a.idx - b.idx);

  const blocks = source.split(/\n{2,}/);

  for (const entry of parsed) {
    const before = source.slice(0, Math.max(0, entry.idx - 10));
    const beforeLines = before.split("\n").filter(l => l.trim().length > 0);
    const context = beforeLines.slice(-5).reverse();

    let title: string | undefined;
    let company: string | undefined;

    for (const cl of context) {
      const trimmed = cl.trim();
      if (trimmed.length < 3 || trimmed.length > 120) continue;
      if (/^\d/.test(trimmed)) continue;
      if (/(?:الخبرات|الخبرة|Experience|Work)/i.test(trimmed)) continue;

      if (!title) {
        title = trimmed;
        continue;
      }
      if (!company && trimmed !== title) {
        if (
          /(?:شركة|مؤسسة|Company|Corp|Inc|Ltd|Group|مكتب|بنك|مستشفى|جامعة|وزارة|هيئة|مجموعة)/i.test(trimmed) ||
          trimmed.length < title.length
        ) {
          company = trimmed;
        }
      }
    }

    const dur = entry.to ? parseInt(entry.to) - parseInt(entry.from) : undefined;

    experiences.push({
      from: entry.from,
      to: entry.to,
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

  for (const [, skills] of Object.entries(SKILL_DB)) {
    for (const s of skills) {
      if (found.has(s)) continue;
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        `(?:^|[\\s,.;:()\\[\\]{}'"\\/\\\\])${escaped}(?:$|[\\s,.;:()\\[\\]{}'"\\/\\\\])`,
        "i"
      );
      if (re.test(text)) {
        technical.push(s);
        found.add(s);
      }
    }
  }

  for (const s of SOFT_SKILLS) {
    if (found.has(s)) continue;
    if (new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) {
      soft.push(s);
      found.add(s);
    }
  }

  return { technical, soft };
}

function extractEnglishLevel(text: string): string | undefined {
  const levelSection = text.match(
    /(?:اللغة الإنجليزية|اللغات|Language|English|Languages|اللغات)[\s\S]{0,300}/i
  );
  const source = levelSection?.[0] || text;

  for (let [re, level] of ENGLISH_LEVELS) {
    const m = source.match(re);
    if (m) {
      if (typeof level === "function") {
        const result = level(m[0], m[1]);
        if (result) return result;
      } else {
        return level;
      }
    }
  }

  if (/(?:IELTS|TOEFL|STEP)\s*\d/.test(source)) return "Advanced";
  if (/IELTS|TOEFL|STEP/.test(source)) return "Advanced";

  const arabicLevel = source.match(/(?:اللغة الإنجليزية|English|الانجليزية|الانجليزي)\s*[:：]?\s*(ممتاز|جيد جدا|جيد جدا|جيد|مقبول|ضعيف)/i);
  if (arabicLevel) {
    const map: Record<string, string> = {
      "ممتاز": "Advanced", "جيد جدا": "Advanced",
      "جيد": "Intermediate", "مقبول": "Intermediate", "ضعيف": "Beginner",
    };
    return map[arabicLevel[1]] || "Intermediate";
  }

  return undefined;
}

function extractCertifications(text: string): string[] {
  const certs: string[] = [];
  const section = text.match(
    /(?:الشهادات|شهادات|Certifications|Certificates|Licenses|الدورات|الرخص|الشهادات والرخص)[\s\S]{0,800}/i
  );
  if (!section) return [];

  const knownCerts = [
    /(?:PMP|PMI)/, /(?:CMA|CFA|CPA|ACCA)/, /(?:MOS|ICDL)/,
    /(?:AWS|Amazon Web Services)\s*(?:Certified|Solutions|Developer|Architect|Practitioner)?/i,
    /(?:Azure|Microsoft Azure)\s*(?:Certified|Solutions|Developer|Administrator|Architect)?/i,
    /(?:GCP|Google Cloud)\s*(?:Certified|Professional)?/i,
    /(?:CISSP|CISM|CEH|CompTIA|Security\+|Network\+)/,
    /(?:TOEFL|IELTS|STEP)/,
    /(?:Six Sigma|Lean|Scrum|Agile|SAFe|CSM|PSM)/,
    /(?:IOSH|NEBOSH|OSHA)/,
    /(?:SAP|Oracle)\s*(?:Certified)?/i,
    /(?:PRINCE2|ITIL|COBIT)/,
    /(?:CCNA|CCNP|CCIE)/,
    /(?:Kubernetes|CKA|CKAD)/,
    /(?:TOGAF|PMP)/,
    /(?:ممارس|أخصائي|احترافي|معتمد|شهادة|رخصة)/i,
  ];

  for (const p of knownCerts) {
    const m = section[0].match(p);
    if (m && !certs.some(c => c.toLowerCase() === m![0].toLowerCase())) {
      certs.push(m[0].trim());
    }
  }

  return certs.length > 0 ? certs : [];
}

function scoreJobCategories(
  skills: string[],
  experience: CvProfile["experience"],
  text: string
): { categories: string[]; scores: Record<string, number> } {
  const scores: Record<string, number> = {};
  const skillText = skills.join(" ");
  const expText = (experience || [])
    .map(e => `${e.title || ""} ${e.company || ""}`)
    .join(" ");
  const allText = `${skillText} ${expText} ${text}`.toLowerCase();

  for (const [cat, data] of Object.entries(JOB_CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of data.keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escaped, "gi");
      const matches = allText.match(re);
      if (matches) score += matches.length * data.weight;
    }
    if (score > 0) scores[cat] = score;
  }

  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return { categories: sorted.map(([c]) => c), scores };
}

function extractSummary(text: string): string | undefined {
  const lines = text.split("\n").filter(l => l.trim().length > 15);
  const summaryHeader = lines.find(l =>
    /^(?:نبذة|ملخص|Profile|Summary|Objective|هدف|نبذة عني|ملخص شخصي|الملخص|About Me)/i.test(l)
  );
  if (summaryHeader) {
    const idx = lines.indexOf(summaryHeader);
    const summaryLines = lines.slice(idx, idx + 4);
    const joined = summaryLines.join(" ").replace(/^(?:نبذة|ملخص|Profile|Summary|Objective|هدف|نبذة عني|ملخص شخصي|الملخص|About Me)\s*[:：]?\s*/i, "").trim();
    if (joined.length > 20) return joined.slice(0, 500);
  }
  const nonHeader = lines.filter(l => l.length > 30 && l.length < 300 && !/^(?:السيرة|CV|Resume|الخبرات|التعليم|المهارات|الشهادات)/i.test(l));
  if (nonHeader.length > 0) return nonHeader.slice(0, 3).join(" ").slice(0, 400);
  return undefined;
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
  profile.summary = extractSummary(text);

  const allSkillText = [
    ...(profile.skills || []),
    ...(profile.certifications || []),
    profile.summary || "",
    profile.education?.major || "",
    profile.education?.degree || "",
  ].join(" ");
  const { categories } = scoreJobCategories(
    profile.skills || [],
    profile.experience,
    `${allSkillText} ${text}`
  );
  profile.job_categories = categories;

  let score = 30;
  if (profile.email) score += 8;
  if (profile.phone) score += 8;
  if (profile.name) score += 10;
  if (profile.city) score += 5;
  if (profile.education) score += 10;
  if (profile.education?.university) score += 3;
  if (profile.experience_years) score += Math.min(profile.experience_years * 3, 15);
  if (profile.skills && profile.skills.length > 0) score += Math.min(profile.skills.length, 10);
  if (profile.soft_skills && profile.soft_skills.length > 0) score += Math.min(profile.soft_skills.length, 5);
  if (profile.certifications && profile.certifications.length > 0) score += 5;
  if (profile.job_categories && profile.job_categories.length > 0) score += 5;
  if (profile.english_level) score += 3;
  profile.overall_score = Math.min(score, 100);

  return profile;
}

export function matchCategory(
  profile: CvProfile,
  category: string
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const catKey = category.toLowerCase();

  if (
    profile.job_categories?.some(
      c => c.includes(category) || category.includes(c)
    )
  ) {
    score += 30;
    reasons.push("مناسب للمجال");
  }

  const catSkills = Object.entries(JOB_CATEGORY_KEYWORDS).find(
    ([k]) => k.includes(category) || category.includes(k)
  );
  if (catSkills) {
    const matched = catSkills[1].keywords.filter(kw =>
      profile.skills?.some(s => s.toLowerCase().includes(kw.toLowerCase()))
    );
    if (matched.length > 0) {
      score += matched.length * 8;
      reasons.push(`يملك ${matched.length} مهارة مناسبة`);
    }
  }

  if (profile.experience_years && profile.experience_years > 0) {
    const expScore = Math.min(profile.experience_years * 5, 25);
    score += expScore;
    reasons.push(`${profile.experience_years} سنوات خبرة`);
  }

  if (
    profile.education?.degree?.includes("بكالوريوس") ||
    profile.education?.degree?.includes("ماجستير")
  ) {
    score += 10;
    reasons.push("مؤهل عالي");
  }

  if (profile.english_level === "Advanced") {
    score += 10;
    reasons.push("إجادة اللغة الإنجليزية");
  }

  return { score: Math.min(score, 100), reasons };
}
