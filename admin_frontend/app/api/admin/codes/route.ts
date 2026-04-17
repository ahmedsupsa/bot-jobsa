import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

function generateCodes(count: number): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  while (codes.length < count) {
    const d = Array.from({ length: 7 }, () => digits[Math.floor(Math.random() * 10)]).join("");
    const l = Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * 26)]).join("");
    const code = d + l;
    if (!seen.has(code)) { seen.add(code); codes.push(code); }
  }
  return codes;
}

export async function GET() {
  if (!requireAdminSession()) return unauthorizedResponse();

  const [{ data: used }, { data: unused }] = await Promise.all([
    supabase.from("activation_codes").select("code,used_at").eq("used", true).order("used_at", { ascending: false }).limit(120),
    supabase.from("activation_codes").select("code,subscription_days,created_at").eq("used", false).order("created_at", { ascending: false }).limit(240),
  ]);

  return NextResponse.json({
    ok: true,
    used_codes: (used || []).map((c: any) => c.code),
    unused_codes: (unused || []).map((c: any) => ({ code: c.code, days: c.subscription_days })),
  });
}

export async function POST(req: Request) {
  if (!requireAdminSession()) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));
  const count = Math.min(parseInt(body.count) || 49, 500);
  const days = parseInt(body.days) || 365;

  const code = (body.manual_code || "").trim();
  if (code) {
    const { error } = await supabase.from("activation_codes").insert({
      code,
      subscription_days: days,
      used: false,
      created_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, codes: [code], count: 1 });
  }

  const codes = generateCodes(count);
  const rows = codes.map((c) => ({ code: c, subscription_days: days, used: false, created_at: new Date().toISOString() }));
  const { error } = await supabase.from("activation_codes").insert(rows);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, codes, count: codes.length });
}
