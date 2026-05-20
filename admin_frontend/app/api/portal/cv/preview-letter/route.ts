import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

type Cert = { type: string; name: string; issuer: string | null };

function buildPreviewHtml(
  name: string,
  jobTitle: string,
  company: string,
  phone: string,
  email: string,
  lang: string,
  profile: {
    degree?: string;
    specialization?: string;
    experience_years?: number;
    skills?: string[];
    is_fresh_graduate?: boolean;
  } | null,
  certs?: Cert[],
): string {
  const isAr = lang !== "en";
  const companyDisplay = company || (isAr ? "جهة التوظيف" : "Your Company");
  const spec = profile?.specialization || profile?.degree || (isAr ? "مجال التخصص" : "my field");
  const exp = profile?.experience_years ?? -1;
  const skills = (profile?.skills ?? []).slice(0, 5).join(isAr ? "، " : ", ") || (isAr ? "مهارات متنوعة في المجال" : "relevant skills");

  const degreeItem = isAr
    ? profile?.degree
      ? profile.degree + (profile.specialization ? " في " + profile.specialization : "")
      : "مؤهل علمي مناسب"
    : profile?.degree
      ? profile.degree + (profile.specialization ? " in " + profile.specialization : "")
      : "Relevant academic qualification";

  const expItem = isAr
    ? exp > 0
      ? `خبرة ${exp} ${exp === 1 ? "سنة" : "سنوات"} في المجال`
      : "حديث التخرج، لديّ رغبة قوية في التطور والتعلم"
    : exp > 0
      ? `${exp} year${exp === 1 ? "" : "s"} of relevant experience`
      : "Recent graduate, eager to learn and grow professionally";

  let certsItem = "";
  if (certs && certs.length > 0) {
    const certList = certs.map(c => c.name + (c.issuer ? ` (${c.issuer})` : "")).join(isAr ? "، " : ", ");
    certsItem = isAr ? `الشهادات والرخص: ${certList}` : `Certifications & Licenses: ${certList}`;
  }

  if (isAr) {
    return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>معاينة رسالة التقديم</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { margin:0; padding:24px; background:#f0f2f5; font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif; }
  .badge { display:inline-block; background:#e0f2fe; color:#0369a1; font-size:12px; font-weight:700; padding:4px 12px; border-radius:100px; margin-bottom:20px; }
</style>
</head>
<body>
<p class="badge">👁 معاينة — هذا شكل الرسالة التي ترسلها المنصة باسمك</p>
<div dir="rtl" style="background-color:#0a1e36;color:#ffffff;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;padding:40px;border-radius:12px;max-width:600px;">
  <h2 style="margin-top:0;font-size:20px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:16px;">
    إلى فريق التوظيف في <strong>${companyDisplay}</strong>
  </h2>
  <p style="line-height:2;margin:20px 0;font-size:15px;">
    السلام عليكم ورحمة الله وبركاته،<br><br>
    أنا <strong>${name}</strong>، متخصص في ${spec}،<br>
    وأرغب بالانضمام إلى فريقكم في وظيفة <strong>${jobTitle}</strong>.
  </p>
  <ul style="line-height:2.2;padding-right:20px;font-size:15px;margin:0 0 20px;">
    <li>${degreeItem}</li>
    <li>${expItem}</li>
    <li>${skills}</li>
    ${certsItem ? `<li>${certsItem}</li>` : ""}
  </ul>
  <p style="line-height:2;font-size:15px;margin:0 0 24px;">
    أرفقت لكم سيرتي الذاتية، وأتطلع لفرصة للتواصل معكم.
  </p>
  <p style="margin:0;line-height:2;font-size:14px;border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;">
    مع خالص التحية،<br>
    <strong>${name}</strong><br>
    ${phone || "جوالك"}<br>
    ${email || "بريدك الإلكتروني"}
  </p>
</div>
<p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:16px;">
  اسم الشركة والمسمى الوظيفي يتغيران تلقائياً لكل وظيفة — باقي الرسالة ثابت
</p>
</body></html>`;
  }

  return `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Application Letter Preview</title></head>
<body style="margin:0;padding:24px;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
<p style="display:inline-block;background:#e0f2fe;color:#0369a1;font-size:12px;font-weight:700;padding:4px 12px;border-radius:100px;margin-bottom:20px;">
  👁 Preview — this is how your application email looks
</p>
<div style="background-color:#0a1e36;color:#ffffff;padding:40px;border-radius:12px;max-width:600px;">
  <h2 style="margin-top:0;font-size:20px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:16px;">
    To the Hiring Team at <strong>${companyDisplay}</strong>
  </h2>
  <p style="line-height:1.9;margin:20px 0;font-size:15px;">
    Dear Hiring Manager,<br><br>
    My name is <strong>${name}</strong>, specializing in ${spec}.<br>
    I am writing to express my interest in the <strong>${jobTitle}</strong> position.
  </p>
  <ul style="line-height:2.2;font-size:15px;margin:0 0 20px;">
    <li>${degreeItem}</li>
    <li>${expItem}</li>
    <li>${skills}</li>
    ${certsItem ? `<li>${certsItem}</li>` : ""}
  </ul>
  <p style="line-height:1.9;font-size:15px;margin:0 0 24px;">Please find my CV attached. I look forward to the opportunity to speak with you.</p>
  <p style="margin:0;line-height:2;font-size:14px;border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;">
    Best regards,<br><strong>${name}</strong><br>${phone || "Your phone"}<br>${email || "Your email"}
  </p>
</div>
<p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:16px;">
  Company name and job title change automatically per job — the rest stays fixed
</p>
</body></html>`;
}

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const [userRes, cvRes, settingsRes, certsRes] = await Promise.all([
    supabase.from("users").select("full_name, phone, application_language").eq("id", uid).single(),
    supabase.from("user_cvs").select("cv_profile").eq("user_id", uid).limit(1),
    supabase.from("user_settings").select("smtp_email, email").eq("user_id", uid).single(),
    supabase.from("user_certifications").select("type, name, issuer").eq("user_id", uid),
  ]);

  const user     = userRes.data;
  const cvRow    = cvRes.data?.[0];
  const settings = settingsRes.data;
  const certs    = (certsRes.data ?? []) as Cert[];

  const name    = user?.full_name || "اسمك";
  const phone   = user?.phone || "";
  const lang    = user?.application_language || "ar";
  const profile = (cvRow?.cv_profile ?? null) as any;
  const email   = settings?.smtp_email || settings?.email || "";

  const jobTitle  = lang === "en" ? "Software Engineer" : "مطوّر برمجيات";
  const html = buildPreviewHtml(name, jobTitle, "شركة نموذجية", phone, email, lang, profile, certs);

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
