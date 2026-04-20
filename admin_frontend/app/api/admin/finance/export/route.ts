import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

const COMMISSION_RATE = 0.10;

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
  titleCell.value = "JOBBOTS — FINANCIAL REPORT";
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
    .select("id, user_name, user_email, amount, status, ref_code, created_at, paid_at, store_products(name, duration_days)")
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
  const sum = wb.addWorksheet("1. Executive Summary", {
    properties: { tabColor: { argb: COLORS.accent } },
    views: [{ showGridLines: false }],
  });
  sum.columns = [
    { width: 38 }, { width: 22 }, { width: 22 }, { width: 38 },
  ];
  addBrandHeader(sum, "Executive Summary", `Generated: ${new Date().toUTCString()}  •  Currency: SAR  •  Commission Rate: ${(COMMISSION_RATE * 100).toFixed(0)}%`, 4);

  let r = 5;
  // Section heading
  sum.mergeCells(r, 1, r, 4);
  let sec = sum.getCell(r, 1);
  sec.value = "REVENUE BREAKDOWN";
  sec.font = { bold: true, size: 12, color: { argb: COLORS.white } };
  fillCell(sec, COLORS.gray);
  sec.alignment = { vertical: "middle", indent: 1 };
  sum.getRow(r).height = 22;
  r++;

  const summaryRows: [string, number, string, string][] = [
    ["Gross Revenue (all paid orders)", grossRevenue, "Sum of all amounts on orders with status = 'paid'", COLORS.blueLight],
    ["  • Direct Sales (no referral)", directRevenue, "Orders without ref_code — 100% retained by company", COLORS.greenLight],
    ["  • Affiliate-Driven Sales", affiliateRevenue, "Orders with ref_code — subject to 10% affiliate commission", COLORS.amberLight],
    ["Total Commissions Accrued", -totalCommissions, "10% of every affiliate sale, owed to affiliates", COLORS.redLight],
    ["NET REVENUE (Company Profit)", netRevenue, "Gross Revenue − Commissions = Cash retained by Jobbots", COLORS.greenLight],
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
  sec.value = "AFFILIATE PROGRAM CASHFLOW";
  sec.font = { bold: true, size: 12, color: { argb: COLORS.white } };
  fillCell(sec, COLORS.gray);
  sec.alignment = { vertical: "middle", indent: 1 };
  sum.getRow(r).height = 22;
  r++;

  const cashRows: [string, number, string, string][] = [
    ["Commissions Paid Out (withdrawals)", paidOut, "Sum of withdrawals with status = 'paid'", COLORS.greenLight],
    ["Pending Withdrawal Requests", pendingPayout, "Affiliates awaiting bank/wallet transfer — liability", COLORS.amberLight],
    ["Pending Commissions (un-withdrawn)", pendingCommissions, "Earned by affiliates but not yet requested for withdrawal", COLORS.amberLight],
    ["Commissions Marked Paid", paidCommissions, "Commissions linked to a paid withdrawal", COLORS.greenLight],
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
  sec.value = "ORDER STATISTICS";
  sec.font = { bold: true, size: 12, color: { argb: COLORS.white } };
  fillCell(sec, COLORS.gray);
  sec.alignment = { vertical: "middle", indent: 1 };
  sum.getRow(r).height = 22;
  r++;

  const statRows: [string, string | number, string][] = [
    ["Total Paid Orders", paid.length, "Count of orders with status = 'paid'"],
    ["  • Direct Orders", directOrders.length, "Without affiliate referral"],
    ["  • Affiliate Orders", affiliateOrders.length, "With ref_code present"],
    ["Pending Orders", all.filter((o: any) => o.status === "pending").length, "Awaiting payment confirmation"],
    ["Average Order Value", `${fmt(paid.length ? grossRevenue / paid.length : 0)} SAR`, "Gross Revenue ÷ Paid Order Count"],
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
  formula.value = "💡 Formula:  Net Revenue = Gross Revenue − (Affiliate Sales × 10%)";
  formula.font = { italic: true, size: 11, color: { argb: COLORS.brand } };
  fillCell(formula, COLORS.blueLight);
  formula.alignment = { vertical: "middle", indent: 1 };
  sum.getRow(r).height = 24;

  // ===== SHEET 2: DIRECT SALES =====
  const ds = wb.addWorksheet("2. Direct Sales (No Commission)", {
    properties: { tabColor: { argb: COLORS.green } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ds.columns = [
    { width: 6 }, { width: 30 }, { width: 30 }, { width: 24 }, { width: 14 }, { width: 18 }, { width: 18 },
  ];
  addBrandHeader(ds, "Direct Sales — 100% Retained", "Orders without an affiliate ref_code. Full amount goes to company net revenue.", 7);

  tableHeader(ds, 5, ["#", "Customer", "Email", "Product", "Amount (SAR)", "Paid Date", "Order ID"]);

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
  tLabel.value = "TOTAL DIRECT REVENUE";
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
  tEnd.value = "SAR — kept 100%";
  tEnd.font = { italic: true, size: 10, color: { argb: COLORS.white } };
  tEnd.alignment = { vertical: "middle", indent: 1 };
  fillCell(tEnd, COLORS.green);
  setBorder(tEnd);
  ds.getRow(totalRow).height = 28;

  // ===== SHEET 3: AFFILIATE SALES =====
  const aff = wb.addWorksheet("3. Affiliate Sales (Commission)", {
    properties: { tabColor: { argb: COLORS.amber } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  aff.columns = [
    { width: 6 }, { width: 24 }, { width: 22 }, { width: 12 }, { width: 24 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 14 },
  ];
  addBrandHeader(aff, "Affiliate-Driven Sales — With 10% Commission", "Each row shows: gross order amount, commission owed (10%), and net to company.", 10);

  tableHeader(aff, 5, ["#", "Customer", "Affiliate", "Ref Code", "Product", "Gross", "Commission 10%", "Net to Co.", "Status", "Paid Date"]);

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
  al.value = "TOTALS";
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
  aEnd.value = "SAR";
  aEnd.font = { italic: true, color: { argb: COLORS.white } };
  aEnd.alignment = { vertical: "middle", indent: 1 };
  fillCell(aEnd, COLORS.amber);
  setBorder(aEnd);
  aff.getRow(aTotalRow).height = 28;

  // ===== SHEET 4: COMMISSION CALCULATION =====
  const calc = wb.addWorksheet("4. Commission Math (Step-by-Step)", {
    properties: { tabColor: { argb: COLORS.red } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  calc.columns = [
    { width: 6 }, { width: 22 }, { width: 24 }, { width: 14 }, { width: 6 }, { width: 14 }, { width: 4 }, { width: 14 }, { width: 14 }, { width: 22 },
  ];
  addBrandHeader(calc, "Commission Calculation Audit Trail", "Shows the formula applied to every affiliate order:  Commission = Gross × 10%  → recorded in affiliate_referrals table.", 10);

  tableHeader(calc, 5, ["#", "Order Date", "Affiliate", "Gross", "×", "Rate", "=", "Commission", "Status", "Notes"]);

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
      ref?.status === "paid" ? "Paid via withdrawal" : ref?.status === "pending" ? "Awaiting affiliate request" : "No referral record",
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
  cl.value = "Σ Total Commissions Owed";
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
  ce.value = "SAR";
  ce.font = { italic: true, color: { argb: COLORS.white } };
  ce.alignment = { vertical: "middle", indent: 1 };
  fillCell(ce, COLORS.red);
  setBorder(ce);
  calc.getRow(cTotalRow).height = 28;

  // ===== SHEET 5: WITHDRAWALS =====
  const wd = wb.addWorksheet("5. Affiliate Withdrawals", {
    properties: { tabColor: { argb: COLORS.blue } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  wd.columns = [
    { width: 6 }, { width: 24 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 28 }, { width: 18 }, { width: 18 },
  ];
  addBrandHeader(wd, "Affiliate Withdrawals — Cash Out Ledger", "Tracks every payout request from affiliates. 'Paid' = money left the company; 'Pending' = liability.", 8);

  tableHeader(wd, 5, ["#", "Affiliate", "Amount (SAR)", "Status", "Method", "Account / Wallet", "Requested", "Processed"]);

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
  wl.value = "Σ Paid Out";
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
  we.value = `Pending: ${fmt(pendingPayout)} SAR`;
  we.font = { italic: true, color: { argb: COLORS.white } };
  we.alignment = { vertical: "middle", indent: 1 };
  fillCell(we, COLORS.blue);
  setBorder(we);
  wd.getRow(wTotalRow).height = 26;

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
