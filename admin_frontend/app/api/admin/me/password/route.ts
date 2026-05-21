import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import {
  getAdminSession,
  hashPassword,
  verifyPassword,
  unauthorizedResponse,
} from "@/lib/admin-auth";

const ENV_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ENV_USERNAME = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();

export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body.current_password || "");
  const newPassword = String(body.new_password || "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ ok: false, error: "يرجى تعبئة جميع الحقول" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ ok: false, error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
  }

  const uname = session.username.toLowerCase();

  // Check if this admin has a DB account
  const { data: acc } = await supabase
    .from("admin_accounts")
    .select("id,password_hash,disabled")
    .eq("username", uname)
    .maybeSingle();

  if (acc) {
    // DB account — verify current password against DB hash
    if (!verifyPassword(currentPassword, acc.password_hash || "")) {
      return NextResponse.json({ ok: false, error: "كلمة المرور الحالية غير صحيحة" }, { status: 401 });
    }
    const { error } = await supabase
      .from("admin_accounts")
      .update({ password_hash: hashPassword(newPassword) })
      .eq("id", acc.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (session.isSuper) {
    // Env-based super admin — verify against env var
    if (currentPassword !== ENV_PASSWORD) {
      return NextResponse.json({ ok: false, error: "كلمة المرور الحالية غير صحيحة" }, { status: 401 });
    }
    // Create a DB entry so the new password persists
    const { error } = await supabase
      .from("admin_accounts")
      .upsert({
        username: uname,
        password_hash: hashPassword(newPassword),
        is_super: true,
        permissions: [],
        disabled: false,
      }, { onConflict: "username" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ ok: false, error: "الحساب غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
