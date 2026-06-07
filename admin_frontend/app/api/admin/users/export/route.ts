import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";
import * as XLSX from "xlsx";

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function subStatus(endsAt?: string | null): string {
  if (!endsAt) return "لا اشتراك";
  const days = Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return `منتهي (${Math.abs(days)} يوم)`;
  if (days === 0) return "ينتهي اليوم";
  return `نشط (${days} يوم)`;
}

export async function GET() {
  const _denied_ = enforcePermission("users"); if (_denied_) return _denied_;

  const { data: users } = await supabase
    .from("users")
    .select("id,full_name,phone,city,age,created_at,subscription_ends_at,activation_code_id")
    .order("created_at", { ascending: false })
    .limit(2000);

  const list = users || [];
  const codeIds = Array.from(new Set(list.map((u: any) => u.activation_code_id).filter(Boolean)));
  const userIds = list.map((u: any) => u.id);

  const [{ data: codes }, { data: settings }, { data: prefs }, { data: fields }, { data: cvs }, { data: apps }] =
    await Promise.all([
      codeIds.length > 0
        ? supabase.from("activation_codes").select("id,code").in("id", codeIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length > 0
        ? supabase.from("user_settings").select("user_id,email,smtp_email,email_connected").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length > 0
        ? supabase.from("user_job_preferences").select("user_id,job_field_id").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("job_fields").select("id,name_ar"),
      userIds.length > 0
        ? supabase.from("user_cvs").select("user_id,file_name,storage_path").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length > 0
        ? supabase.from("applications").select("user_id").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

  const codeMap = new Map((codes || []).map((c: any) => [c.id, c.code]));
  const settingsMap = new Map((settings || []).map((s: any) => [s.user_id, s]));
  const fieldNameMap = new Map((fields || []).map((f: any) => [String(f.id), f.name_ar]));
  const prefMap = new Map<string, string[]>();
  for (const p of prefs || []) {
    const name = fieldNameMap.get(String(p.job_field_id));
    if (!name) continue;
    if (!prefMap.has(p.user_id)) prefMap.set(p.user_id, []);
    prefMap.get(p.user_id)!.push(name);
  }
  const cvMap = new Map((cvs || []).map((c: any) => [c.user_id, c]));
  const appCountMap = new Map<string, number>();
  for (const a of apps || []) {
    appCountMap.set(a.user_id, (appCountMap.get(a.user_id) || 0) + 1);
  }

  const rows = list.map((u: any, i: number) => {
    const s = settingsMap.get(u.id) || {};
    const cv = cvMap.get(u.id);
    const prefs = prefMap.get(u.id) || [];
    return {
      "#": i + 1,
      "الاسم الكامل": u.full_name || "",
      "الجوال": u.phone || "",
      "المدينة": u.city || s.city || "",
      "العمر": u.age || "",
      "البريد": s.email || "",
      "إيميل SMTP": s.smtp_email || "",
      "الإيميل مربوط": s.email_connected ? "نعم" : "لا",
      "كود التفعيل": u.activation_code_id ? (codeMap.get(u.activation_code_id) || "") : "",
      "الاشتراك": subStatus(u.subscription_ends_at),
      "تاريخ انتهاء الاشتراك": fmtDate(u.subscription_ends_at),
      "تاريخ التسجيل": fmtDate(u.created_at),
      "سيرة ذاتية": cv?.storage_path ? "مرفوعة" : "لا",
      "اسم ملف السيرة": cv?.file_name || "",
      "إجمالي التقديمات": appCountMap.get(u.id) || 0,
      "التخصصات": prefs.join(" | "),
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });

  // عرض الأعمدة
  ws["!cols"] = [
    { wch: 4 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 6 },
    { wch: 26 }, { wch: 26 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
    { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 32 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "المستخدمون");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const today = new Date().toISOString().split("T")[0];

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="jobbots-users-${today}.xlsx"`,
    },
  });
}
