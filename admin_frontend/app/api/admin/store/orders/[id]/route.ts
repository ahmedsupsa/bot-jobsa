import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";
import { makeToken } from "@/lib/auth";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || "Jobbots";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

function genCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const d = Array.from({ length: 7 }, () => digits[Math.floor(Math.random() * 10)]).join("");
  const l = Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * 26)]).join("");
  return d + l;
}

async function createAndReserveCode(
  supabase: ReturnType<typeof freshClient>,
  durationDays: number
): Promise<{ id: string; code: string } | null> {
  for (let i = 0; i < 10; i++) {
    const candidate = genCode();
    const { data: existing } = await supabase
      .from("activation_codes")
      .select("code")
      .eq("code", candidate)
      .maybeSingle();
    if (!existing) {
      const { data } = await supabase
        .from("activation_codes")
        .insert({ code: candidate, subscription_days: durationDays, used: false, created_at: new Date().toISOString() })
        .select("id, code")
        .single();
      if (data) return { id: data.id, code: data.code };
    }
  }
  return null;
}

async function findExistingUser(
  supabase: ReturnType<typeof freshClient>,
  userId: string | null,
  email: string
): Promise<{ id: string; subscription_ends_at: string | null } | null> {
  // 1. Direct user_id on the order (most reliable)
  if (userId) {
    const { data } = await supabase
      .from("users")
      .select("id, subscription_ends_at")
      .eq("id", userId)
      .maybeSingle();
    if (data) return data;
  }

  if (!email) return null;

  // 2. Check users.email
  const { data: byEmail } = await supabase
    .from("users")
    .select("id, subscription_ends_at")
    .eq("email", email)
    .maybeSingle();
  if (byEmail) return byEmail;

  // 3. Fallback: check user_settings.email (older accounts)
  const { data: bySetting } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();
  if (bySetting?.user_id) {
    const { data: u } = await supabase
      .from("users")
      .select("id, subscription_ends_at")
      .eq("id", bySetting.user_id)
      .maybeSingle();
    if (u) return u;
  }

  return null;
}

async function autoActivateOrder(
  supabase: ReturnType<typeof freshClient>,
  orderId: string
): Promise<{ code: string | null; email: string | null; name: string; durationDays: number; isNew: boolean }> {
  const { data: order } = await supabase
    .from("store_orders")
    .select("*, store_products(duration_days)")
    .eq("id", orderId)
    .single();

  if (!order) return { code: null, email: null, name: "مستخدم", durationDays: 30, isNew: false };

  // Duration: from joined product, or fallback to 30
  const rawDays =
    order.store_products?.duration_days ??
    (Array.isArray(order.store_products) ? order.store_products[0]?.duration_days : undefined) ??
    30;
  const durationDays = Number(rawDays) || 30;

  const email = order.user_email?.trim().toLowerCase() || "";
  const name = order.user_name?.trim() || "مستخدم";
  const phone = order.user_phone?.trim() || "غير محدد";

  // Find existing user via user_id OR email (users table OR user_settings)
  const existingUser = await findExistingUser(supabase, order.user_id || null, email);

  if (existingUser) {
    // Extend subscription from current end date (or today if already expired)
    const base =
      existingUser.subscription_ends_at && new Date(existingUser.subscription_ends_at) > new Date()
        ? new Date(existingUser.subscription_ends_at)
        : new Date();
    base.setDate(base.getDate() + durationDays);

    const { error: updateErr } = await supabase
      .from("users")
      .update({ subscription_ends_at: base.toISOString() })
      .eq("id", existingUser.id);

    if (updateErr) console.error("Subscription extend error:", updateErr.message);

    // Get email for notification if it came from user_settings
    let notifyEmail = email;
    if (!notifyEmail) {
      const { data: s } = await supabase
        .from("user_settings")
        .select("email")
        .eq("user_id", existingUser.id)
        .maybeSingle();
      notifyEmail = s?.email || "";
    }

    return { code: null, email: notifyEmail || email, name, durationDays, isNew: false };
  }

  // No existing user — create new account
  if (!email) return { code: null, email: null, name, durationDays, isNew: false };

  const ends_at = new Date(Date.now() + durationDays * 86400000).toISOString();
  const codeEntry = await createAndReserveCode(supabase, durationDays);

  const insertData: Record<string, unknown> = {
    full_name: name,
    phone,
    email,
    subscription_ends_at: ends_at,
    ...(codeEntry ? { activation_code_id: codeEntry.id } : {}),
  };

  let { data: userRows, error: userErr } = await supabase
    .from("users")
    .insert(insertData)
    .select("id");

  if (userErr?.message?.includes("telegram_id") || userErr?.message?.includes("null value")) {
    const fb = await supabase
      .from("users")
      .insert({ ...insertData, telegram_id: -(Date.now() % 2147483647 + Math.floor(Math.random() * 99999)) })
      .select("id");
    userRows = fb.data;
    userErr = fb.error;
  }

  if (userErr || !userRows?.[0]) {
    console.error("User creation error:", userErr?.message);
    return { code: codeEntry?.code || null, email, name, durationDays, isNew: false };
  }

  const userId = userRows[0].id;

  if (codeEntry) {
    await supabase
      .from("activation_codes")
      .update({ used: true, used_at: new Date().toISOString(), used_by_user_id: userId })
      .eq("id", codeEntry.id);
  }

  try {
    await supabase.from("user_settings").insert({ user_id: userId, email });
  } catch {}

  return { code: codeEntry?.code || null, email, name, durationDays, isNew: true };
}

function buildActivationEmail(name: string, code: string | null, durationDays: number, isNew: boolean): string {
  const months = durationDays >= 365 ? "سنة كاملة" : durationDays >= 90 ? `${Math.round(durationDays / 30)} أشهر` : durationDays >= 30 ? "شهر" : `${durationDays} يوم`;
  const portalUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.jobbots.org";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Tajawal',Tahoma,system-ui,sans-serif;direction:rtl;">
  <div style="max-width:560px;margin:40px auto;padding:0 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#fff;padding:10px 20px;border-radius:14px;">
        <span style="font-size:20px;font-weight:900;color:#0a0a0a;letter-spacing:-0.5px;">Jobbots</span>
      </div>
    </div>

    <!-- Card -->
    <div style="background:#111;border:1px solid #1f1f1f;border-radius:20px;padding:36px 32px;">

      <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 8px;">
        ${isNew ? "🎉 تم تفعيل اشتراكك!" : "✅ تم تجديد اشتراكك!"}
      </h1>
      <p style="color:#aaa;font-size:14px;margin:0 0 28px;line-height:1.8;">
        مرحباً ${name}، تم تأكيد تحويلك وتفعيل اشتراكك في Jobbots.
      </p>

      <!-- Subscription info -->
      <div style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <div style="color:#777;font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">مدة الاشتراك</div>
        <div style="color:#a78bfa;font-size:20px;font-weight:900;">${months}</div>
      </div>

      ${code ? `
      <!-- Activation code -->
      <div style="background:linear-gradient(135deg,rgba(167,139,250,0.1),rgba(109,40,217,0.06));border:1px solid rgba(167,139,250,0.25);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
        <div style="color:#a78bfa;font-size:11px;font-weight:600;margin-bottom:10px;letter-spacing:1px;text-transform:uppercase;">كود التفعيل الخاص بك</div>
        <div style="color:#fff;font-size:28px;font-weight:900;letter-spacing:4px;font-family:monospace;">${code}</div>
        <div style="color:#666;font-size:11px;margin-top:8px;">احتفظ بهذا الكود في مكان آمن</div>
      </div>
      ` : ""}

      <!-- CTA -->
      <a href="${portalUrl}/portal" style="display:block;background:#fff;color:#0a0a0a;text-align:center;padding:14px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;margin-bottom:20px;">
        الدخول إلى لوحة التحكم ←
      </a>

      <p style="color:#555;font-size:12px;line-height:1.8;margin:0;text-align:center;">
        إذا واجهت أي مشكلة تواصل معنا على
        <a href="mailto:support@jobbots.org" style="color:#a78bfa;text-decoration:none;">support@jobbots.org</a>
      </p>
    </div>

    <!-- Footer -->
    <p style="text-align:center;color:#333;font-size:11px;margin-top:20px;">
      Jobbots — منصة التقديم التلقائي على الوظائف
    </p>
  </div>
</body>
</html>`;
}

async function sendActivationEmail(to: string, name: string, code: string | null, durationDays: number, isNew: boolean) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !to) return;

  const subject = isNew ? "🎉 تم تفعيل اشتراكك في Jobbots" : "✅ تم تجديد اشتراكك في Jobbots";
  const html = buildActivationEmail(name, code, durationDays, isNew);

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error("Activation email send error:", e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!requireAdminSession()) return unauthorizedResponse();

  const { id } = params;
  const body = await req.json();
  const supabase = freshClient();

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.streampay_invoice_id !== undefined) updates.streampay_invoice_id = body.streampay_invoice_id;
  if (body.streampay_payment_id !== undefined) updates.streampay_payment_id = body.streampay_payment_id;
  if (body.status === "paid" && !body.paid_at) updates.paid_at = new Date().toISOString();

  const { error } = await supabase.from("store_orders").update(updates).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Auto-activate account and send email when order is confirmed as paid
  if (body.status === "paid") {
    try {
      const result = await autoActivateOrder(supabase, id);
      if (result.email) {
        await sendActivationEmail(result.email, result.name, result.code, result.durationDays, result.isNew);
      }
      return NextResponse.json({ ok: true, activated: true, email_sent: !!result.email, is_new: result.isNew });
    } catch (activationErr) {
      console.error("Auto-activation error:", activationErr);
      // Don't fail the whole request — order is already marked paid
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { id } = params;
  const supabase = freshClient();
  const { error } = await supabase.from("store_orders").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
