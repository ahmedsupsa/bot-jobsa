import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export function requireAdminSession(): string | null {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session");
  return session?.value === "1" ? "ok" : null;
}

export function unauthorizedResponse() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}
