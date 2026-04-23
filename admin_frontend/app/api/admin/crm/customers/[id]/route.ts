import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("crm"); if (denied) return denied;
  const { data: customer, error: e1 } = await supabase
    .from("crm_customers").select("*").eq("id", params.id).maybeSingle();
  if (e1) return NextResponse.json({ ok: false, error: e1.message }, { status: 500 });
  if (!customer) return NextResponse.json({ ok: false, error: "غير موجود" }, { status: 404 });
  const { data: interactions } = await supabase
    .from("crm_interactions").select("*").eq("customer_id", params.id)
    .order("occurred_at", { ascending: false });
  return NextResponse.json({ ok: true, customer, interactions: interactions || [] });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("crm"); if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, any> = {};
  for (const k of ["name", "phone", "email", "source", "status", "notes", "next_followup_at"]) {
    if (k in b) patch[k] = b[k] === "" ? null : b[k];
  }
  const { data, error } = await supabase
    .from("crm_customers").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, customer: data });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("crm"); if (denied) return denied;
  const { error } = await supabase.from("crm_customers").delete().eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
