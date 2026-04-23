import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/admin-auth";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

export async function GET() {
  const _denied_ = enforcePermission("jobs"); if (_denied_) return _denied_;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Jobbots Admin";
  wb.created = new Date();

  const ws = wb.addWorksheet("الوظائف", {
    views: [{ rightToLeft: true }],
  });

  ws.columns = [
    { header: "عنوان الوظيفة", key: "title_ar", width: 30 },
    { header: "الوصف", key: "description_ar", width: 50 },
    { header: "البريد للتقديم", key: "application_email", width: 30 },
    { header: "اسم الشركة", key: "company", width: 25 },
    { header: "التخصصات", key: "specializations", width: 40 },
  ];

  // Style header
  const header = ws.getRow(1);
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });

  // Example rows
  const examples = [
    { title_ar: "مصمم جرافيك", description_ar: "تصميم هويات بصرية، إعلانات سوشيال ميديا، استخدام Photoshop و Illustrator", application_email: "hr@example.com", company: "شركة الإبداع", specializations: "" },
    { title_ar: "مطور واجهات أمامية", description_ar: "خبرة في React و TypeScript و Tailwind CSS", application_email: "jobs@techco.sa", company: "شركة التقنية", specializations: "React, TypeScript, Frontend" },
    { title_ar: "محاسب", description_ar: "إعداد التقارير المالية والميزانيات السنوية", application_email: "careers@finance.com", company: "", specializations: "" },
  ];

  examples.forEach((row, i) => {
    const r = ws.addRow(row);
    r.height = 22;
    r.alignment = { vertical: "middle", wrapText: true };
    r.eachCell((cell) => {
      cell.font = { size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF" } };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFF3F4F6" } },
      };
    });
  });

  // Add notes sheet
  const notes = wb.addWorksheet("تعليمات", { views: [{ rightToLeft: true }] });
  notes.columns = [{ width: 90 }];
  const noteLines = [
    "📋 تعليمات استخدام القالب:",
    "",
    "1. عنوان الوظيفة (مطلوب) - اسم الوظيفة بالعربي مثل: مصمم جرافيك",
    "2. الوصف (اختياري) - وصف المهام والمتطلبات (يستخدمه الذكاء الاصطناعي لاستخراج التخصصات)",
    "3. البريد للتقديم (مطلوب) - بريد استقبال طلبات التقديم",
    "4. اسم الشركة (اختياري) - اسم الجهة الموظفة",
    "5. التخصصات (اختياري) - إذا تُركت فارغة، الذكاء الاصطناعي يستخرجها تلقائياً من العنوان والوصف",
    "",
    "⚠️ تنبيهات:",
    "- الحد الأقصى 200 وظيفة لكل ملف",
    "- لا تغيّر أسماء الأعمدة في الصف الأول",
    "- احذف صفوف الأمثلة قبل الرفع",
    "- البريد يجب أن يكون بصيغة صحيحة (example@domain.com)",
  ];
  noteLines.forEach((line, i) => {
    const r = notes.addRow([line]);
    r.height = 20;
    r.getCell(1).font = { size: i === 0 ? 14 : 11, bold: i === 0 || line.startsWith("⚠️") };
    r.getCell(1).alignment = { vertical: "middle", wrapText: true };
  });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="jobs_template.xlsx"`,
    },
  });
}
