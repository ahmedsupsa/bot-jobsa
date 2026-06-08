import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });

  return NextResponse.json({
    error: "تم تعطيل الاستخراج التلقائي — اختر تخصصاتك يدوياً من صفحة الملف الشخصي",
    disabled: true,
  }, { status: 503 });
}
