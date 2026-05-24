/**
 * admin-notify.ts — إشعارات البريد الإلكتروني للمسؤول عند وصول طلبات المتجر
 */

const RESEND_API_KEY   = process.env.RESEND_API_KEY   || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const RESEND_FROM_NAME  = process.env.RESEND_FROM_NAME  || "Jobbots";
const ADMIN_EMAIL       = "ahmedsupsa@gmail.com";

export type OrderNotifyPayload = {
  order_id: string | number;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  amount?: number;
  payment_gateway: "tamara" | "streampay" | "bank_transfer";
  paid_at?: string;
};

function gatewayLabel(gw: string): string {
  if (gw === "tamara")       return "تمارا";
  if (gw === "streampay")    return "ستريم باي (StreamPay)";
  if (gw === "bank_transfer") return "تحويل بنكي";
  return gw;
}

function fmtDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("ar-SA", {
    timeZone: "Asia/Riyadh",
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function buildHtml(p: OrderNotifyPayload, subject: string): string {
  const gwLabel   = gatewayLabel(p.payment_gateway);
  const dateStr   = fmtDate(p.paid_at);
  const amount    = p.amount ? `${p.amount} ريال` : "—";
  const isBankTransfer = p.payment_gateway === "bank_transfer";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Thmanyah Sans','Tajawal',Tahoma,sans-serif;direction:rtl;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:#09090b;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Jobbots — لوحة التحكم</h1>
          <p style="margin:6px 0 0;color:#a1a1aa;font-size:13px;">${subject}</p>
        </td>
      </tr>

      <!-- Status badge -->
      <tr>
        <td style="padding:24px 32px 0;">
          <div style="display:inline-block;background:${isBankTransfer ? "#fffbeb" : "#f0fdf4"};border:1px solid ${isBankTransfer ? "#fde68a" : "#bbf7d0"};border-radius:100px;padding:6px 16px;font-size:13px;font-weight:700;color:${isBankTransfer ? "#92400e" : "#166534"};">
            ${isBankTransfer ? "📎 إيصال تحويل بنكي مرفوع" : "✅ دفع مكتمل"}
          </div>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:20px 32px 32px;">
          <p style="margin:0 0 20px;color:#09090b;font-size:15px;line-height:1.8;">
            ${isBankTransfer
              ? "تم رفع إيصال تحويل بنكي لطلب جديد في المتجر — يرجى المراجعة والتأكيد."
              : "تم استلام طلب جديد مكتمل الدفع داخل المتجر."}
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
            ${row("نوع الدفع",    `<strong>${gwLabel}</strong>`)}
            ${row("رقم الطلب",   String(p.order_id))}
            ${row("اسم العميل",  p.user_name  || "—")}
            ${row("البريد",      p.user_email || "—")}
            ${row("الجوال",      p.user_phone || "—")}
            ${row("المبلغ",      amount)}
            ${row("وقت الطلب",   dateStr)}
          </table>

          <div style="margin-top:24px;text-align:center;">
            <a href="https://jobbots.org/admin" style="display:inline-block;background:#09090b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;">
              فتح لوحة التحكم
            </a>
          </div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f4f4f5;padding:16px 32px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;color:#71717a;font-size:12px;text-align:center;">
            هذا إشعار تلقائي من منصة Jobbots — لا تردّ على هذه الرسالة
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 16px;background:#f9f9f9;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px;font-weight:600;white-space:nowrap;width:120px;">${label}</td>
    <td style="padding:10px 16px;border-bottom:1px solid #e4e4e7;color:#09090b;font-size:13px;">${value}</td>
  </tr>`;
}

export async function sendAdminOrderNotification(p: OrderNotifyPayload): Promise<boolean> {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.warn("[admin-notify] RESEND غير مضبوط — تخطي إشعار المسؤول");
    return false;
  }

  const isBankTransfer = p.payment_gateway === "bank_transfer";
  const subject = isBankTransfer
    ? `📎 إيصال تحويل بنكي — طلب #${p.order_id}`
    : `✅ دفع مكتمل — طلب #${p.order_id} عبر ${gatewayLabel(p.payment_gateway)}`;

  const html = buildHtml(p, subject);

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
        to:   [ADMIN_EMAIL],
        subject,
        html,
      }),
    });

    if (r.ok) {
      console.log(`[admin-notify] ✅ إشعار أُرسل للمسؤول — order #${p.order_id}`);
      return true;
    }

    const err = await r.json().catch(() => ({}));
    console.error(`[admin-notify] ❌ Resend خطأ ${r.status}:`, err);
    return false;
  } catch (e) {
    console.error("[admin-notify] ❌ استثناء:", e);
    return false;
  }
}
