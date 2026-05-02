import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { buildSessionCookieValue, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, type Permission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const SUPER_EMAILS = (process.env.GOOGLE_ADMIN_EMAILS || "")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function getAdminByEmail(email: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_accounts?google_email=eq.${encodeURIComponent(email.toLowerCase())}&disabled=eq.false&select=username,permissions,is_super&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await r.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const baseUrl = (process.env.NEXTAUTH_URL || "http://localhost:5000").replace(/\/$/, "");
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/login?error=no_session", baseUrl));
  }

  const email = session.user.email.toLowerCase();

  try {
    let username = email;
    let isSuper = false;
    let permissions: Permission[] = [];

    if (SUPER_EMAILS.includes(email)) {
      isSuper = true;
    } else {
      const acc = await getAdminByEmail(email);
      if (!acc) return NextResponse.redirect(new URL("/login?error=AccessDenied", baseUrl));
      username = acc.username || email;
      isSuper = !!acc.is_super;
      permissions = (acc.permissions || []) as Permission[];
    }

    const cookieValue = buildSessionCookieValue({ username, isSuper, permissions });
    const response = NextResponse.redirect(new URL("/admin", baseUrl));
    response.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=session_error", baseUrl));
  }
}
