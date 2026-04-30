import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || "Jobbots";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

function freshClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export const dynamic = "force-dynamic";

function personalize(text: string, name: string) {
  return text.replace(/\{\{name\}\}/gi, name || "");
}

function buildHtml(subject: string, body: string) {
  const safeBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Tahoma,sans-serif;background:#f5f5f5;margin:0;padding:24px;direction:rtl;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
    <h2 style="color:#1a1a1a;margin:0 0 16px;font-size:20px;">${subject}</h2>
    <div style="color:#333;line-height:1.9;font-size:15px;">${safeBody}</div>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0 16px;">
    <p style="color:#999;font-size:12px;margin:0;text-align:center;">Jobbots — منصة التقديم التلقائي للوظائف</p>
  </div>
</body></html>`;
}

export async function POST(req: Request) {
  const denied = enforcePermission("email-test"); if (denied) return denied;

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY أو RESEND_FROM_EMAIL غير معرّف" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { to_email, to_name, subject, message, from_name, reply_to } = body;

  const cleanTo = String(to_email || "").trim().toLowerCase();
  const cleanName = String(to_name || "").trim();
  const cleanSubject = String(subject || "").trim();
  const cleanMessage = String(message || "").trim();

  if (!cleanTo || !cleanTo.includes("@")) {
    return NextResponse.json({ ok: false, error: "البريد الإلكتروني غير صحيح" }, { status: 400 });
  }
  if (!cleanSubject) {
    return NextResponse.json({ ok: false, error: "العنوان مطلوب" }, { status: 400 });
  }
  if (!cleanMessage) {
    return NextResponse.json({ ok: false, error: "نص الرسالة مطلوب" }, { status: 400 });
  }

  const senderName = String(from_name || "").trim() || RESEND_FROM_NAME;
  const cleanReplyTo = String(reply_to || "").trim();

  const personalizedSubject = personalize(cleanSubject, cleanName);
  const personalizedMessage = personalize(cleanMessage, cleanName);

  const toAddress = cleanName ? `${cleanName} <${cleanTo}>` : cleanTo;

  const payload: Record<string, unknown> = {
    from: `${senderName} <${RESEND_FROM_EMAIL}>`,
    to: [toAddress],
    subject: personalizedSubject,
    html: buildHtml(personalizedSubject, personalizedMessage),
    text: personalizedMessage,
  };
  if (cleanReplyTo && cleanReplyTo.includes("@")) {
    payload.reply_to = cleanReplyTo;
  }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: data?.message || `خطأ ${r.status}` }, { status: 400 });
  }

  // Log to DB
  try {
    const supabase = freshClient();
    await supabase.from("sent_private_messages").insert({
      recipient_email: cleanTo,
      subject: personalizedSubject,
      message: personalizedMessage,
      status: "sent"
    });
  } catch (e) {
    console.error("Failed to log private message:", e);
  }

  return NextResponse.json({ ok: true, id: data.id });
}
