import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildSessionCookieValue, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/login?error=no_session", process.env.NEXTAUTH_URL || "http://localhost:5000"));
  }

  try {
    const cookieValue = buildSessionCookieValue({
      username: session.user.email,
      isSuper: true,
      permissions: [],
    });

    const response = NextResponse.redirect(new URL("/admin", process.env.NEXTAUTH_URL || "http://localhost:5000"));
    response.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=session_error", process.env.NEXTAUTH_URL || "http://localhost:5000"));
  }
}
