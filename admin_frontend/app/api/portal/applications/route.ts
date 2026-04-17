import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const { data: apps, count } = await supabase
    .from("applications")
    .select("*", { count: "exact" })
    .eq("user_id", uid)
    .order("applied_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ count: count || 0, applications: apps || [] });
}
