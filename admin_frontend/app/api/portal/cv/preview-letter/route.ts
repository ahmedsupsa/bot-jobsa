import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

type Cert = { type: string; name: string; issuer: string | null };
type CvProfile = {
  degree?: string;
  specialization?: string;
  experience_years?: number;
  skills?: string[];
  prev_jobs?: string[];
  languages?: string[];
  is_fresh_graduate?: boolean;
};

// ── استدعاء Gemini لتوليد نص الرسالة ────────────────────────────────────────

async function generateLetterText(
  name: string,
  jobTitle: string,
  lang: string,
  profile: CvProfile | null,
  certs: Cert[],
  cvText: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";

  const isAr = lang !== "en";
  const spec     = profile?.specialization || profile?.degree || "";
  const degree   = profile?.degree || "";
  const expYears = profile?.experience_years ?? -1;
  const skills   = (profile?.skills ?? []).slice(0, 8).join(isAr ? "، " : ", ");
  const prevJobs = (profile?.prev_jobs ?? []).slice(0, 3).join(isAr ? "، " : ", ");
  const certList = certs.length
    ? certs.map(c => c.name + (c.issuer ? ` (${c.issuer})` : "")).join(isAr ? "، " : ", ")
    : "";
  const cvExcerpt = cvText.slice(0, 1000);
  const expStr = isAr
    ? expYears > 0 ? `${expYears} ${expYears === 1 ? "سنة" : "سنوات"}` : "حديث التخرج"
    : expYears > 0 ? `${expYears} year${expYears === 1 ? "" : "s"}` : "Recent graduate";

  const prompt = isAr
    ? `أنت خبير في كتابة رسائل التقديم الوظيفي في السوق السعودي.
اكتب رسالة تقديم احترافية باللغة العربية للشخص التالي:

الاسم: ${name}
المسمى الوظيفي المتقدم عليه: ${jobTitle}
التخصص: ${spec || "غير محدد"}
المؤهل العلمي: ${degree || "غير محدد"}
الخبرة: ${expStr}
المهارات: ${skills || "—"}
الشهادات والرخص: ${certList || "—"}
الوظائف السابقة: ${prevJobs || "—"}
${cvExcerpt ? `\nنبذة من السيرة:\n${cvExcerpt}` : ""}

القواعد الصارمة:
- 3 فقرات فقط: افتتاحية، جسم يبرز المهارات والخبرة، خاتمة.
- أسلوب رسمي ومهني يناسب الشركات السعودية.
- لا تذكر اسم شركة محددة، استخدم "شركتكم" أو "مؤسستكم".
- لا تضف عنواناً أو توقيعاً أو تحية ختامية (ستُضاف تلقائياً).
- لا تتجاوز 220 كلمة.
- أعد نص الرسالة فقط بدون أي تنسيق إضافي.`
    : `You are an expert in writing professional job application cover letters.
Write a professional cover letter in English for the following applicant:

Name: ${name}
Target Job Title: ${jobTitle}
Specialization: ${spec || "N/A"}
Degree: ${degree || "N/A"}
Experience: ${expStr}
Skills: ${skills || "—"}
Certifications: ${certList || "—"}
Previous Jobs: ${prevJobs || "—"}
${cvExcerpt ? `\nCV Excerpt:\n${cvExcerpt}` : ""}

Strict Rules:
- 3 paragraphs only: opening, body highlighting skills and experience, closing.
- Professional tone suitable for Saudi/international companies.
- Do not mention a specific company name, use "your company" or "your organization".
- Do not add a title, greeting (Dear...), or sign-off (they will be added automatically).
- Maximum 220 words.
- Return only the letter body text, no extra formatting.`;

  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"];
  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
          }),
          signal: AbortSignal.timeout(30000),
        }
      );
      if (!r.ok) continue;
      const data = await r.json();
      const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
      if (text.length > 50) return text;
    } catch { continue; }
  }
  return "";
}

// ── بناء HTML الإيميل النهائي ────────────────────────────────────────────────

function buildEmailHtml(
  name: string,
  jobTitle: string,
  phone: string,
  email: string,
  lang: string,
  bodyText: string,
): string {
  const isAr = lang !== "en";

  // تحويل فقرات النص إلى HTML
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="line-height:1.95;margin:0 0 16px;font-size:15px;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  if (isAr) {
    return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>معاينة رسالة التقديم</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing:border-box; }
  body { margin:0; padding:20px 16px 32px; background:#f0f2f5; font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif; direction:rtl; }
  .badge { display:inline-flex; align-items:center; gap:6px; background:#dbeafe; color:#1d4ed8; font-size:12px; font-weight:700; padding:5px 14px; border-radius:100px; margin-bottom:16px; }
  .card { background:#0a1e36; color:#fff; padding:36px 32px; border-radius:14px; max-width:600px; }
  .header { font-size:19px; font-weight:700; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:16px; margin:0 0 24px; line-height:1.5; }
  .greeting { font-size:15px; font-weight:600; margin:0 0 18px; color:#93c5fd; }
  .body-text p { color:#e2e8f0; }
  .footer { margin-top:24px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.12); font-size:13px; line-height:1.9; color:#cbd5e1; }
  .footer strong { color:#fff; font-size:14px; }
  .note { color:#94a3b8; font-size:11px; text-align:center; margin-top:14px; }
</style>
</head>
<body>
<div class="badge">👁 معاينة — هذا هو الإيميل الذي سيصل للشركة باسمك عند التقديم</div>
<div class="card">
  <p class="header">إلى فريق التوظيف في <strong>شركتكم</strong></p>
  <p class="greeting">السلام عليكم ورحمة الله وبركاته،</p>
  <div class="body-text">${paragraphs}</div>
  <div class="footer">
    مع خالص التحية،<br>
    <strong>${name}</strong><br>
    ${phone || "رقم الجوال"}<br>
    ${email || "البريد الإلكتروني"}
  </div>
</div>
<p class="note">المسمى الوظيفي واسم الشركة يتغيران تلقائياً لكل وظيفة • الرسالة تُولَّد بالذكاء الاصطناعي بناءً على بياناتك الحقيقية</p>
</body></html>`;
  }

  return `<!DOCTYPE html><html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Application Letter Preview</title>
<style>
  * { box-sizing:border-box; }
  body { margin:0; padding:20px 16px 32px; background:#f0f2f5; font-family:'Segoe UI',Arial,sans-serif; }
  .badge { display:inline-flex; align-items:center; gap:6px; background:#dbeafe; color:#1d4ed8; font-size:12px; font-weight:700; padding:5px 14px; border-radius:100px; margin-bottom:16px; }
  .card { background:#0a1e36; color:#fff; padding:36px 32px; border-radius:14px; max-width:600px; }
  .header { font-size:19px; font-weight:700; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:16px; margin:0 0 24px; line-height:1.5; }
  .greeting { font-size:15px; font-weight:600; margin:0 0 18px; color:#93c5fd; }
  .body-text p { color:#e2e8f0; line-height:1.9; margin:0 0 14px; font-size:15px; }
  .footer { margin-top:24px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.12); font-size:13px; line-height:1.9; color:#cbd5e1; }
  .footer strong { color:#fff; font-size:14px; }
  .note { color:#94a3b8; font-size:11px; text-align:center; margin-top:14px; }
</style>
</head>
<body>
<div class="badge">👁 Preview — this is the exact email companies receive when you apply</div>
<div class="card">
  <p class="header">To the Hiring Team at <strong>Your Company</strong></p>
  <p class="greeting">Dear Hiring Manager,</p>
  <div class="body-text">${paragraphs}</div>
  <div class="footer">
    Best regards,<br>
    <strong>${name}</strong><br>
    ${phone || "Your phone number"}<br>
    ${email || "Your email"}
  </div>
</div>
<p class="note">Job title and company name change per application • Letter is AI-generated based on your real profile data</p>
</body></html>`;
}

// ── Fallback: قالب ثابت إذا فشل Gemini ──────────────────────────────────────

function buildFallbackHtml(
  name: string, phone: string, email: string, lang: string, profile: CvProfile | null, certs: Cert[],
): string {
  const isAr = lang !== "en";
  const spec   = profile?.specialization || profile?.degree || (isAr ? "مجال التخصص" : "my field");
  const exp    = profile?.experience_years ?? -1;
  const skills = (profile?.skills ?? []).slice(0, 5).join(isAr ? "، " : ", ") || (isAr ? "مهارات متعددة" : "relevant skills");
  const degree = profile?.degree
    ? profile.degree + (profile.specialization ? (isAr ? " في " : " in ") + profile.specialization : "")
    : (isAr ? "مؤهل علمي مناسب" : "Relevant academic qualification");
  const expStr = isAr
    ? exp > 0 ? `خبرة ${exp} ${exp === 1 ? "سنة" : "سنوات"} في المجال` : "حديث التخرج، لديّ رغبة قوية في التطور"
    : exp > 0 ? `${exp} year${exp === 1 ? "" : "s"} of relevant experience` : "Recent graduate, eager to grow";
  const certStr = certs.length
    ? (isAr ? "الشهادات: " : "Certifications: ") + certs.map(c => c.name).join(isAr ? "، " : ", ")
    : "";

  const body = isAr
    ? `<p style="line-height:2;margin:0 0 16px;font-size:15px;color:#e2e8f0;">أنا ${name}، متخصص في ${spec}، وأرغب بالانضمام إلى فريقكم.</p>
       <ul style="margin:0 0 16px;padding-right:20px;color:#e2e8f0;font-size:15px;line-height:2.2;">
         <li>${degree}</li><li>${expStr}</li><li>${skills}</li>${certStr ? `<li>${certStr}</li>` : ""}
       </ul>
       <p style="line-height:2;margin:0;font-size:15px;color:#e2e8f0;">أرفقت سيرتي الذاتية وأتطلع للتواصل معكم.</p>`
    : `<p style="line-height:1.9;margin:0 0 16px;font-size:15px;color:#e2e8f0;">I am ${name}, specializing in ${spec}, and I am writing to express my interest in joining your team.</p>
       <ul style="margin:0 0 16px;color:#e2e8f0;font-size:15px;line-height:2.2;">
         <li>${degree}</li><li>${expStr}</li><li>${skills}</li>${certStr ? `<li>${certStr}</li>` : ""}
       </ul>
       <p style="line-height:1.9;margin:0;font-size:15px;color:#e2e8f0;">Please find my CV attached. I look forward to speaking with you.</p>`;

  return buildEmailHtml(name, "", phone, email, lang, "").replace(
    /<div class="body-text">.*<\/div>/s,
    `<div class="body-text">${body}</div>`,
  );
}

// ── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const db = freshClient();

  const [userRes, cvRes, settingsRes, certsRes, prefsRes] = await Promise.all([
    db.from("users").select("full_name, phone, application_language").eq("id", uid).single(),
    db.from("user_cvs").select("cv_profile, cv_parsed_text").eq("user_id", uid).limit(1),
    db.from("user_settings").select("smtp_email, email").eq("user_id", uid).single(),
    db.from("user_certifications").select("type, name, issuer").eq("user_id", uid),
    db.from("user_job_preferences")
      .select("job_fields(name_ar, name_en)")
      .eq("user_id", uid)
      .limit(5),
  ]);

  const user     = userRes.data;
  const cvRow    = cvRes.data?.[0];
  const settings = settingsRes.data;
  const certs    = (certsRes.data ?? []) as Cert[];
  const profile  = (cvRow?.cv_profile ?? null) as CvProfile | null;
  const cvText   = String(cvRow?.cv_parsed_text ?? "").trim();

  const name  = user?.full_name || (user?.application_language === "en" ? "Applicant" : "المتقدم");
  const phone = user?.phone || "";
  const lang  = user?.application_language || "ar";
  const email = settings?.smtp_email || settings?.email || "";

  // أفضل مسمى وظيفي من تفضيلات المستخدم
  const isAr = lang !== "en";
  const prefs = (prefsRes.data ?? []) as Array<{ job_fields: { name_ar: string; name_en: string } | null }>;
  const firstPref = prefs[0]?.job_fields;
  const jobTitle = firstPref
    ? (isAr ? firstPref.name_ar : firstPref.name_en)
    : (profile?.specialization || (isAr ? "وظيفة مناسبة لتخصصي" : "a suitable position"));

  // توليد رسالة بالذكاء الاصطناعي
  const aiText = await generateLetterText(name, jobTitle, lang, profile, certs, cvText);

  let html: string;
  if (aiText) {
    html = buildEmailHtml(name, jobTitle, phone, email, lang, aiText);
  } else {
    html = buildFallbackHtml(name, phone, email, lang, profile, certs);
  }

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
