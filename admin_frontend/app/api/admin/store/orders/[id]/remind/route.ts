import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

const RESEND_API_KEY    = process.env.RESEND_API_KEY    || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const RESEND_FROM_NAME  = process.env.RESEND_FROM_NAME  || "Jobbots";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

function buildReminderEmail(name: string, amount: number, productName: string, createdAt: string): string {
  const portalUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.jobbots.org";
  const dateStr = new Date(createdAt).toLocaleDateString("ar-SA", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

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

      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.25);border-radius:16px;font-size:26px;margin-bottom:16px;">⏳</div>
        <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 8px;">في انتظار تأكيد التحويل</h1>
        <p style="color:#aaa;font-size:14px;margin:0;line-height:1.8;">
          مرحباً ${name}،<br>
          لاحظنا أن طلبك لا يزال بانتظار إيصال التحويل البنكي.
        </p>
      </div>

      <!-- Order details -->
      <div style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <div style="color:#777;font-size:11px;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">تفاصيل الطلب</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="color:#aaa;font-size:13px;">الباقة</span>
          <span style="color:#fff;font-size:13px;font-weight:700;">${productName}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="color:#aaa;font-size:13px;">المبلغ</span>
          <span style="color:#a78bfa;font-size:15px;font-weight:900;">${amount.toFixed(2)} ر.س</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#aaa;font-size:13px;">تاريخ الطلب</span>
          <span style="color:#e5e7eb;font-size:13px;">${dateStr}</span>
        </div>
      </div>

      <!-- Instructions -->
      <div style="background:rgba(234,179,8,0.05);border:1px solid rgba(234,179,8,0.15);border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <div style="color:#eab308;font-size:12px;font-weight:700;margin-bottom:8px;">📋 خطوات إتمام الطلب</div>
        <ol style="color:#aaa;font-size:13px;line-height:2;margin:0;padding-right:16px;">
          <li>حوّل المبلغ على الحساب البنكي المخصص</li>
          <li>خذ صورة للإيصال أو screenshot</li>
          <li>ارفع الإيصال من خلال الرابط أدناه</li>
        </ol>
      </div>

      <!-- CTA -->
      <a href="${portalUrl}/store" style="display:block;background:#eab308;color:#0a0a0a;text-align:center;padding:14px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;margin-bottom:20px;">
        ارفع إيصال التحويل ←
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

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const _denied_ = enforcePermission("store"); if (_denied_) return _denied_;

  const { id } = params;
  const supabase = freshClient();

  const { data: order, error } = await supabase
    .from("store_orders")
    .select("*, store_products(name, price, duration_days)")
    .eq("id", id)
    .single();

  if (error || !order) return NextResponse.json({ ok: false, error: "الطلب غير موجود" }, { status: 404 });

  const email = order.user_email?.trim();
  if (!email) return NextResponse.json({ ok: false, error: "لا يوجد بريد إلكتروني للعميل" }, { status: 400 });

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL)
    return NextResponse.json({ ok: false, error: "إعدادات البريد غير مكتملة" }, { status: 500 });

  const name = order.user_name?.trim() || "العميل";
  const amount = Number(order.amount || 0);
  const productName = (Array.isArray(order.store_products)
    ? order.store_products[0]?.name
    : order.store_products?.name) || "اشتراك Jobbots";

  const html = buildReminderEmail(name, amount, productName, order.created_at);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
      to: [email],
      subject: "⏳ في انتظار إيصال التحويل — Jobbots",
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("Reminder email error:", err);
    return NextResponse.json({ ok: false, error: "فشل إرسال البريد" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent_to: email });
}
