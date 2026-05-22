import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";
import { readFileSync } from "fs";
import { join } from "path";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

let _taxonomy: Record<string, { m: string; c: string; j: string[] }> | null = null;
function getTaxonomy() {
  if (!_taxonomy) {
    const p = join(process.cwd(), "public", "jobs_taxonomy_compact.json");
    _taxonomy = JSON.parse(readFileSync(p, "utf-8"));
  }
  return _taxonomy!;
}

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const body = await req.json().catch(() => ({}));
  const majorIds: number[] = (body.major_ids || []).map(Number).filter((n: number) => n > 0);

  const taxonomy = getTaxonomy();

  // توسيع المسميات الوظيفية من التخصصات المختارة
  const keywords = new Set<string>();
  for (const id of majorIds) {
    const entry = taxonomy[String(id)];
    if (!entry) continue;
    keywords.add(entry.m);
    for (const j of entry.j) keywords.add(j);
  }

  const supabase = freshClient();

  const { data: existing } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("user_id", uid)
    .maybeSingle();

  const patch = {
    taxonomy_major_ids: majorIds,
    taxonomy_keywords: [...keywords],
  };

  if (existing) {
    await supabase.from("user_settings").update(patch).eq("user_id", uid);
  } else {
    await supabase.from("user_settings").insert({ user_id: uid, ...patch });
  }

  return NextResponse.json({
    ok: true,
    major_count: majorIds.length,
    keyword_count: keywords.size,
  });
}

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const supabase = freshClient();
  const { data } = await supabase
    .from("user_settings")
    .select("taxonomy_major_ids,taxonomy_keywords")
    .eq("user_id", uid)
    .maybeSingle();

  return NextResponse.json({
    major_ids: (data as any)?.taxonomy_major_ids || [],
    keyword_count: ((data as any)?.taxonomy_keywords || []).length,
  });
}
