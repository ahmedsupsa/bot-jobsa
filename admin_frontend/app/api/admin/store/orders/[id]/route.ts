import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAdminSession, unauthorizedResponse } from "@/lib/admin-auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { id } = params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.streampay_invoice_id !== undefined) updates.streampay_invoice_id = body.streampay_invoice_id;
  if (body.streampay_payment_id !== undefined) updates.streampay_payment_id = body.streampay_payment_id;
  if (body.status === "paid" && !body.paid_at) updates.paid_at = new Date().toISOString();
  const { error } = await supabase.from("store_orders").update(updates).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!requireAdminSession()) return unauthorizedResponse();
  const { id } = params;
  const { error } = await supabase.from("store_orders").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
