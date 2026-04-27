import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

const COMMISSION_RATE = 0.10;

// Tamara fees
const TAMARA_VARIABLE_RATE = 0.0699;
const TAMARA_FIXED_FEE = 1.5;
const TAMARA_VAT_RATE = 0.15;
function tamaraFee(amount: number) {
  const variable = amount * TAMARA_VARIABLE_RATE;
  const fixed = TAMARA_FIXED_FEE;
  const subtotal = variable + fixed;
  const vat = subtotal * TAMARA_VAT_RATE;
  return { variable, fixed, vat, total: subtotal + vat, net: amount - (subtotal + vat) };
}

// StreamPay fees
const SP_COMMISSION_RATE = 0.008;
const SP_MADA_RATE = 0.01;
const SP_VISA_RATE = 0.025;
const SP_FIXED_FEE = 1.0;
function spFee(amount: number) {
  const madaGateway = amount * SP_MADA_RATE + SP_FIXED_FEE;
  const madaComm = amount * SP_COMMISSION_RATE;
  const madaTotal = madaGateway + madaComm;
  const visaGateway = amount * SP_VISA_RATE + SP_FIXED_FEE;
  const visaComm = amount * SP_COMMISSION_RATE;
  const visaTotal = visaGateway + visaComm;
  return { madaTotal, madaNet: amount - madaTotal, visaTotal, visaNet: amount - visaTotal };
}

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

const COLORS = {
  brand: "FF1F2937",
  accent: "FF6D28D9",
  green: "FF059669",
  greenLight: "FFD1FAE5",
  red: "FFDC2626",
  redLight: "FFFEE2E2",
  amber: "FFD97706",
  amberLight: "FFFEF3C7",
  blue: "FF2563EB",
  blueLight: "FFDBEAFE",
  gray: "FF6B7280",
  grayLight: "FFF3F4F6",
  white: "FFFFFFFF",
  border: "FFE5E7EB",
};

function fmt(n: number): string {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setBorder(cell: ExcelJS.Cell, color: string = COLORS.border) {
  cell.border = {
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}

function fillCell(cell: ExcelJS.Cell, color: string) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
}

function addBrandHeader(ws: ExcelJS.Worksheet, title: string, subtitle: string, columns: number) {
  ws.mergeCells(1, 1, 1, columns);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = "جوبوتس — التقرير المالي";
  titleCell.font = { name: "Calibri", size: 22, bold: true, color: { argb: COLORS.white } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
  fillCell(titleCell, COLORS.brand);
  ws.getRow(1).height = 38;

  ws.mergeCells(2, 1, 2, columns);
  const subCell = ws.getCell(2, 1);
  subCell.value = title;
  subCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: COLORS.white } };
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
  fillCell(subCell, COLORS.accent);
  ws.getRow(2).height = 26;

  ws.mergeCells(3, 1, 3, columns);
  const descCell = ws.getCell(3, 1);
  descCell.value = subtitle;
  descCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: COLORS.gray } };
  descCell.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
  ws.getRow(3).height = 20;

  ws.getRow(4).height = 8;
}

function tableHeader(ws: ExcelJS.Worksheet, row: number, headers: string[]) {
  headers.forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: COLORS.white }, size: 11 };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    fillCell(c, COLORS.brand);
    setBorder(c);
  });
  ws.getRow(row).height = 28;
}

export async function GET() {
  const _denied_ = enforcePermission("finance"); if (_denied_) return _denied_;
  const supabase = freshClient();

  const { data: rawOrders } = await supabase
    .from("store_orders")
    .select("id, user_name, user_email, amount, status, ref_code, payment_gateway, created_at, paid_at, store_products(name, duration_days)")
    .order("created_at", { ascending: false });

  const all = rawOrders || [];
  const paid = all.filter((o: any) => o.status === "paid");

  const directOrders = paid.filter((o: any) => !o.ref_code);
  const affiliateOrders = paid.filter((o: any) => !!o.ref_code);

  // Referrals + affiliate names
  const orderIds = affiliateOrders.map((o: any) => o.id);
  let refsByOrder: Record<string, any> = {};
  let affNames: Record<string, string> = {};
  let affEmails: Record<string, string> = {};

  if (orderIds.length > 0) {
    const { data: refs } = await supabase
      .from("affiliate_referrals")
      .select("order_id, commission, status, affiliate_user_id, created_at")
      .in("order_id", orderIds);
    (refs || []).forEach((r: any) => { refsByOrder[r.order_id] = r; });
    const affUserIds = Array.from(new Set((refs || []).map((r: any) => r.affiliate_user_id)));
    if (affUserIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, phone")
        .in("id", affUserIds);
      (users || []).forEach((u: any) => {
        affNames[u.id] = u.full_name || "";
        affEmails[u.id] = u.phone || "";
      });
    }
  }

  // Withdrawals
  const { data: withdrawals } = await supabase
    .from("affiliate_withdrawals")
    .select("id, user_id, amount, status, method, bank_name, iban, wallet_provider, wallet_number, created_at, processed_at")
    .order("created_at", { ascending: false });

  const wList = withdrawals || [];

  // Aggregates
  const grossRevenue = paid.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);
  const directRevenue = directOrders.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);
  const affiliateRevenue = affiliateOrders.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);
  const totalCommissions = Object.values(refsByOrder).reduce((s: number, r: any) => s + Number(r.commission || 0), 0);
  const pendingCommissions = Object.values(refsByOrder).filter((r: any) => r.status === "pending").reduce((s: number, r: any) => s + Number(r.commission || 0), 0);
  const paidCommissions = Object.values(refsByOrder).filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + Number(r.commission || 0), 0);
  const netRevenue = grossRevenue - totalCommissions;
  const paidOut = wList.filter((w: any) => w.status === "paid").reduce((s: number, w: any) => s + Number(w.amount || 0), 0);
  const pendingPayout = wList.filter((w: any) => w.status === "pending").reduce((s: number, w: any) => s + Number(w.amount || 0), 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Jobbots";
  wb.created = new Date();

  // ===== SHEET 1: SUMMARY =====
  const sum = wb.addWorksheet("١. الملخص التنفيذي", {
    properties: { tabColor: { argb: COLORS.accent } },
    views: [{ showGridLines: false }],
  });
  sum.columns = [
    { width: 38 }, { width: 22 }, { width: 22 }, { width: 38 },
  ];
  addBrandHeader(sum, "الملخص التنفيذي", `تاريخ التصدير: ${new Date().toUTCString()}  •  العملة: ر.س  •  نسبة العمولة: ${(COMMISSION_RATE * 100).toFixed(0)}%`, 4);

  let r = 5;
  // Section heading
  sum.mergeCells(r, 1, r, 4);
  let sec = sum.getCell(r, 1);
  sec.value = "تفصيل الإيرادات";
  sec.font = { bold: true, size: 12, color: { argb: COLORS.white } };
  fillCell(sec, COLORS.gray);
  sec.alignment = { vertical: "middle", indent: 1 };
  sum.getRow(r).height = 22;
  r++;

  const summaryRows: [string, number, string, string][] = [
    ["إجمالي المبيعات (كل الطلبات المدفوعة)", grossRevenue, "مجموع مبالغ جميع الطلبات ذات الحالة 'paid'", COLORS.blueLight],
    ["  • المبيعات المباشرة (بدون إحالة)", directRevenue, "طلبات بدون ref_code — تُحتجز بالكامل للشركة", COLORS.greenLight],
    ["  • مبيعات المسوّقين (بإحالة)", affiliateRevenue, "طلبات بها ref_code — تخضع لعمولة 10%", COLORS.amberLight],
    ["إجمالي العمولات المستحقة", -totalCommissions, "10% من كل بيعة مسوّق، مستحقة للمسوّقين", COLORS.redLight],
    ["صافي الإيراد (أرباح الشركة)", netRevenue, "إجمالي المبيعات − العمولات = المبلغ المحتجز في جوبوتس", COLORS.greenLight],
  ];

  summaryRows.forEach(([label, value, note, bg]) => {
    const cLabel = sum.getCell(r, 1);
    const cVal = sum.getCell(r, 2);
    const cCur = sum.getCell(r, 3);
    const cNote = sum.getCell(r, 4);
    cLabel.value = label;
    cLabel.font = { size: 11, bold: label.includes("NET") || label.includes("Gross") };
    cLabel.alignment = { vertical: "middle", indent: 1 };
    cVal.value = Number(value.toFixed(2));
    cVal.numFmt = "#,##0.00;[Red]-#,##0.00";
    cVal.alignment = { horizontal: "right" };
    cVal.font = { bold: true, size: 11, color: { argb: value < 0 ? COLORS.red : COLORS.brand } };
    cCur.value = "SAR";
    cCur.alignment = { horizontal: "center" };
    cCur.font = { color: { argb: COLORS.gray } };
    cNote.value = note;
    cNote.font = { size: 10, italic: true, color: { argb: COLORS.gray } };
    cNote.alignment = { wrapText: true, vertical: "middle" };
    [cLabel, cVal, cCur, cNote].forEach(c => { fillCell(c, bg); setBorder(c); });
    sum.getRow(r).height = 24;
    r++;
  });

  r++;
  sum.mergeCells(r, 1, r, 4);
  sec = sum.getCell(r, 1);
  sec.value = "التدفق النقدي لبرنامج المسوّقين";
  sec.font = { bold: true, size: 12, color: { argb: COLORS.white } };
  fillCell(sec, COLORS.gray);
  sec.alignment = { vertical: "middle", indent: 1 };
  sum.getRow(r).height = 22;
  r++;

  const cashRows: [string, number, string, string][] = [
    ["العمولات المدفوعة (سحوبات مكتملة)", paidOut, "مجموع السحوبات ذات الحالة 'paid'", COLORS.greenLight],
    ["طلبات السحب المعلّقة", pendingPayout, "مسوّقون ينتظرون التحويل البنكي / المحفظة — التزام على الشركة", COLORS.amberLight],
    ["العمولات المعلّقة (لم تُسحب بعد)", pendingCommissions, "مكتسبة من المسوّقين ولم يُطلب سحبها بعد", COLORS.amberLight],
    ["العمولات المُسوّاة (مرتبطة بسحب مدفوع)", paidCommissions, "عمولات مرتبطة بسحب تمّ صرفه", COLORS.greenLight],
  ];

  cashRows.forEach(([label, value, note, bg]) => {
    const cLabel = sum.getCell(r, 1);
    const cVal = sum.getCell(r, 2);
    const cCur = sum.getCell(r, 3);
    const cNote = sum.getCell(r, 4);
    cLabel.value = label;
    cLabel.font = { size: 11 };
    cLabel.alignment = { vertical: "middle", indent: 1 };
    cVal.value = Number(value.toFixed(2));
    cVal.numFmt = "#,##0.00";
    cVal.alignment = { horizontal: "right" };
    cVal.font = { bold: true };
    cCur.value = "SAR";
    cCur.alignment = { horizontal: "center" };
    cCur.font = { color: { argb: COLORS.gray } };
    cNote.value = note;
    cNote.font = { size: 10, italic: true, color: { argb: COLORS.gray } };
    cNote.alignment = { wrapText: true, vertical: "middle" };
    [cLabel, cVal, cCur, cNote].forEach(c => { fillCell(c, bg); setBorder(c); });
    sum.getRow(r).height = 22;
    r++;
  });

  r++;
  sum.mergeCells(r, 1, r, 4);
  sec = sum.getCell(r, 1);
  sec.value = "إحصائيات الطلبات";
  sec.font = { bold: true, size: 12, color: { argb: COLORS.white } };
  fillCell(sec, COLORS.gray);
  sec.alignment = { vertical: "middle", indent: 1 };
  sum.getRow(r).height = 22;
  r++;

  const statRows: [string, string | number, string][] = [
    ["إجمالي الطلبات المدفوعة", paid.length, "عدد الطلبات ذات الحالة 'paid'"],
    ["  • طلبات مباشرة", directOrders.length, "بدون إحالة مسوّق"],
    ["  • طلبات المسوّقين", affiliateOrders.length, "بها ref_code"],
    ["طلبات معلّقة", all.filter((o: any) => o.status === "pending").length, "تنتظر تأكيد الدفع"],
    ["متوسط قيمة الطلب", `${fmt(paid.length ? grossRevenue / paid.length : 0)} ر.س`, "إجمالي المبيعات ÷ عدد الطلبات المدفوعة"],
  ];

  statRows.forEach(([label, value, note]) => {
    const cLabel = sum.getCell(r, 1);
    const cVal = sum.getCell(r, 2);
    sum.mergeCells(r, 2, r, 3);
    const cNote = sum.getCell(r, 4);
    cLabel.value = label;
    cLabel.font = { size: 11 };
    cLabel.alignment = { vertical: "middle", indent: 1 };
    cVal.value = value;
    cVal.font = { bold: true };
    cVal.alignment = { horizontal: "right" };
    cNote.value = note;
    cNote.font = { size: 10, italic: true, color: { argb: COLORS.gray } };
    [cLabel, cVal, cNote].forEach(c => { fillCell(c, COLORS.grayLight); setBorder(c); });
    sum.getRow(r).height = 22;
    r++;
  });

  r += 2;
  sum.mergeCells(r, 1, r, 4);
  const formula = sum.getCell(r, 1);
  formula.value = "💡 المعادلة:  صافي الإيراد = إجمالي المبيعات − (مبيعات المسوّقين × 10%)";
  formula.font = { italic: true, size: 11, color: { argb: COLORS.brand } };
  fillCell(formula, COLORS.blueLight);
  formula.alignment = { vertical: "middle", indent: 1 };
  sum.getRow(r).height = 24;

  // ===== SHEET 2: DIRECT SALES =====
  const ds = wb.addWorksheet("٢. المبيعات المباشرة", {
    properties: { tabColor: { argb: COLORS.green } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ds.columns = [
    { width: 6 }, { width: 30 }, { width: 30 }, { width: 24 }, { width: 14 }, { width: 18 }, { width: 18 },
  ];
  addBrandHeader(ds, "المبيعات المباشرة — محتجزة 100%", "طلبات بدون ref_code لمسوّق. المبلغ كاملاً يذهب لصافي إيراد الشركة.", 7);

  tableHeader(ds, 5, ["#", "العميل", "البريد الإلكتروني", "المنتج", "المبلغ (ر.س)", "تاريخ الدفع", "رقم الطلب"]);

  let row = 6;
  directOrders.forEach((o: any, i: number) => {
    const prod = Array.isArray(o.store_products) ? o.store_products[0] : o.store_products;
    const cells = [
      String(i + 1),
      o.user_name || "—",
      o.user_email || "—",
      prod?.name || "—",
      Number((o.amount || 0).toFixed(2)),
      o.paid_at ? new Date(o.paid_at).toISOString().slice(0, 10) : "—",
      o.id,
    ];
    cells.forEach((v, idx) => {
      const c = ds.getCell(row, idx + 1);
      c.value = v as any;
      c.font = { size: 10 };
      c.alignment = { vertical: "middle", horizontal: idx === 4 ? "right" : idx === 0 ? "center" : "left", indent: idx === 1 || idx === 2 || idx === 3 ? 1 : 0 };
      if (idx === 4) c.numFmt = "#,##0.00";
      if (idx === 4) c.font = { size: 10, bold: true, color: { argb: COLORS.green } };
      fillCell(c, i % 2 === 0 ? COLORS.white : COLORS.grayLight);
      setBorder(c);
    });
    row++;
  });

  // Total row
  const totalRow = row;
  ds.mergeCells(totalRow, 1, totalRow, 4);
  const tLabel = ds.getCell(totalRow, 1);
  tLabel.value = "إجمالي إيرادات المبيعات المباشرة";
  tLabel.font = { bold: true, size: 11, color: { argb: COLORS.white } };
  tLabel.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  fillCell(tLabel, COLORS.green);
  setBorder(tLabel);
  const tVal = ds.getCell(totalRow, 5);
  tVal.value = Number(directRevenue.toFixed(2));
  tVal.numFmt = "#,##0.00";
  tVal.font = { bold: true, size: 12, color: { argb: COLORS.white } };
  tVal.alignment = { horizontal: "right" };
  fillCell(tVal, COLORS.green);
  setBorder(tVal);
  ds.mergeCells(totalRow, 6, totalRow, 7);
  const tEnd = ds.getCell(totalRow, 6);
  tEnd.value = "ر.س — محتجزة بالكامل للشركة";
  tEnd.font = { italic: true, size: 10, color: { argb: COLORS.white } };
  tEnd.alignment = { vertical: "middle", indent: 1 };
  fillCell(tEnd, COLORS.green);
  setBorder(tEnd);
  ds.getRow(totalRow).height = 28;

  // ===== SHEET 3: AFFILIATE SALES =====
  const aff = wb.addWorksheet("٣. مبيعات المسوّقين", {
    properties: { tabColor: { argb: COLORS.amber } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  aff.columns = [
    { width: 6 }, { width: 24 }, { width: 22 }, { width: 12 }, { width: 24 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 14 },
  ];
  addBrandHeader(aff, "مبيعات المسوّقين — عمولة 10%", "كل صف يوضّح: المبلغ الإجمالي، العمولة المستحقة (10%)، وصافي الشركة.", 10);

  tableHeader(aff, 5, ["#", "العميل", "المسوّق", "كود الإحالة", "المنتج", "الإجمالي", "العمولة 10%", "صافي الشركة", "الحالة", "تاريخ الدفع"]);

  row = 6;
  affiliateOrders.forEach((o: any, i: number) => {
    const ref = refsByOrder[o.id];
    const prod = Array.isArray(o.store_products) ? o.store_products[0] : o.store_products;
    const grossA = Number(o.amount || 0);
    const commA = Number(ref?.commission || 0);
    const netA = grossA - commA;
    const cells: any[] = [
      String(i + 1),
      o.user_name || "—",
      ref ? (affNames[ref.affiliate_user_id] || ref.affiliate_user_id.slice(0, 8)) : "—",
      o.ref_code || "—",
      prod?.name || "—",
      Number(grossA.toFixed(2)),
      Number(commA.toFixed(2)),
      Number(netA.toFixed(2)),
      ref?.status || "—",
      o.paid_at ? new Date(o.paid_at).toISOString().slice(0, 10) : "—",
    ];
    cells.forEach((v, idx) => {
      const c = aff.getCell(row, idx + 1);
      c.value = v;
      c.font = { size: 10 };
      c.alignment = { vertical: "middle", horizontal: [5, 6, 7].includes(idx) ? "right" : idx === 0 ? "center" : "left", indent: 1 };
      if ([5, 6, 7].includes(idx)) c.numFmt = "#,##0.00";
      if (idx === 5) c.font = { size: 10, bold: true, color: { argb: COLORS.brand } };
      if (idx === 6) c.font = { size: 10, bold: true, color: { argb: COLORS.red } };
      if (idx === 7) c.font = { size: 10, bold: true, color: { argb: COLORS.green } };
      if (idx === 8) {
        const status = String(v).toLowerCase();
        if (status === "paid") { c.font = { size: 10, bold: true, color: { argb: COLORS.green } }; }
        else if (status === "pending") { c.font = { size: 10, bold: true, color: { argb: COLORS.amber } }; }
      }
      fillCell(c, i % 2 === 0 ? COLORS.white : COLORS.grayLight);
      setBorder(c);
    });
    row++;
  });

  // Totals row
  const aTotalRow = row;
  aff.mergeCells(aTotalRow, 1, aTotalRow, 5);
  const al = aff.getCell(aTotalRow, 1);
  al.value = "الإجماليات";
  al.font = { bold: true, size: 11, color: { argb: COLORS.white } };
  al.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  fillCell(al, COLORS.amber);
  setBorder(al);
  [
    { col: 6, val: affiliateRevenue, color: COLORS.brand },
    { col: 7, val: totalCommissions, color: COLORS.red },
    { col: 8, val: affiliateRevenue - totalCommissions, color: COLORS.green },
  ].forEach(({ col, val, color }) => {
    const c = aff.getCell(aTotalRow, col);
    c.value = Number(val.toFixed(2));
    c.numFmt = "#,##0.00";
    c.font = { bold: true, size: 11, color: { argb: COLORS.white } };
    c.alignment = { horizontal: "right" };
    fillCell(c, color);
    setBorder(c);
  });
  aff.mergeCells(aTotalRow, 9, aTotalRow, 10);
  const aEnd = aff.getCell(aTotalRow, 9);
  aEnd.value = "ر.س";
  aEnd.font = { italic: true, color: { argb: COLORS.white } };
  aEnd.alignment = { vertical: "middle", indent: 1 };
  fillCell(aEnd, COLORS.amber);
  setBorder(aEnd);
  aff.getRow(aTotalRow).height = 28;

  // ===== SHEET 4: COMMISSION CALCULATION =====
  const calc = wb.addWorksheet("٤. حسابات العمولة", {
    properties: { tabColor: { argb: COLORS.red } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  calc.columns = [
    { width: 6 }, { width: 22 }, { width: 24 }, { width: 14 }, { width: 6 }, { width: 14 }, { width: 4 }, { width: 14 }, { width: 14 }, { width: 22 },
  ];
  addBrandHeader(calc, "مراجعة حسابات العمولة", "يوضّح المعادلة المطبّقة على كل طلب مسوّق:  العمولة = الإجمالي × 10%  ← مسجّلة في جدول affiliate_referrals.", 10);

  tableHeader(calc, 5, ["#", "تاريخ الطلب", "المسوّق", "الإجمالي", "×", "النسبة", "=", "العمولة", "الحالة", "ملاحظات"]);

  row = 6;
  affiliateOrders.forEach((o: any, i: number) => {
    const ref = refsByOrder[o.id];
    const grossA = Number(o.amount || 0);
    const commA = Number(ref?.commission || 0);
    const cells: any[] = [
      String(i + 1),
      o.paid_at ? new Date(o.paid_at).toISOString().slice(0, 10) : (o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : "—"),
      ref ? (affNames[ref.affiliate_user_id] || ref.affiliate_user_id.slice(0, 8)) : "—",
      Number(grossA.toFixed(2)),
      "×",
      "10%",
      "=",
      Number(commA.toFixed(2)),
      ref?.status || "—",
      ref?.status === "paid" ? "صُرفت عبر سحب" : ref?.status === "pending" ? "تنتظر طلب سحب المسوّق" : "لا يوجد سجل إحالة",
    ];
    cells.forEach((v, idx) => {
      const c = calc.getCell(row, idx + 1);
      c.value = v;
      c.font = { size: 10 };
      c.alignment = { vertical: "middle", horizontal: [3, 4, 5, 6, 7].includes(idx) ? "center" : "left", indent: 1 };
      if (idx === 3) { c.numFmt = "#,##0.00"; c.font = { size: 10, bold: true, color: { argb: COLORS.brand } }; c.alignment = { horizontal: "right", vertical: "middle" }; }
      if (idx === 7) { c.numFmt = "#,##0.00"; c.font = { size: 10, bold: true, color: { argb: COLORS.red } }; c.alignment = { horizontal: "right", vertical: "middle" }; }
      if ([4, 5, 6].includes(idx)) c.font = { size: 11, bold: true, color: { argb: COLORS.gray } };
      fillCell(c, i % 2 === 0 ? COLORS.white : COLORS.grayLight);
      setBorder(c);
    });
    row++;
  });

  const cTotalRow = row;
  calc.mergeCells(cTotalRow, 1, cTotalRow, 7);
  const cl = calc.getCell(cTotalRow, 1);
  cl.value = "Σ إجمالي العمولات المستحقة";
  cl.font = { bold: true, size: 11, color: { argb: COLORS.white } };
  cl.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  fillCell(cl, COLORS.red);
  setBorder(cl);
  const ctv = calc.getCell(cTotalRow, 8);
  ctv.value = Number(totalCommissions.toFixed(2));
  ctv.numFmt = "#,##0.00";
  ctv.font = { bold: true, size: 12, color: { argb: COLORS.white } };
  ctv.alignment = { horizontal: "right" };
  fillCell(ctv, COLORS.red);
  setBorder(ctv);
  calc.mergeCells(cTotalRow, 9, cTotalRow, 10);
  const ce = calc.getCell(cTotalRow, 9);
  ce.value = "ر.س";
  ce.font = { italic: true, color: { argb: COLORS.white } };
  ce.alignment = { vertical: "middle", indent: 1 };
  fillCell(ce, COLORS.red);
  setBorder(ce);
  calc.getRow(cTotalRow).height = 28;

  // ===== SHEET 5: WITHDRAWALS =====
  const wd = wb.addWorksheet("٥. سحوبات المسوّقين", {
    properties: { tabColor: { argb: COLORS.blue } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  wd.columns = [
    { width: 6 }, { width: 24 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 28 }, { width: 18 }, { width: 18 },
  ];
  addBrandHeader(wd, "سحوبات المسوّقين — سجل المدفوعات", "تتبّع كل طلبات الصرف. 'مدفوع' = المبلغ غادر الشركة؛ 'معلّق' = التزام على الشركة.", 8);

  tableHeader(wd, 5, ["#", "المسوّق", "المبلغ (ر.س)", "الحالة", "طريقة الصرف", "الحساب / المحفظة", "تاريخ الطلب", "تاريخ التنفيذ"]);

  row = 6;
  wList.forEach((w: any, i: number) => {
    const account = w.method === "wallet"
      ? `${w.wallet_provider || ""} • ${w.wallet_number || ""}`
      : `${w.bank_name || ""} • ${w.iban || ""}`;
    const cells: any[] = [
      String(i + 1),
      affNames[w.user_id] || w.user_id.slice(0, 8),
      Number(Number(w.amount || 0).toFixed(2)),
      w.status,
      (w.method || "bank").toUpperCase(),
      account,
      w.created_at ? new Date(w.created_at).toISOString().slice(0, 10) : "—",
      w.processed_at ? new Date(w.processed_at).toISOString().slice(0, 10) : "—",
    ];
    cells.forEach((v, idx) => {
      const c = wd.getCell(row, idx + 1);
      c.value = v;
      c.font = { size: 10 };
      c.alignment = { vertical: "middle", horizontal: idx === 2 ? "right" : idx === 0 ? "center" : "left", indent: 1 };
      if (idx === 2) { c.numFmt = "#,##0.00"; c.font = { size: 10, bold: true }; }
      if (idx === 3) {
        const status = String(v).toLowerCase();
        if (status === "paid") { fillCell(c, COLORS.greenLight); c.font = { size: 10, bold: true, color: { argb: COLORS.green } }; }
        else if (status === "pending") { fillCell(c, COLORS.amberLight); c.font = { size: 10, bold: true, color: { argb: COLORS.amber } }; }
        else if (status === "rejected") { fillCell(c, COLORS.redLight); c.font = { size: 10, bold: true, color: { argb: COLORS.red } }; }
        setBorder(c);
        return;
      }
      fillCell(c, i % 2 === 0 ? COLORS.white : COLORS.grayLight);
      setBorder(c);
    });
    row++;
  });

  const wTotalRow = row;
  wd.mergeCells(wTotalRow, 1, wTotalRow, 2);
  const wl = wd.getCell(wTotalRow, 1);
  wl.value = "Σ إجمالي المدفوع";
  wl.font = { bold: true, color: { argb: COLORS.white } };
  wl.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  fillCell(wl, COLORS.blue);
  setBorder(wl);
  const wtv = wd.getCell(wTotalRow, 3);
  wtv.value = Number(paidOut.toFixed(2));
  wtv.numFmt = "#,##0.00";
  wtv.font = { bold: true, color: { argb: COLORS.white } };
  wtv.alignment = { horizontal: "right" };
  fillCell(wtv, COLORS.blue);
  setBorder(wtv);
  wd.mergeCells(wTotalRow, 4, wTotalRow, 8);
  const we = wd.getCell(wTotalRow, 4);
  we.value = `معلّق: ${fmt(pendingPayout)} ر.س`;
  we.font = { italic: true, color: { argb: COLORS.white } };
  we.alignment = { vertical: "middle", indent: 1 };
  fillCell(we, COLORS.blue);
  setBorder(we);
  wd.getRow(wTotalRow).height = 26;

  // ===== SHEET 6: DISCOUNT CODES PERFORMANCE =====
  const { data: dcCodes } = await supabase
    .from("discount_codes")
    .select("id, code, discount_type, discount_value, usage_limit, usage_count, expires_at, is_active, applies_to_all_products, applies_to_all_gateways, created_at")
    .order("created_at", { ascending: false });

  const dcList = dcCodes || [];
  const dcIds = dcList.map((c: any) => c.id);

  let dcProds: Record<string, string[]> = {};
  let dcGws: Record<string, string[]> = {};
  let dcSales: Record<string, { paid: number; revenue: number; saved: number }> = {};

  if (dcIds.length > 0) {
    const [{ data: prodLinks }, { data: gwLinks }, { data: dcOrders }] = await Promise.all([
      supabase.from("discount_code_products").select("discount_code_id, store_products(name)").in("discount_code_id", dcIds),
      supabase.from("discount_code_gateways").select("discount_code_id, gateway").in("discount_code_id", dcIds),
      supabase.from("store_orders").select("discount_code_id, amount, original_amount, status").in("discount_code_id", dcIds).eq("status", "paid"),
    ]);
    (prodLinks || []).forEach((r: any) => {
      const k = r.discount_code_id;
      const name = r.store_products?.name || "—";
      (dcProds[k] = dcProds[k] || []).push(name);
    });
    (gwLinks || []).forEach((r: any) => {
      const k = r.discount_code_id;
      (dcGws[k] = dcGws[k] || []).push(r.gateway);
    });
    (dcOrders || []).forEach((o: any) => {
      const k = o.discount_code_id;
      const cur = dcSales[k] || { paid: 0, revenue: 0, saved: 0 };
      cur.paid += 1;
      cur.revenue += Number(o.amount || 0);
      const orig = Number(o.original_amount || o.amount || 0);
      cur.saved += Math.max(0, orig - Number(o.amount || 0));
      dcSales[k] = cur;
    });
  }

  const dc = wb.addWorksheet("٦. أكواد الخصم", {
    properties: { tabColor: { argb: COLORS.accent } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  dc.columns = [
    { width: 6 }, { width: 18 }, { width: 14 }, { width: 26 }, { width: 22 },
    { width: 12 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 12 },
  ];
  addBrandHeader(dc, "أكواد الخصم — الأداء الفعلي في المبيعات",
    "الاستخدام = الطلبات المدفوعة فقط (الكود يُحتسب فقط عندما يصل الطلب للحالة 'paid'). الطلبات الملغاة أو المهجورة لا تُحتسب.", 10);

  tableHeader(dc, 5, ["#", "الكود", "النوع", "المنتجات", "وسائل الدفع",
    "مُستخدم / الحد", "الطلبات المدفوعة", "الإيراد (ر.س)", "إجمالي الخصم (ر.س)", "الحالة"]);

  let dRow = 6;
  let totRev = 0, totSaved = 0, totUsed = 0;
  const gwLabel = (g: string) => g === "tamara" ? "تمارا" : g === "streampay" ? "بطاقة" : g === "bank_transfer" ? "تحويل بنكي" : g;

  dcList.forEach((c: any, i: number) => {
    const sales = dcSales[c.id] || { paid: 0, revenue: 0, saved: 0 };
    totRev += sales.revenue; totSaved += sales.saved; totUsed += sales.paid;
    const expired = c.expires_at && new Date(c.expires_at).getTime() < Date.now();
    const exhausted = c.usage_limit != null && c.usage_count >= c.usage_limit;
    const statusText = !c.is_active ? "معطّل" : expired ? "منتهي الصلاحية" : exhausted ? "استُنفد" : "فعّال";
    const statusColor = statusText === "فعّال" ? COLORS.green : statusText === "معطّل" ? COLORS.gray : COLORS.red;

    const cells: any[] = [
      String(i + 1),
      c.code,
      c.discount_type === "percent" ? `${c.discount_value}%` : `${c.discount_value} SAR`,
      (dcProds[c.id] && dcProds[c.id].length > 0) ? dcProds[c.id].join(", ") : "كل المنتجات",
      (dcGws[c.id] && dcGws[c.id].length > 0) ? dcGws[c.id].map(gwLabel).join(", ") : "كل وسائل الدفع",
      `${c.usage_count}${c.usage_limit != null ? ` / ${c.usage_limit}` : ""}`,
      sales.paid,
      Number(sales.revenue.toFixed(2)),
      Number(sales.saved.toFixed(2)),
      statusText,
    ];
    cells.forEach((v, idx) => {
      const cell = dc.getCell(dRow, idx + 1);
      cell.value = v;
      cell.font = { size: 10 };
      cell.alignment = { vertical: "middle", horizontal: idx === 0 ? "center" : [6, 7, 8].includes(idx) ? "right" : "left", indent: 1, wrapText: true };
      if (idx === 1) cell.font = { size: 10, bold: true, color: { argb: COLORS.brand } };
      if (idx === 7) { cell.numFmt = "#,##0.00"; cell.font = { size: 10, bold: true, color: { argb: COLORS.green } }; }
      if (idx === 8) { cell.numFmt = "#,##0.00"; cell.font = { size: 10, bold: true, color: { argb: COLORS.red } }; }
      if (idx === 9) cell.font = { size: 10, bold: true, color: { argb: statusColor } };
      fillCell(cell, i % 2 === 0 ? COLORS.white : COLORS.grayLight);
      setBorder(cell);
    });
    dc.getRow(dRow).height = 22;
    dRow++;
  });

  if (dcList.length > 0) {
    const totRowIdx = dRow;
    dc.mergeCells(totRowIdx, 1, totRowIdx, 6);
    const tl = dc.getCell(totRowIdx, 1);
    tl.value = "الإجماليات";
    tl.font = { bold: true, color: { argb: COLORS.white } };
    tl.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    fillCell(tl, COLORS.accent); setBorder(tl);

    [
      { col: 7, val: totUsed,  fmt: "#,##0",     color: COLORS.brand },
      { col: 8, val: totRev,   fmt: "#,##0.00",  color: COLORS.green },
      { col: 9, val: totSaved, fmt: "#,##0.00",  color: COLORS.red },
    ].forEach(({ col, val, fmt: f, color }) => {
      const c = dc.getCell(totRowIdx, col);
      c.value = Number(typeof val === "number" ? val.toFixed(f.includes(".") ? 2 : 0) : val);
      c.numFmt = f;
      c.font = { bold: true, color: { argb: COLORS.white } };
      c.alignment = { horizontal: "right" };
      fillCell(c, color); setBorder(c);
    });
    const cEnd = dc.getCell(totRowIdx, 10);
    cEnd.value = "—"; fillCell(cEnd, COLORS.accent); setBorder(cEnd);
    dc.getRow(totRowIdx).height = 28;
  } else {
    dc.mergeCells(dRow, 1, dRow, 10);
    const empty = dc.getCell(dRow, 1);
    empty.value = "لا توجد أكواد خصم حتى الآن.";
    empty.alignment = { horizontal: "center", vertical: "middle" };
    empty.font = { italic: true, color: { argb: COLORS.gray } };
    fillCell(empty, COLORS.grayLight); setBorder(empty);
    dc.getRow(dRow).height = 32;
  }

  // ===== SHEET 7: TAMARA ORDERS =====
  const tamaraOrders = paid.filter((o: any) => o.payment_gateway === "tamara");
  const tm = wb.addWorksheet("٧. طلبات تمارا", {
    properties: { tabColor: { argb: "FFEC4899" } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  tm.columns = [
    { width: 6 }, { width: 26 }, { width: 24 }, { width: 14 }, { width: 14 },
    { width: 12 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 },
  ];
  addBrandHeader(tm, "طلبات تمارا — تفصيل الرسوم",
    `المعادلة: (المبلغ × ${(TAMARA_VARIABLE_RATE * 100).toFixed(2)}% + ${TAMARA_FIXED_FEE} ر.س) × (1 + ${(TAMARA_VAT_RATE * 100).toFixed(0)}% ضريبة). إجمالي ${tamaraOrders.length} طلب مدفوع.`, 10);
  tableHeader(tm, 5, ["#", "العميل", "المنتج", "المبلغ (ر.س)", "رسوم متغيرة", "رسوم ثابتة", "ضريبة", "إجمالي الرسوم", "الصافي المستلم", "تاريخ الدفع"]);

  let tmRow = 6;
  let tmGross = 0, tmFeeTotal = 0;
  tamaraOrders.forEach((o: any, i: number) => {
    const amount = Number(o.amount || 0);
    const f = tamaraFee(amount);
    const prod = Array.isArray(o.store_products) ? o.store_products[0] : o.store_products;
    tmGross += amount; tmFeeTotal += f.total;
    const cells: any[] = [
      String(i + 1),
      o.user_name || o.user_email || "—",
      prod?.name || "—",
      Number(amount.toFixed(2)),
      Number(f.variable.toFixed(2)),
      Number(f.fixed.toFixed(2)),
      Number(f.vat.toFixed(2)),
      Number(f.total.toFixed(2)),
      Number(f.net.toFixed(2)),
      o.paid_at ? new Date(o.paid_at).toISOString().slice(0, 10) : "—",
    ];
    cells.forEach((v, idx) => {
      const c = tm.getCell(tmRow, idx + 1);
      c.value = v;
      c.font = { size: 10 };
      c.alignment = { vertical: "middle", horizontal: [3, 4, 5, 6, 7, 8].includes(idx) ? "right" : idx === 0 ? "center" : "left", indent: 1 };
      if ([3, 4, 5, 6, 7, 8].includes(idx)) c.numFmt = "#,##0.00";
      if (idx === 3) c.font = { size: 10, bold: true, color: { argb: COLORS.brand } };
      if ([4, 5, 6, 7].includes(idx)) c.font = { size: 10, color: { argb: COLORS.red } };
      if (idx === 8) c.font = { size: 10, bold: true, color: { argb: COLORS.green } };
      fillCell(c, i % 2 === 0 ? COLORS.white : COLORS.grayLight);
      setBorder(c);
    });
    tm.getRow(tmRow).height = 22;
    tmRow++;
  });

  if (tamaraOrders.length > 0) {
    tm.mergeCells(tmRow, 1, tmRow, 3);
    const tl = tm.getCell(tmRow, 1);
    tl.value = "الإجماليات";
    tl.font = { bold: true, color: { argb: COLORS.white } };
    tl.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    fillCell(tl, COLORS.brand); setBorder(tl);
    [
      { col: 4, val: tmGross, color: COLORS.brand },
      { col: 8, val: tmFeeTotal, color: COLORS.red },
      { col: 9, val: tmGross - tmFeeTotal, color: COLORS.green },
    ].forEach(({ col, val, color }) => {
      const c = tm.getCell(tmRow, col);
      c.value = Number(val.toFixed(2));
      c.numFmt = "#,##0.00";
      c.font = { bold: true, color: { argb: COLORS.white } };
      c.alignment = { horizontal: "right" };
      fillCell(c, color); setBorder(c);
    });
    [5, 6, 7, 10].forEach(col => {
      const c = tm.getCell(tmRow, col);
      fillCell(c, COLORS.brand); setBorder(c);
    });
    tm.getRow(tmRow).height = 28;
  }

  // ===== SHEET 8: STREAMPAY ORDERS =====
  const spOrders = paid.filter((o: any) => o.payment_gateway === "streampay");
  const sp = wb.addWorksheet("8. طلبات ستريم باي", {
    properties: { tabColor: { argb: COLORS.blue } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  sp.columns = [
    { width: 6 }, { width: 26 }, { width: 24 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
  ];
  addBrandHeader(sp, "طلبات ستريم باي — تفصيل الرسوم (مدى مقابل فيزا)",
    `مدى: ${(SP_MADA_RATE * 100)}% + ${SP_FIXED_FEE} ريال + ${(SP_COMMISSION_RATE * 100)}% عمولة   |   فيزا: ${(SP_VISA_RATE * 100)}% + ${SP_FIXED_FEE} ريال + ${(SP_COMMISSION_RATE * 100)}% عمولة`, 9);
  tableHeader(sp, 5, ["#", "العميل", "المنتج", "المبلغ (ريال)", "رسوم مدى", "صافي مدى", "رسوم فيزا", "صافي فيزا", "تاريخ الدفع"]);

  let spRow = 6;
  let spGross = 0, spMadaFees = 0, spVisaFees = 0;
  spOrders.forEach((o: any, i: number) => {
    const amount = Number(o.amount || 0);
    const f = spFee(amount);
    const prod = Array.isArray(o.store_products) ? o.store_products[0] : o.store_products;
    spGross += amount; spMadaFees += f.madaTotal; spVisaFees += f.visaTotal;
    const cells: any[] = [
      String(i + 1),
      o.user_name || o.user_email || "—",
      prod?.name || "—",
      Number(amount.toFixed(2)),
      Number(f.madaTotal.toFixed(2)),
      Number(f.madaNet.toFixed(2)),
      Number(f.visaTotal.toFixed(2)),
      Number(f.visaNet.toFixed(2)),
      o.paid_at ? new Date(o.paid_at).toISOString().slice(0, 10) : "—",
    ];
    cells.forEach((v, idx) => {
      const c = sp.getCell(spRow, idx + 1);
      c.value = v;
      c.font = { size: 10 };
      c.alignment = { vertical: "middle", horizontal: [3, 4, 5, 6, 7].includes(idx) ? "right" : idx === 0 ? "center" : "left", indent: 1 };
      if ([3, 4, 5, 6, 7].includes(idx)) c.numFmt = "#,##0.00";
      if (idx === 3) c.font = { size: 10, bold: true, color: { argb: COLORS.brand } };
      if ([4, 6].includes(idx)) c.font = { size: 10, color: { argb: COLORS.red } };
      if ([5, 7].includes(idx)) c.font = { size: 10, bold: true, color: { argb: COLORS.green } };
      fillCell(c, i % 2 === 0 ? COLORS.white : COLORS.grayLight);
      setBorder(c);
    });
    sp.getRow(spRow).height = 22;
    spRow++;
  });

  if (spOrders.length > 0) {
    sp.mergeCells(spRow, 1, spRow, 3);
    const sl = sp.getCell(spRow, 1);
    sl.value = "الإجماليات";
    sl.font = { bold: true, color: { argb: COLORS.white } };
    sl.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    fillCell(sl, COLORS.brand); setBorder(sl);
    [
      { col: 4, val: spGross, color: COLORS.brand },
      { col: 5, val: spMadaFees, color: COLORS.red },
      { col: 6, val: spGross - spMadaFees, color: COLORS.green },
      { col: 7, val: spVisaFees, color: COLORS.red },
      { col: 8, val: spGross - spVisaFees, color: COLORS.green },
    ].forEach(({ col, val, color }) => {
      const c = sp.getCell(spRow, col);
      c.value = Number(val.toFixed(2));
      c.numFmt = "#,##0.00";
      c.font = { bold: true, color: { argb: COLORS.white } };
      c.alignment = { horizontal: "right" };
      fillCell(c, color); setBorder(c);
    });
    const sEnd = sp.getCell(spRow, 9);
    fillCell(sEnd, COLORS.brand); setBorder(sEnd);
    sp.getRow(spRow).height = 28;
  }

  // Output
  const buffer = await wb.xlsx.writeBuffer();
  const filename = `jobbots-financial-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
