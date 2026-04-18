import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || "Jobbots";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

function buildEmailHtml(
  name: string,
  phone: string,
  jobTitle: string,
  company: string,
  cover: string,
  lang: string
): string {
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const coverHtml = cover.replace(/\n/g, "<br>");
  const companyHtml = company
    ? `<p><strong>${isAr ? "الشركة" : "Company"}:</strong> ${company}</p>`
    : "";
  return `<!DOCTYPE html><html dir="${dir}" lang="${isAr ? "ar" : "en"}">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9f9f9;direction:${dir};text-align:${isAr ? "right" : "left"};">
<div style="background:#fff;padding:24px;border-radius:8px;">
<h2 style="color:#333;margin:0 0 12px;">${isAr ? "طلب توظيف" : "Job Application"} — ${jobTitle}</h2>
<p style="line-height:1.9;color:#2c2c2c;">${coverHtml}</p>
<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
${companyHtml}
<p><strong>${isAr ? "الاسم" : "Name"}:</strong> ${name}</p>
<p><strong>${isAr ? "الجوال" : "Phone"}:</strong> ${phone}</p>
</div></body></html>`;
}

async function generateCoverLetter(
  jobTitle: string,
  name: string,
  company: string,
  desc: string,
  lang: string
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return lang === "ar"
      ? `أتقدم بكل اهتمام لشغل وظيفة ${jobTitle}${company ? " في " + company : ""}. أنا مهتم بهذه الفرصة وأثق في قدرتي على إضافة قيمة حقيقية لفريقكم.`
      : `I am writing to express my interest in the ${jobTitle} position${company ? " at " + company : ""}. I am confident in my ability to contribute effectively to your team.`;
  }

  const prompt =
    `اكتب رسالة تغطية مختصرة (3-4 جمل) باللغة ${lang === "ar" ? "العربية" : "الإنجليزية"} ` +
    `للتقديم على وظيفة: ${jobTitle}` +
    (company ? ` في شركة ${company}` : "") +
    (desc ? `. تفاصيل: ${desc.slice(0, 300)}` : "") +
    `. الاسم: ${name}. لا تضف إيموجي.`;

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const data = await r.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

// GET /api/admin/email-test — return users + jobs for the dropdowns
export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();

  const [{ data: users }, { data: jobs }] = await Promise.all([
    supabase
      .from("users")
      .select("id,full_name,phone,subscription_ends_at")
      .order("full_name"),
    supabase
      .from("admin_jobs")
      .select("id,title_ar,title_en,company,description_ar,description_en,application_email")
      .eq("is_active", true)
      .order("title_ar"),
  ]);

  // fetch emails for users
  const userIds = (users || []).map((u: any) => u.id);
  const { data: settings } = await supabase
    .from("user_settings")
    .select("user_id,email,application_language")
    .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const settingsMap: Record<string, any> = {};
  (settings || []).forEach((s: any) => { settingsMap[s.user_id] = s; });

  const usersWithEmail = (users || []).map((u: any) => ({
    ...u,
    email: settingsMap[u.id]?.email || "",
    lang: settingsMap[u.id]?.application_language || "ar",
  }));

  return NextResponse.json({ ok: true, users: usersWithEmail, jobs: jobs || [] });
}

// POST /api/admin/email-test — action: connection | preview | send
export async function POST(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── action: connection ─────────────────────────────────────────────────────
  if (action === "connection") {
    if (!RESEND_API_KEY) return NextResponse.json({ ok: false, error: "RESEND_API_KEY غير مضبوط" });
    const r = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    if (r.ok) {
      const d = await r.json();
      return NextResponse.json({ ok: true, domains: (d.data || []).map((x: any) => x.name) });
    }
    return NextResponse.json({ ok: false, error: `Resend رد بـ ${r.status}` });
  }

  // ── action: preview ────────────────────────────────────────────────────────
  if (action === "preview") {
    const { user_id, job_id, custom_job_title, custom_company, custom_desc, lang } = body;

    let name = "أحمد العمري", phone = "05xxxxxxxx", email = "";
    if (user_id) {
      const { data: users } = await supabase.from("users").select("full_name,phone").eq("id", user_id).limit(1);
      if (users?.[0]) { name = users[0].full_name || name; phone = users[0].phone || phone; }
      const { data: s } = await supabase.from("user_settings").select("email,application_language").eq("user_id", user_id).limit(1);
      email = s?.[0]?.email || "";
    }

    let jobTitle = custom_job_title || "مطوّر برمجيات";
    let company = custom_company || "";
    let desc = custom_desc || "";
    const language = lang || "ar";

    if (job_id) {
      const { data: jobs } = await supabase.from("admin_jobs").select("*").eq("id", job_id).limit(1);
      if (jobs?.[0]) {
        jobTitle = jobs[0].title_ar || jobs[0].title_en || jobTitle;
        company = jobs[0].company || company;
        desc = jobs[0].description_ar || jobs[0].description_en || desc;
      }
    }

    let cover = "";
    try {
      cover = await generateCoverLetter(jobTitle, name, company, desc, language);
    } catch {
      cover = language === "ar"
        ? `أتقدم بكل اهتمام لشغل وظيفة ${jobTitle}${company ? " في " + company : ""}. أثق في قدرتي على إضافة قيمة حقيقية.`
        : `I am writing to express my interest in the ${jobTitle} position.`;
    }

    const html = buildEmailHtml(name, phone, jobTitle, company, cover, language);
    const subject = language === "ar"
      ? `التقديم على وظيفة: ${jobTitle}`
      : `Application for: ${jobTitle}`;

    return NextResponse.json({ ok: true, html, subject, from_name: name, reply_to: email });
  }

  // ── action: send ───────────────────────────────────────────────────────────
  if (action === "send") {
    const { to_email, subject, html, from_name } = body;
    if (!to_email) return NextResponse.json({ ok: false, error: "أدخل البريد المرسَل إليه" });
    if (!RESEND_API_KEY || !RESEND_FROM_EMAIL)
      return NextResponse.json({ ok: false, error: "RESEND غير مضبوط" });

    const payload = {
      from: `${from_name || RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
      to: [to_email],
      subject: subject || "تجربة إرسال من Jobbots",
      html: html || "<p>اختبار</p>",
    };

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));
    if (r.ok) return NextResponse.json({ ok: true, id: data.id });
    return NextResponse.json({ ok: false, error: data?.message || `خطأ ${r.status}` });
  }

  return NextResponse.json({ ok: false, error: "action غير معروف" }, { status: 400 });
}
