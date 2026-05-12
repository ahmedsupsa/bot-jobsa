import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

const GATEWAY_AR: Record<string, string> = {
  tamara: "تمارا",
  streampay: "StreamPay",
  bank_transfer: "تحويل بنكي",
};

function fmtDate(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

function fmtDateShort(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function fmtAmt(n: number | null): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token") || "";

  let userEmail: string | null = null;
  const headerToken = extractToken(req);
  const tokenToVerify = headerToken || queryToken;

  if (tokenToVerify) {
    const payload = await verifyToken(tokenToVerify);
    if (payload) {
      const supabase = freshClient();
      const { data } = await supabase.from("users").select("email").eq("id", payload.user_id).maybeSingle();
      userEmail = data?.email || null;
    }
  }

  if (!userEmail) {
    return new NextResponse("غير مخوّل", { status: 401 });
  }

  const supabase = freshClient();
  const { data: order } = await supabase
    .from("store_orders")
    .select("id, status, amount, paid_at, created_at, payment_gateway, user_name, user_email, user_phone, store_products(name, duration_days)")
    .eq("id", id)
    .maybeSingle();

  if (!order) return new NextResponse("الطلب غير موجود", { status: 404 });
  if ((order.user_email || "").toLowerCase() !== (userEmail || "").toLowerCase()) {
    return new NextResponse("الطلب لا يخصك", { status: 403 });
  }
  if (order.status !== "paid") {
    return new NextResponse("الفاتورة غير متاحة — الطلب غير مدفوع", { status: 400 });
  }

  const paidAt = order.paid_at ? new Date(order.paid_at) : new Date();
  const durationDays: number = (order.store_products as any)?.duration_days ?? 30;
  const subStart = paidAt;
  const subEnd = new Date(paidAt.getTime() + durationDays * 86400000);
  const year = paidAt.getFullYear();
  const invNum = `JBT-${year}-${order.id.slice(0, 8).toUpperCase()}`;
  const productName = (order.store_products as any)?.name || "اشتراك Jobbots";
  const gatewayAr = GATEWAY_AR[order.payment_gateway || ""] || order.payment_gateway || "—";
  const amtFmt = fmtAmt(order.amount);

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>فاتورة ${invNum} — Jobbots</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #f0f0f0;
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    direction: rtl;
    padding: 24px 16px 40px;
    color: #111;
  }
  .print-bar {
    max-width: 820px;
    margin: 0 auto 18px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .btn-print {
    border: none; border-radius: 10px;
    padding: 10px 22px; font-size: 14px;
    cursor: pointer; font-family: inherit;
    font-weight: 700; white-space: nowrap;
    background: #18181b; color: #fff;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .btn-print:hover { background: #333; }
  .btn-back {
    border: 1px solid #d4d4d8; border-radius: 10px;
    padding: 10px 18px; font-size: 13px;
    cursor: pointer; font-family: inherit;
    font-weight: 600; background: #fff; color: #555;
    text-decoration: none; display: inline-flex; align-items: center; gap: 6px;
  }
  .btn-back:hover { background: #f4f4f5; }
  .spacer { flex: 1; }

  /* ── Invoice page ── */
  .invoice-page {
    width: 820px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 40px rgba(0,0,0,0.12);
    margin: 0 auto;
    overflow: hidden;
  }

  /* ── Header ── */
  .inv-header {
    background: #0a0a0a;
    padding: 40px 52px 36px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    position: relative;
  }
  .inv-header::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: repeating-linear-gradient(90deg, #fff 0px, #fff 8px, transparent 8px, transparent 14px);
    opacity: 0.15;
  }
  .brand-logo {
    width: 56px; height: 56px;
    background: #fff; border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; font-weight: 900; color: #0a0a0a;
    letter-spacing: -1px; flex-shrink: 0;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.1);
  }
  .brand-info { display: flex; align-items: center; gap: 16px; }
  .brand-name { color: #fff; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
  .brand-tagline { color: #71717a; font-size: 12px; margin-top: 3px; }
  .inv-title-block { text-align: left; }
  .inv-word { color: #fff; font-size: 36px; font-weight: 900; letter-spacing: 2px; opacity: 0.9; }
  .inv-num-header { color: #52525b; font-size: 13px; margin-top: 6px; direction: ltr; letter-spacing: 0.5px; }

  /* ── Diagonal corner accent ── */
  .corner-accent {
    position: absolute;
    top: 0; left: 0;
    width: 160px; height: 160px;
    overflow: hidden;
    pointer-events: none;
  }
  .corner-accent::before {
    content: '';
    position: absolute;
    top: -80px; left: -80px;
    width: 160px; height: 160px;
    background: rgba(255,255,255,0.03);
    border-radius: 50%;
  }

  /* ── Status bar ── */
  .status-bar {
    background: #18181b;
    padding: 14px 52px;
    display: flex;
    gap: 40px;
    align-items: center;
  }
  .status-item { display: flex; flex-direction: column; gap: 2px; }
  .status-label { font-size: 9px; color: #52525b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .status-value { font-size: 13px; font-weight: 700; color: #a1a1aa; }
  .status-value.paid { color: #4ade80; }

  /* ── Body ── */
  .inv-body { padding: 44px 52px 40px; display: flex; flex-direction: column; gap: 32px; }

  /* ── Section header ── */
  .section-label {
    font-size: 9px; font-weight: 800;
    color: #a1a1aa; text-transform: uppercase;
    letter-spacing: 1.5px; margin-bottom: 12px;
    display: flex; align-items: center; gap: 8px;
  }
  .section-label::after {
    content: ''; flex: 1; height: 1px; background: #e4e4e7;
  }

  /* ── Parties ── */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .party-block {
    padding: 20px 24px;
    border: 1px solid #e4e4e7;
    background: #fafafa;
  }
  .party-block:first-child {
    border-radius: 14px 0 0 14px;
    border-left: none;
  }
  .party-block:last-child {
    border-radius: 0 14px 14px 0;
    text-align: left;
  }
  .party-from {
    font-size: 9px; font-weight: 800;
    color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;
    margin-bottom: 10px;
    display: flex; align-items: center; gap: 6px;
  }
  .party-from::before {
    content: '';
    width: 20px; height: 1px; background: #d4d4d8;
  }
  .party-block:last-child .party-from { flex-direction: row-reverse; }
  .party-block:last-child .party-from::before { order: 1; }
  .party-name { font-size: 17px; font-weight: 800; color: #09090b; margin-bottom: 4px; }
  .party-line { font-size: 12px; color: #71717a; line-height: 1.7; }
  .party-line.ltr { direction: ltr; text-align: left; }
  .party-block:last-child .party-line.ltr { text-align: left; }

  /* ── Dates grid ── */
  .dates-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: #e4e4e7;
    border: 1px solid #e4e4e7;
    border-radius: 14px;
    overflow: hidden;
  }
  .date-cell {
    background: #fff;
    padding: 18px 20px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .date-cell-label {
    font-size: 9px; color: #a1a1aa;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
  }
  .date-cell-value { font-size: 13px; font-weight: 800; color: #09090b; }

  /* ── Items table ── */
  .items-wrap {
    border: 1px solid #e4e4e7;
    border-radius: 14px;
    overflow: hidden;
  }
  .items-head {
    background: #09090b;
    display: grid;
    grid-template-columns: 1fr 100px 120px;
    padding: 12px 20px;
  }
  .items-head span {
    font-size: 10px; font-weight: 700;
    color: #71717a; text-transform: uppercase; letter-spacing: 0.8px;
  }
  .items-head span:nth-child(2) { text-align: center; }
  .items-head span:nth-child(3) { text-align: left; }
  .items-row {
    display: grid;
    grid-template-columns: 1fr 100px 120px;
    padding: 20px;
    background: #fff;
    border-top: 1px solid #f0f0f0;
    align-items: center;
  }
  .item-name { font-size: 15px; font-weight: 800; color: #09090b; }
  .item-desc { font-size: 11px; color: #71717a; margin-top: 4px; line-height: 1.5; }
  .item-qty { text-align: center; font-size: 14px; font-weight: 700; color: #52525b; }
  .item-price { text-align: left; font-size: 16px; font-weight: 900; color: #09090b; }

  /* ── Totals ── */
  .totals-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0;
  }
  .total-line {
    width: 260px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #f0f0f0;
    font-size: 13px;
    color: #71717a;
  }
  .total-line:last-child { border-bottom: none; }
  .total-final {
    width: 260px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #09090b;
    border-radius: 12px;
    margin-top: 12px;
    font-size: 16px;
    font-weight: 900;
    color: #fff;
  }

  /* ── Subscription period ── */
  .sub-period {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1px solid #e4e4e7;
    border-radius: 14px;
    overflow: hidden;
  }
  .sub-period-cell {
    flex: 1;
    padding: 18px 24px;
    background: #fafafa;
  }
  .sub-period-cell:first-child { border-left: 1px solid #e4e4e7; }
  .sub-period-arrow {
    padding: 0 16px;
    color: #d4d4d8;
    font-size: 20px;
    display: flex; align-items: center;
    background: #fafafa;
  }
  .sub-period-label { font-size: 10px; color: #a1a1aa; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
  .sub-period-date { font-size: 15px; font-weight: 800; color: #09090b; }
  .sub-period-days {
    font-size: 11px; color: #71717a; margin-top: 4px;
    background: #f0f0f0; display: inline-block;
    padding: 2px 10px; border-radius: 100;
  }

  /* ── Confirmation badge ── */
  .confirm-box {
    display: flex; align-items: flex-start; gap: 16px;
    padding: 20px 24px;
    background: #09090b;
    border-radius: 14px;
    color: #fff;
  }
  .confirm-icon {
    width: 40px; height: 40px; border-radius: 10px;
    background: rgba(255,255,255,0.1);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; flex-shrink: 0;
  }
  .confirm-title { font-size: 14px; font-weight: 800; margin-bottom: 6px; }
  .confirm-line { font-size: 12px; color: #71717a; line-height: 1.7; }
  .confirm-line strong { color: #a1a1aa; }

  /* ── Footer ── */
  .inv-footer {
    background: #fafafa;
    border-top: 1px solid #f0f0f0;
    padding: 20px 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .footer-brand { font-size: 13px; font-weight: 800; color: #09090b; }
  .footer-sub { font-size: 11px; color: #a1a1aa; margin-top: 2px; }
  .footer-num { font-size: 11px; color: #a1a1aa; text-align: left; direction: ltr; }
  .footer-powered {
    font-size: 10px; color: #d4d4d8; margin-top: 2px; text-align: left;
  }

  @page { size: A4; margin: 0; }
  @media print {
    body { background: #fff; padding: 0; }
    .print-bar { display: none; }
    .invoice-page {
      width: 100%; box-shadow: none; border-radius: 0;
    }
  }
  @media (max-width: 860px) {
    body { padding: 12px 4px 32px; }
    .invoice-page { width: 100%; }
    .print-bar { max-width: 100%; }
    .inv-header { padding: 28px 24px; }
    .status-bar { padding: 12px 24px; gap: 20px; flex-wrap: wrap; }
    .inv-body { padding: 28px 24px; }
    .inv-footer { padding: 16px 24px; }
    .items-head, .items-row { grid-template-columns: 1fr 60px 90px; }
    .dates-grid { grid-template-columns: 1fr 1fr; }
    .parties { grid-template-columns: 1fr; }
    .party-block:first-child { border-radius: 14px 14px 0 0; border-left: 1px solid #e4e4e7; border-bottom: none; }
    .party-block:last-child { border-radius: 0 0 14px 14px; text-align: right; }
    .party-block:last-child .party-from { flex-direction: row; }
    .party-block:last-child .party-from::before { order: 0; }
    .party-block:last-child .party-line.ltr { text-align: right; direction: rtl; }
  }
</style>
</head>
<body>

<div class="print-bar">
  <a class="btn-back" href="javascript:history.back()">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
    رجوع
  </a>
  <span class="spacer"></span>
  <button class="btn-print" onclick="window.print()">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    تحميل PDF
  </button>
</div>

<div class="invoice-page">

  <!-- ── Header ── -->
  <div class="inv-header">
    <div class="brand-info">
      <div class="brand-logo">J</div>
      <div>
        <div class="brand-name">Jobbots</div>
        <div class="brand-tagline">منصة التقديم التلقائي للوظائف</div>
      </div>
    </div>
    <div class="inv-title-block">
      <div class="inv-word">INVOICE</div>
      <div class="inv-num-header">${invNum}</div>
    </div>
  </div>

  <!-- ── Status bar ── -->
  <div class="status-bar">
    <div class="status-item">
      <div class="status-label">رقم الفاتورة</div>
      <div class="status-value">${invNum}</div>
    </div>
    <div class="status-item">
      <div class="status-label">تاريخ الإصدار</div>
      <div class="status-value">${fmtDateShort(paidAt)}</div>
    </div>
    <div class="status-item">
      <div class="status-label">طريقة الدفع</div>
      <div class="status-value">${gatewayAr}</div>
    </div>
    <div class="status-item">
      <div class="status-label">الحالة</div>
      <div class="status-value paid">✓ مدفوعة</div>
    </div>
  </div>

  <!-- ── Body ── -->
  <div class="inv-body">

    <!-- Parties -->
    <div>
      <div class="section-label">أطراف العقد</div>
      <div class="parties">
        <div class="party-block">
          <div class="party-from">من</div>
          <div class="party-name">Jobbots</div>
          <div class="party-line">المملكة العربية السعودية</div>
          <div class="party-line">billing@jobbots.org</div>
          <div class="party-line">jobbots.org</div>
        </div>
        <div class="party-block">
          <div class="party-from">إلى</div>
          <div class="party-name">${order.user_name || "—"}</div>
          ${order.user_email ? `<div class="party-line ltr">${order.user_email}</div>` : ""}
          ${order.user_phone ? `<div class="party-line">${order.user_phone}</div>` : ""}
        </div>
      </div>
    </div>

    <!-- Dates -->
    <div>
      <div class="section-label">تفاصيل الفاتورة</div>
      <div class="dates-grid">
        <div class="date-cell">
          <div class="date-cell-label">تاريخ الدفع</div>
          <div class="date-cell-value">${fmtDate(paidAt)}</div>
        </div>
        <div class="date-cell">
          <div class="date-cell-label">بداية الاشتراك</div>
          <div class="date-cell-value">${fmtDate(subStart)}</div>
        </div>
        <div class="date-cell">
          <div class="date-cell-label">نهاية الاشتراك</div>
          <div class="date-cell-value">${fmtDate(subEnd)}</div>
        </div>
        <div class="date-cell">
          <div class="date-cell-label">مدة الاشتراك</div>
          <div class="date-cell-value">${durationDays} يوم</div>
        </div>
      </div>
    </div>

    <!-- Items -->
    <div>
      <div class="section-label">الخدمات</div>
      <div class="items-wrap">
        <div class="items-head">
          <span>الخدمة / المنتج</span>
          <span>الكمية</span>
          <span>المبلغ</span>
        </div>
        <div class="items-row">
          <div>
            <div class="item-name">${productName}</div>
            <div class="item-desc">اشتراك في منصة Jobbots — التقديم التلقائي على الوظائف بالذكاء الاصطناعي</div>
          </div>
          <div class="item-qty">1</div>
          <div class="item-price">${amtFmt} ر.س</div>
        </div>
      </div>
    </div>

    <!-- Totals -->
    <div class="totals-wrap">
      <div class="total-line">
        <span>المجموع الفرعي</span>
        <span>${amtFmt} ر.س</span>
      </div>
      <div class="total-line">
        <span>ضريبة القيمة المضافة</span>
        <span style="color:#a1a1aa;">غير مطبّقة</span>
      </div>
      <div class="total-final">
        <span>الإجمالي</span>
        <span>${amtFmt} ر.س</span>
      </div>
    </div>

    <!-- Confirmation -->
    <div class="confirm-box">
      <div class="confirm-icon">✓</div>
      <div>
        <div class="confirm-title">تم استلام الدفعة وتفعيل الاشتراك</div>
        <div class="confirm-line">
          تم تسجيل دفعتك عبر <strong>${gatewayAr}</strong> وتفعيل اشتراكك في منصة Jobbots.
        </div>
        <div class="confirm-line" style="margin-top:4px;">
          للاستفسار والدعم: <strong>billing@jobbots.org</strong>
        </div>
      </div>
    </div>

  </div>

  <!-- ── Footer ── -->
  <div class="inv-footer">
    <div>
      <div class="footer-brand">Jobbots — منصة التقديم الذكي</div>
      <div class="footer-sub">jobbots.org · billing@jobbots.org · المملكة العربية السعودية</div>
    </div>
    <div>
      <div class="footer-num">${invNum}</div>
      <div class="footer-powered">هذه الفاتورة صادرة آلياً من منصة Jobbots</div>
    </div>
  </div>

</div>

<script>
document.title = 'فاتورة ${invNum} — Jobbots';
</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
