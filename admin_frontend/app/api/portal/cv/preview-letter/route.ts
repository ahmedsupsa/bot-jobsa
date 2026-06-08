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

type CvProfile = {
  degree?: string; specialization?: string; experience_years?: number;
  skills?: string[]; prev_jobs?: string[]; languages?: string[];
};

// ── 5 قوالب إبداعية لرسالة التقديم — تستخدم {{job_title}} كعنصر نائب ────────────
const TEMPLATES = [
  // القالب 1: أسلوب الإنجاز
  (name: string, spec: string, degree: string, expStr: string, skills: string, prevJobs: string, certs: string) =>
    `أتشرف بتقديم طلبي لشغل وظيفة {{job_title}} في شركتكم الموقرة، حيث أمتلك خلفية أكاديمية ومهنية${spec ? ` في ${spec}` : ""} تؤهلني للمساهمة بفعالية في فريق العمل.

${degree || "مؤهل علمي مناسب"}، ${expStr}.${skills ? `\nأمتلك مهارات بارزة في ${skills}، وهو ما مكّنني من تحقيق نتائج إيجابية في تجاربي السابقة.` : ""}${prevJobs ? `\n\nمن أبرز محطاتي المهنية: ${prevJobs}، حيث اكتسبت خبرة عملية في بيئات عمل متنوعة.` : ""}${certs ? `\n\nكما أحمل شهادات مهنية في: ${certs}.` : ""}

أرفق لكم سيرتي الذاتية، وأتطلّع لفرصة مناقشة كيف يمكنني إضافة قيمة لشركتكم.`,

  // القالب 2: أسلوب المهارات والتخصص
  (name: string, spec: string, degree: string, expStr: string, skills: string, prevJobs: string, certs: string) =>
    `يسعدني التقدم لوظيفة {{job_title}}، انطلاقاً من شغفي${spec ? ` في مجال ${spec}` : ""} ورغبتي في تطوير مساري المهني ضمن فريقكم المتميز.

حاصل على ${degree || "مؤهل علمي"}، ${expStr}.${skills ? `\nأجيد ${skills} وأسعى لتوظيف هذه المهارات في خدمة أهداف مؤسستكم.` : ""}${prevJobs ? `\n\nسبق لي العمل في: ${prevJobs}، مما أكسبني خبرة عملية في التعامل مع المهام المختلفة.` : ""}${certs ? `\n\nأمتلك ${certs}، والتي تعزز قدراتي في المجال.` : ""}

أرفقت سيرتي الذاتية، وآمل أن أكون إضافة نوعية لفريقكم.`,

  // القالب 3: أسلوب الحماس والتطوير
  (name: string, spec: string, degree: string, expStr: string, skills: string, prevJobs: string, certs: string) =>
    `أتقدّم بطلب التوظيف لوظيفة {{job_title}}، وأنا على يقين${spec ? ` بأن خبرتي في ${spec}` : ""} وشغفي بالتطوير المستمر سيسهمان في نجاح شركتكم.

أحمل ${degree || "مؤهل علمي"}، ${expStr}.${skills ? `\nأتمتّع بمهارات قوية في ${skills}، وأحرص على تطويرها باستمرار.` : ""}${prevJobs ? `\n\nعملت سابقاً في ${prevJobs}، مما صقل مهاراتي وأكسبني خبرات عملية قيّمة.` : ""}${certs ? `\n\nأحرص على التطوير المهني المستمر، وأحمل: ${certs}.` : ""}

أرفقت سيرتي الذاتية، وأتطلع لفرصة لقاءكم لإقناعكم بما أملك من مؤهلات.`,

  // القالب 4: أسلوب مختصر وقوي
  (name: string, spec: string, degree: string, expStr: string, skills: string, prevJobs: string, certs: string) =>
    `أرغب في الانضمام إلى فريقكم في وظيفة {{job_title}}${spec ? `، حيث أنا متخصص في ${spec}` : ""} وأسعى لتقديم أفضل ما لدي.

${degree || "مؤهل علمي"} — ${expStr}.${skills ? `\nمهاراتي الأساسية: ${skills}.` : ""}${certs ? `\nالشهادات: ${certs}.` : ""}

أرفقت سيرتي الذاتية، وأتطلع للتواصل معكم.`,

  // القالب 5: أسلوب احترافي مع لمسة شخصية
  (name: string, spec: string, degree: string, expStr: string, skills: string, prevJobs: string, certs: string) =>
    `يسرّني التقدّم للانضمام إلى شركتكم في وظيفة {{job_title}}${spec ? `، فأنا متخصص في ${spec}` : ""} وأؤمن بقدرتي على تقديم إضافة حقيقية.

${degree || "مؤهل علمي"}، ${expStr}.${skills ? `\nأتميز في ${skills}، وأعمل دائماً على تطويرها لتحقيق أفضل النتائج.` : ""}${prevJobs ? `\n\nخبراتي السابقة في ${prevJobs} أكسبتني فهماً عميقاً لسوق العمل وقدرة على التكيف مع مختلف التحديات.` : ""}${certs ? `\n\nأحمل ${certs}، وأسعى دائماً للتميز والتطوير.` : ""}

أرفقت لكم سيرتي الذاتية، وأتطلع للقاء بكم.`,
];

function generateTemplateBody(
  name: string,
  profile: CvProfile | null, certs: { name: string; issuer: string | null }[], cvText: string,
): string {
  const spec   = profile?.specialization || profile?.degree || "";
  const degree = profile?.degree || "";
  const exp    = profile?.experience_years ?? -1;
  const skills = (profile?.skills ?? []).slice(0, 5).join("، ");
  const prevJobs = (profile?.prev_jobs ?? []).slice(0, 2).join("، ");
  const certList = certs.slice(0, 3).map(c => c.name).join("، ");
  const expStr = exp > 0 ? `خبرة ${exp} ${exp === 1 ? "سنة" : "سنوات"}` : "حديث التخرج";

  // اختيار قالب بناءً على أول حرف من الاسم (تنويع ثابت لكل مستخدم)
  const idx = name.charCodeAt(0) % TEMPLATES.length;
  const body = TEMPLATES[idx](name, spec, degree, expStr, skills, prevJobs, certList);

  // إزالة الأسطر الفارغة المتعددة
  return body.replace(/\n{3,}/g, "\n\n").trim();
}

// ── بناء HTML النهائي للعرض ──────────────────────────────────────────────────

function wrapInEmailHtml(
  name: string, phone: string, email: string, bodyText: string,
): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map(p => p.trim()).filter(Boolean)
    .map(p => `<p style="line-height:1.95;margin:0 0 16px;font-size:15px;color:#e2e8f0;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}body{margin:0;padding:20px 16px 32px;background:#f0f2f5;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl}.badge{display:inline-flex;align-items:center;gap:6px;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;padding:5px 14px;border-radius:100px;margin-bottom:16px}.card{background:#0a1e36;color:#fff;padding:36px 32px;border-radius:14px;max-width:600px}.hdr{font-size:19px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.12);padding-bottom:16px;margin:0 0 20px;line-height:1.5}.greet{font-size:15px;font-weight:600;margin:0 0 18px;color:#93c5fd}.footer{margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.12);font-size:13px;line-height:1.9;color:#cbd5e1}.footer strong{color:#fff;font-size:14px}.note{color:#94a3b8;font-size:11px;text-align:center;margin-top:14px}</style>
</head>
<body>
<div class="badge">👁 معاينة — هذا هو الإيميل الحقيقي الذي يصل للشركة باسمك</div>
<div class="card">
  <p class="hdr">إلى فريق التوظيف المختص</p>
  <p class="greet">السلام عليكم ورحمة الله وبركاته،</p>
  <div>${paragraphs}</div>
  <div class="footer">مع خالص التحية،<br><strong>${name}</strong><br>${phone || "رقم الجوال"}<br>${email || "البريد الإلكتروني"}</div>
</div>
<p class="note">اسم الشركة يُستبدل تلقائياً لكل وظيفة عند التقديم</p>
</body></html>`;
}

// ── GET: جلب أو توليد القالب ─────────────────────────────────────────────────

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const url = new URL(req.url);
  const forceRegen = url.searchParams.get("regenerate") === "1";
  const formatJson = url.searchParams.get("format") === "json";

  // وضع JSON — يُرجع نص الجسم الخام فقط (للتعديل)
  if (formatJson && !forceRegen) {
    const db = freshClient();
    const { data } = await db.from("user_settings").select("cover_letter_body").eq("user_id", uid).single();
    return NextResponse.json({ body: data?.cover_letter_body || "" });
  }

  const db = freshClient();

  const [userRes, cvRes, settingsRes, certsRes, prefsRes] = await Promise.all([
    db.from("users").select("full_name, phone").eq("id", uid).single(),
    db.from("user_cvs").select("cv_profile, cv_parsed_text").eq("user_id", uid).limit(1),
    db.from("user_settings").select("smtp_email, email, cover_letter_body").eq("user_id", uid).single(),
    db.from("user_certifications").select("name, issuer").eq("user_id", uid),
    db.from("user_job_preferences").select("job_fields(name_ar)").eq("user_id", uid).limit(5),
  ]);

  const user     = userRes.data;
  const cvRow    = cvRes.data?.[0];
  const settings = settingsRes.data;
  const certs    = (certsRes.data ?? []) as { name: string; issuer: string | null }[];
  const profile  = (cvRow?.cv_profile ?? null) as CvProfile | null;
  const cvText   = String(cvRow?.cv_parsed_text ?? "").trim();
  const name     = user?.full_name || "المتقدم";
  const phone    = user?.phone || "";
  const email    = settings?.smtp_email || settings?.email || "";
  const savedBody = (!forceRegen && settings?.cover_letter_body) || null;

  // إذا في قالب محفوظ ومش طلب إعادة إنشاء → أعده فوراً
  if (savedBody) {
    const html = wrapInEmailHtml(name, phone, email, savedBody);
    // تسجيل المعاينة
    await db.from("user_settings").update({ cover_letter_viewed: true }).eq("user_id", uid);
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // توليد الرسالة من القوالب (بدون AI) — تستخدم {{job_title}} كعنصر نائب
  const body = generateTemplateBody(name, profile, certs, cvText);

  // حفظ القالب وتحديث cover_letter_viewed
  await db.from("user_settings").update({ cover_letter_body: body, cover_letter_viewed: true }).eq("user_id", uid);

  const html = wrapInEmailHtml(name, phone, email, body);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
