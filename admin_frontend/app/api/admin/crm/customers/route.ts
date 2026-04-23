import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";

export async function GET() {
  const denied = enforcePermission("crm"); if (denied) return denied;
  const { data, error } = await supabase
    .from("crm_customers")
    .select("*")
    .order("next_followup_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, customers: data || [] });
}

export async function POST(req: Request) {
  const denied = enforcePermission("crm"); if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  if (!b.name || !String(b.name).trim()) {
    return NextResponse.json({ ok: false, error: "الاسم مطلوب" }, { status: 400 });
  }
  const payload = {
    name: String(b.name).trim(),
    phone: b.phone ? String(b.phone).trim() : null,
    email: b.email ? String(b.email).trim() : null,
    source: b.source ? String(b.source).trim() : null,
    status: b.status || "lead",
    notes: b.notes ? String(b.notes) : null,
    next_followup_at: b.next_followup_at || null,
  };
  const { data, error } = await supabase.from("crm_customers").insert(payload).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, customer: data });
}
