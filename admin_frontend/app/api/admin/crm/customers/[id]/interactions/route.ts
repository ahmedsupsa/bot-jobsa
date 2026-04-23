import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("crm"); if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  if (!b.summary || !String(b.summary).trim()) {
    return NextResponse.json({ ok: false, error: "ملخص التواصل مطلوب" }, { status: 400 });
  }
  const payload = {
    customer_id: params.id,
    channel: b.channel || "other",
    direction: b.direction === "in" ? "in" : "out",
    summary: String(b.summary).trim(),
    occurred_at: b.occurred_at || new Date().toISOString(),
  };
  const { data, error } = await supabase.from("crm_interactions").insert(payload).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, interaction: data });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("crm"); if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const interactionId = searchParams.get("interactionId");
  if (!interactionId) return NextResponse.json({ ok: false, error: "interactionId مطلوب" }, { status: 400 });
  const { error } = await supabase
    .from("crm_interactions").delete()
    .eq("id", interactionId).eq("customer_id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
