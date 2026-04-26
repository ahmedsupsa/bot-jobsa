import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "crypto";
import nodemailer from "nodemailer";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUserId(req: Request): Promise<string | null> {
  const token = extractToken(req);
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.user_id || null;
}

function decryptAES(encrypted: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const parts = encrypted.split(":");
  if (parts.length !== 2) throw new Error("تنسيق التشفير غير صحيح");
  const iv = Buffer.from(parts[0], "base64");
  const data = Buffer.from(parts[1], "base64");
  const tag = data.subarray(0, 16);
  const ciphertext = data.subarray(16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export async function POST(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });

  const encKey = process.env.SMTP_ENCRYPTION_KEY || "";
  if (!encKey) {
    return NextResponse.json({ error: "خطأ في الإعدادات — تواصل مع الدعم" }, { status: 500 });
  }

  const supabase = freshClient();
  const { data: rows } = await supabase
    .from("user_settings")
    .select("smtp_email,smtp_host,smtp_port,smtp_secure,smtp_app_password_encrypted")
    .eq("user_id", uid)
    .limit(1);

  const s = rows?.[0];
  if (!s?.smtp_email || !s?.smtp_app_password_encrypted) {
    return NextResponse.json({ error: "لم يتم حفظ إعدادات SMTP بعد" }, { status: 400 });
  }

  let appPassword: string;
  try {
    appPassword = decryptAES(s.smtp_app_password_encrypted, encKey);
  } catch {
    return NextResponse.json({ error: "فشل فك التشفير — أعد حفظ كلمة المرور" }, { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    host: s.smtp_host || "smtp.gmail.com",
    port: Number(s.smtp_port) || 465,
    secure: s.smtp_secure !== false,
    auth: { user: s.smtp_email, pass: appPassword },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });

  try {
    await transporter.sendMail({
      from: `Jobbots Test <${s.smtp_email}>`,
      to: s.smtp_email,
      subject: "✅ اتصال البريد يعمل بنجاح — Jobbots",
      html: `
        <div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:12px;">
          <h2 style="color:#111;margin:0 0 12px;">تم ربط بريدك بنجاح ✅</h2>
          <p style="color:#444;line-height:1.8;">
            مرحباً! هذا إيميل تجريبي للتأكد من أن إعدادات SMTP الخاصة بك تعمل بشكل صحيح مع منصة Jobbots.
          </p>
          <p style="color:#444;line-height:1.8;">
            الآن ستتم تقديماتك التلقائية من بريدك الشخصي <strong>${s.smtp_email}</strong> مباشرةً.
          </p>
          <p style="color:#999;font-size:12px;margin-top:24px;">Jobbots — التقديم التلقائي على الوظائف</p>
        </div>
      `,
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    return NextResponse.json(
      { error: `فشل الاتصال: ${msg}` },
      { status: 400 }
    );
  }

  await supabase
    .from("user_settings")
    .update({ email_connected: true, last_email_test_at: new Date().toISOString() })
    .eq("user_id", uid);

  return NextResponse.json({ ok: true });
}
