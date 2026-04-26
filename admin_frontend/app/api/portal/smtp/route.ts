import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
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

function encryptAES(text: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const data = Buffer.concat([tag, encrypted]);
  return `${iv.toString("base64")}:${data.toString("base64")}`;
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

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export async function GET(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });

  const supabase = freshClient();
  const { data: rows } = await supabase
    .from("user_settings")
    .select("smtp_email,smtp_host,smtp_port,smtp_secure,email_connected,last_email_test_at")
    .eq("user_id", uid)
    .limit(1);

  const s = rows?.[0] || {};
  return NextResponse.json({
    smtp_email: s.smtp_email || "",
    smtp_host: s.smtp_host || "smtp.gmail.com",
    smtp_port: s.smtp_port || 465,
    smtp_secure: s.smtp_secure !== false,
    email_connected: s.email_connected || false,
    last_email_test_at: s.last_email_test_at || null,
  });
}

export async function POST(req: Request) {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });

  const body = await req.json();
  const { smtp_email, app_password, smtp_host, smtp_port, smtp_secure } = body;

  if (!smtp_email || !EMAIL_RE.test(smtp_email)) {
    return NextResponse.json({ error: "البريد الإلكتروني غير صالح" }, { status: 400 });
  }
  if (!app_password || app_password.length < 4) {
    return NextResponse.json({ error: "كلمة مرور التطبيق مطلوبة" }, { status: 400 });
  }

  const encKey = process.env.SMTP_ENCRYPTION_KEY || "";
  if (!encKey) {
    return NextResponse.json({ error: "خطأ في الإعدادات — تواصل مع الدعم" }, { status: 500 });
  }

  const encrypted = encryptAES(app_password, encKey);

  const supabase = freshClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: uid,
        smtp_email: smtp_email.trim().toLowerCase(),
        smtp_host: smtp_host || "smtp.gmail.com",
        smtp_port: Number(smtp_port) || 465,
        smtp_secure: smtp_secure !== false,
        smtp_app_password_encrypted: encrypted,
        email_connected: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    return NextResponse.json({ error: "فشل الحفظ: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
