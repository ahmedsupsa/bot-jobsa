import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

const ALLOWED_TYPES = ["license", "certificate", "course", "qiyas", "other"] as const;
type CertType = (typeof ALLOWED_TYPES)[number];

function auth401() {
  return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
}

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return auth401();
  const payload = await verifyToken(token);
  if (!payload) return auth401();

  const { data, error } = await supabase
    .from("user_certifications")
    .select("*")
    .eq("user_id", payload.user_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, certifications: data || [] });
}

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) return auth401();
  const payload = await verifyToken(token);
  if (!payload) return auth401();

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 }); }

  const type = body.type as CertType;
  const name = String(body.name ?? "").trim();

  if (!ALLOWED_TYPES.includes(type)) return NextResponse.json({ error: "نوع غير صالح" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "اسم الشهادة مطلوب" }, { status: 400 });

  const record = {
    user_id:    payload.user_id,
    type,
    name,
    issuer:     String(body.issuer ?? "").trim() || null,
    issued_at:  body.issued_at ? String(body.issued_at) : null,
    expires_at: body.expires_at ? String(body.expires_at) : null,
  };

  const { data, error } = await supabase
    .from("user_certifications")
    .insert(record)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, certification: data });
}

export async function PUT(req: Request) {
  const token = extractToken(req);
  if (!token) return auth401();
  const payload = await verifyToken(token);
  if (!payload) return auth401();

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 }); }

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "المعرّف مطلوب" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.type !== undefined) {
    const type = body.type as CertType;
    if (!ALLOWED_TYPES.includes(type)) return NextResponse.json({ error: "نوع غير صالح" }, { status: 400 });
    updates.type = type;
  }
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
    updates.name = name;
  }
  if (body.issuer !== undefined)     updates.issuer     = String(body.issuer ?? "").trim() || null;
  if (body.issued_at !== undefined)  updates.issued_at  = body.issued_at ? String(body.issued_at) : null;
  if (body.expires_at !== undefined) updates.expires_at = body.expires_at ? String(body.expires_at) : null;

  const { error } = await supabase
    .from("user_certifications")
    .update(updates)
    .eq("id", id)
    .eq("user_id", payload.user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const token = extractToken(req);
  if (!token) return auth401();
  const payload = await verifyToken(token);
  if (!payload) return auth401();

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "المعرّف مطلوب" }, { status: 400 });

  const { error } = await supabase
    .from("user_certifications")
    .delete()
    .eq("id", id)
    .eq("user_id", payload.user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
