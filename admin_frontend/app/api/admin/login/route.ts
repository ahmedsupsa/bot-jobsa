import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import {
  buildSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  verifyPassword,
  type Permission,
} from "@/lib/admin-auth";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SUPER_ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = (body.username || "").trim().toLowerCase();
  const password = (body.password || "").trim();

  let cookieValue: string | null = null;

  // Super admin via env password: empty username, "admin", or configured ADMIN_USERNAME
  const isSuperLogin =
    !username || username === "admin" || username === SUPER_ADMIN_USERNAME;
  if (isSuperLogin && password === ADMIN_PASSWORD) {
    cookieValue = buildSessionCookieValue({
      username: SUPER_ADMIN_USERNAME,
      isSuper: true,
      permissions: [],
    });
  } else if (username) {
    // Look up admin account
    const { data: acc } = await supabase
      .from("admin_accounts")
      .select("username,password_hash,permissions,is_super,disabled")
      .eq("username", username)
      .maybeSingle();
    if (acc && !acc.disabled && verifyPassword(password, acc.password_hash || "")) {
      cookieValue = buildSessionCookieValue({
        username: acc.username,
        isSuper: !!acc.is_super,
        permissions: (acc.permissions || []) as Permission[],
      });
    }
  }

  if (!cookieValue) {
    return NextResponse.json({ ok: false, error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return response;
}
