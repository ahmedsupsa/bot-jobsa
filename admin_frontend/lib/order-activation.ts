import { createClient, SupabaseClient } from "@supabase/supabase-js";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || "Jobbots";

export function freshSupabase(): SupabaseClient {
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
  supabase: SupabaseClient,
  durationDays: number
): Promise<{ id: string; code: string } | null> {
  for (let i = 0; i < 10; i++) {
    const candidate = genCode();
    const { data: existing } = await supabase
      .from("activation_codes").select("code").eq("code", candidate).maybeSingle();
    if (!existing) {
      const { data } = await supabase
        .from("activation_codes")
        .insert({ code: candidate, subscription_days: durationDays, used: false, created_at: new Date().toISOString() })
        .select("id, code").single();
      if (data) return { id: data.id, code: data.code };
    }
  }
  return null;
}

type ExistingUser = { id: string; subscription_ends_at: string | null; activation_code_id: string | null };

async function findExistingUser(
  supabase: SupabaseClient,
  userId: string | null,
  email: string
): Promise<ExistingUser | null> {
  const cols = "id, subscription_ends_at, activation_code_id";
  if (userId) {
    const { data } = await supabase.from("users").select(cols).eq("id", userId).maybeSingle();
    if (data) return data as ExistingUser;
  }
  if (!email) return null;
  const { data: byEmail } = await supabase.from("users").select(cols).eq("email", email).maybeSingle();
  if (byEmail) return byEmail as ExistingUser;
  const { data: bySetting } = await supabase
    .from("user_settings").select("user_id").eq("email", email).maybeSingle();
  if (bySetting?.user_id) {
    const { data: u } = await supabase.from("users").select(cols).eq("id", bySetting.user_id).maybeSingle();
    if (u) return u as ExistingUser;
  }
  return null;
}

export type ActivationResult = {
  code: string | null; email: string | null; name: string;
  durationDays: number; isNew: boolean; newEndDate?: Date;
  userId?: string;
};

export async function autoActivateOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<ActivationResult> {
  const { data: order } = await supabase
    .from("store_orders")
    .select("*, store_products(duration_days)")
    .eq("id", orderId)
    .single();

  if (!order) return { code: null, email: null, name: "مستخدم", durationDays: 30, isNew: false };

  const rawDays =
    order.store_products?.duration_days ??
    (Array.isArray(order.store_products) ? order.store_products[0]?.duration_days : undefined) ??
    30;
  const durationDays = Number(rawDays) || 30;

  const email = order.user_email?.trim().toLowerCase() || "";
  const name = order.user_name?.trim() || "مستخدم";
  const phone = order.user_phone?.trim() || "غير محدد";

  const existingUser = await findExistingUser(supabase, order.user_id || null, email);

  if (existingUser) {
    const base =
      existingUser.subscription_ends_at && new Date(existingUser.subscription_ends_at) > new Date()
        ? new Date(existingUser.subscription_ends_at)
        : new Date();
    base.setDate(base.getDate() + durationDays);

    await supabase.from("users").update({ subscription_ends_at: base.toISOString() }).eq("id", existingUser.id);

    let notifyEmail = email;
    if (!notifyEmail) {
      const { data: s } = await supabase
        .from("user_settings").select("email").eq("user_id", existingUser.id).maybeSingle();
      notifyEmail = s?.email || "";
    }

    let oldCode: string | null = null;
    if (existingUser.activation_code_id) {
      const { data: codeRow } = await supabase
        .from("activation_codes").select("code").eq("id", existingUser.activation_code_id).maybeSingle();
      oldCode = codeRow?.code || null;
    }

    return { code: oldCode, email: notifyEmail || email, name, durationDays, isNew: false, newEndDate: base, userId: existingUser.id };
  }

  if (!email) return { code: null, email: null, name, durationDays, isNew: false };

  const ends_at = new Date(Date.now() + durationDays * 86400000).toISOString();
  const codeEntry = await createAndReserveCode(supabase, durationDays);

  const insertData: Record<string, unknown> = {
    full_name: name, phone, email, subscription_ends_at: ends_at,
    ...(codeEntry ? { activation_code_id: codeEntry.id } : {}),
  };

  let { data: userRows, error: userErr } = await supabase.from("users").insert(insertData).select("id");

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

  try { await supabase.from("user_settings").insert({ user_id: userId, email }); } catch {}

  return { code: codeEntry?.code || null, email, name, durationDays, isNew: true, userId };
}

export function buildActivationEmail(
  name: string, code: string | null, durationDays: number,
  isNew: boolean, newEndDate?: Date
): string {
  const addedLabel = durationDays >= 365 ? "سنة كاملة" : durationDays >= 180 ? "6 أشهر" : durationDays >= 90 ? "3 أشهر" : durationDays >= 30 ? "شهر" : `${durationDays} يوم`;
  const newEndStr = newEndDate
    ? newEndDate.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
    : "";
  const portalUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.jobbots.org";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Tajawal',Tahoma,system-ui,sans-serif;direction:rtl;">
  <div style="max-width:560px;margin:40px auto;padding:0 16px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#fff;padding:10px 20px;border-radius:14px;">
        <span style="font-size:20px;font-weight:900;color:#0a0a0a;letter-spacing:-0.5px;">Jobbots</span>
      </div>
    </div>
    <div style="background:#111;border:1px solid #1f1f1f;border-radius:20px;padding:36px 32px;">
      <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 8px;">
        ${isNew ? "🎉 تم تفعيل اشتراكك!" : "✅ تم تجديد اشتراكك!"}
      </h1>
      <p style="color:#aaa;font-size:14px;margin:0 0 28px;line-height:1.8;">
        ${isNew
          ? `مرحباً ${name}، تم تأكيد دفعتك وتفعيل اشتراكك في Jobbots.`
          : `مرحباً ${name}، تم تأكيد دفعتك وتجديد اشتراكك في Jobbots.`
        }
      </p>
      <div style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <div style="color:#777;font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">
          ${isNew ? "مدة الاشتراك" : "المدة المُضافة"}
        </div>
        <div style="color:#a78bfa;font-size:20px;font-weight:900;">+ ${addedLabel}</div>
        ${!isNew && newEndStr ? `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #1f1f1f;">
          <div style="color:#777;font-size:11px;margin-bottom:4px;">تاريخ انتهاء الاشتراك الجديد</div>
          <div style="color:#e5e7eb;font-size:15px;font-weight:700;">${newEndStr}</div>
        </div>` : ""}
      </div>
      ${code ? `
      <div style="background:linear-gradient(135deg,rgba(167,139,250,0.1),rgba(109,40,217,0.06));border:1px solid rgba(167,139,250,0.25);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
        <div style="color:#a78bfa;font-size:11px;font-weight:600;margin-bottom:10px;letter-spacing:1px;text-transform:uppercase;">${isNew ? "كود التفعيل الخاص بك" : "كودك للدخول"}</div>
        <div style="color:#fff;font-size:28px;font-weight:900;letter-spacing:4px;font-family:monospace;">${code}</div>
        <div style="color:#666;font-size:11px;margin-top:8px;">${isNew ? "استخدم هذا الكود لتفعيل حسابك" : "نفس الكود الذي تستخدمه للدخول"}</div>
      </div>` : ""}
      <a href="${portalUrl}/portal" style="display:block;background:#fff;color:#0a0a0a;text-align:center;padding:14px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;margin-bottom:20px;">
        الدخول إلى لوحة التحكم ←
      </a>
      <p style="color:#555;font-size:12px;line-height:1.8;margin:0;text-align:center;">
        إذا واجهت أي مشكلة تواصل معنا على
        <a href="mailto:support@jobbots.org" style="color:#a78bfa;text-decoration:none;">support@jobbots.org</a>
      </p>
    </div>
    <p style="text-align:center;color:#333;font-size:11px;margin-top:20px;">
      Jobbots — منصة التقديم التلقائي على الوظائف
    </p>
  </div>
</body>
</html>`;
}

export async function sendActivationEmail(
  to: string, name: string, code: string | null,
  durationDays: number, isNew: boolean, newEndDate?: Date
): Promise<boolean> {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !to) {
    console.warn("sendActivationEmail skipped — email configuration incomplete");
    return false;
  }
  const subject = isNew ? "🎉 تم تفعيل اشتراكك في Jobbots" : "✅ تم تجديد اشتراكك في Jobbots";
  const html = buildActivationEmail(name, code, durationDays, isNew, newEndDate);
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
        to: [to], subject, html,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error("Resend error:", r.status, txt);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Activation email send error:", e);
    return false;
  }
}

export async function activateAndNotify(orderId: string): Promise<{ activated: boolean; emailSent: boolean }> {
  const supabase = freshSupabase();
  try {
    const result = await autoActivateOrder(supabase, orderId);
    if (!result.email) return { activated: !!result.email, emailSent: false };
    const sent = await sendActivationEmail(result.email, result.name, result.code, result.durationDays, result.isNew, result.newEndDate);
    return { activated: true, emailSent: sent };
  } catch (e) {
    console.error("activateAndNotify error:", e);
    return { activated: false, emailSent: false };
  }
}
