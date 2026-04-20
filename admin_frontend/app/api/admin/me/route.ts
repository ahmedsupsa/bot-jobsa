import { NextResponse } from "next/server";
import { getAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET() {
  const s = getAdminSession();
  if (!s) return unauthorizedResponse();
  return NextResponse.json({
    ok: true,
    username: s.username,
    isSuper: s.isSuper,
    permissions: s.permissions,
  });
}
