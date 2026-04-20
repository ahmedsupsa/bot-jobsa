import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("store");
  if (denied) return denied;

  const supabase = freshClient();
  const { error } = await supabase
    .from("bank_accounts")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("store");
  if (denied) return denied;

  const body = await req.json();
  const supabase = freshClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, account: data });
}
