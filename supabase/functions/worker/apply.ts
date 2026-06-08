// ─── Apply Service — مستقل تماماً عن بقية الـ Pipeline ───────────────────────
// مسؤوليته الوحيدة: بناء رسالة التغطية + الإرسال عبر SMTP

import nodemailer from "npm:nodemailer@6";
import type { QueueItem } from "./queue.ts";

// ─── بناء رسالة التغطية من الجسم المحفوظ ─────────────────────────────────────

function replaceJobTitleInBody(body: string, jobTitle: string): string {
  return body
    .replace(/\{\{job_title\}\}/g, jobTitle)
    .replace(/لشغل منصب [^،.\n]{1,80}/g,      `لشغل منصب ${jobTitle}`)
    .replace(/لشغل وظيفة [^،.\n]{1,80}/g,     `لشغل وظيفة ${jobTitle}`)
    .replace(/على وظيفة [^،.\n]{1,80}/g,       `على وظيفة ${jobTitle}`)
    .replace(/للانضمام كـ?\s*[^،.\n]{1,80}/g, `للانضمام كـ${jobTitle}`);
}

function stripEmojis(text: string): string {
  return (text ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u2600-\u27BF]+/gu, "")
    .replace(/\s+/g, " ").trim();
}

export function buildCoverLetterHtml(item: QueueItem): string {
  const { userName, userPhone, userEmail, jobTitle, company, savedBody, cvProfile } = item;
  const company2  = (company || "").trim();
  const title2    = (jobTitle || "").trim();

  // ── من الجسم المحفوظ ──────────────────────────────────────────────────────
  if (savedBody && savedBody.trim()) {
    const cleanBody    = replaceJobTitleInBody(savedBody.trim(), title2);
    const coStr        = company2 ? ` في ${company2}` : "";
    const jobIntroText = `أتقدم بهذه الرسالة للتقديم على وظيفة ${title2}${coStr}.`;
    const jobIntroPara = `<p style="line-height:2;margin:0 0 16px;font-size:15px;font-weight:600;">${jobIntroText}</p>`;
    const paragraphs   = cleanBody
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p style="line-height:2;margin:0 0 16px;font-size:15px;">${p.replace(/\n/g, "<br>")}</p>`)
      .join("");

    const header = company2
      ? `إلى فريق التوظيف في <strong>${company2}</strong>${title2 ? ` &mdash; <span style="color:#93c5fd;">${title2}</span>` : ""}`
      : `طلب توظيف &mdash; <span style="color:#93c5fd;">${title2}</span>`;
    const greeting = company2
      ? `<p style="font-size:15px;font-weight:600;margin:20px 0 16px;color:#93c5fd;">السلام عليكم ورحمة الله وبركاته،</p>`
      : "";

    return wrapHtml(`
      <h2 style="margin-top:0;font-size:20px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:16px;">${header}</h2>
      ${greeting}
      <div style="color:#e2e8f0;">${jobIntroPara}${paragraphs}</div>
      <p style="margin:24px 0 0;line-height:2;font-size:14px;border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;color:#cbd5e1;">
        مع خالص التحية،<br><strong style="color:#fff;">${userName}</strong><br>${userPhone}<br>${userEmail}
      </p>
    `);
  }

  // ── قالب ثابت (عند غياب الجسم المحفوظ) ──────────────────────────────────
  const profile = cvProfile as { specialization?: string; experience_years?: number; skills?: string[]; degree?: string } | null;
  const spec    = profile?.specialization || profile?.degree || "مجال التخصص";
  const exp     = profile?.experience_years ?? -1;
  const skills  = (profile?.skills ?? []).slice(0, 5).join("، ") || "مهارات متنوعة في المجال";
  const degree  = profile?.degree
    ? profile.degree + (profile.specialization ? " في " + profile.specialization : "")
    : "مؤهل علمي مناسب";
  const expItem = exp > 0
    ? `خبرة ${exp} ${exp === 1 ? "سنة" : "سنوات"} في المجال`
    : "حديث التخرج، لديّ رغبة قوية في التطور والتعلم";

  const headerAr = company2
    ? `إلى فريق التوظيف في <strong>${company2}</strong>`
    : `طلب توظيف &mdash; <strong>${title2}</strong>`;
  const greetingLine = company2
    ? `<p style="line-height:2;margin:20px 0 8px;font-size:15px;">السلام عليكم ورحمة الله وبركاته،</p>`
    : "";

  return wrapHtml(`
    <h2 style="margin-top:0;font-size:20px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:16px;">${headerAr}</h2>
    ${greetingLine}
    <p style="line-height:2;margin:16px 0;font-size:15px;">
      أنا <strong>${userName}</strong>، متخصص في ${spec}،<br>
      وأرغب بالانضمام إلى فريقكم في وظيفة <strong>${title2}</strong>.
    </p>
    <ul style="line-height:2.2;padding-right:20px;font-size:15px;margin:0 0 20px;">
      <li>${degree}</li>
      <li>${expItem}</li>
      <li>${skills}</li>
    </ul>
    <p style="line-height:2;font-size:15px;margin:0 0 24px;">
      أرفقت لكم سيرتي الذاتية، وأتطلع لفرصة للتواصل معكم.
    </p>
    <p style="margin:0;line-height:2;font-size:14px;border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;">
      مع خالص التحية،<br>
      <strong>${userName}</strong><br>
      ${userPhone}<br>${userEmail}
    </p>
  `);
}

function wrapHtml(inner: string): string {
  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:24px;background:#f0f2f5;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;">
<div dir="rtl" style="background-color:#0a1e36;color:#ffffff;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;padding:40px;border-radius:12px;max-width:600px;margin:0 auto;">
${inner}
</div>
</body></html>`;
}

// ─── بناء النص العادي (للحفظ في DB) ──────────────────────────────────────────
export function buildPlainBody(item: QueueItem): string {
  const profile = item.cvProfile as { specialization?: string; experience_years?: number; skills?: string[]; degree?: string } | null;
  const spec    = profile?.specialization || profile?.degree || "مجال التخصص";
  const exp     = profile?.experience_years ?? -1;
  const skills  = (profile?.skills ?? []).slice(0, 5).join("، ") || "مهارات متنوعة في المجال";
  const degree  = profile?.degree
    ? profile.degree + (profile.specialization ? " في " + profile.specialization : "")
    : "مؤهل علمي مناسب";
  const expItem = exp > 0
    ? `خبرة ${exp} ${exp === 1 ? "سنة" : "سنوات"} في المجال`
    : "حديث التخرج، لديّ رغبة قوية في التطور والتعلم";

  return `أنا ${item.userName}، متخصص في ${spec}، وأتقدم بهذه الرسالة راغباً في الانضمام إلى فريقكم.

أبرز مؤهلاتي:
- ${degree}
- ${expItem}
- المهارات: ${skills}

أرفقت لكم سيرتي الذاتية، وأتطلع لفرصة للتواصل معكم.`;
}

// ─── الإرسال عبر SMTP ─────────────────────────────────────────────────────────

export async function sendViaSmtp(item: QueueItem, html: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host:               item.smtpHost,
    port:               item.smtpPort,
    secure:             item.smtpSecure,
    auth:               { user: item.userEmail, pass: item.appPassword },
    connectionTimeout:  20_000,
    greetingTimeout:    15_000,
  });

  const mailOptions: Record<string, unknown> = {
    from:    `${item.userName} <${item.userEmail}>`,
    to:      item.toEmail,
    subject: `التقديم على وظيفة: ${stripEmojis(item.jobTitle)}`,
    html,
    replyTo: item.userEmail,
  };

  if (item.cvBytes && item.cvName) {
    mailOptions.attachments = [{ filename: item.cvName, content: item.cvBytes }];
  }

  await transporter.sendMail(mailOptions);
}

export { stripEmojis };
