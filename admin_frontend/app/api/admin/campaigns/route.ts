import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = enforcePermission("email-test"); if (denied) return denied;

  const { data, error } = await supabase
    .from("email_campaigns")
    .select("id,name,subject,from_name,total_sent,total_opened,created_at,sent_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, campaigns: data || [] });
}

export async function POST(req: Request) {
  const denied = enforcePermission("email-test"); if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { name, subject, body: emailBody, from_name, reply_to } = body;

  if (!name || !subject || !emailBody) {
    return NextResponse.json({ ok: false, error: "الاسم والعنوان والنص مطلوبة" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("email_campaigns")
    .insert({
      name: String(name).trim(),
      subject: String(subject).trim(),
      body: String(emailBody).trim(),
      from_name: String(from_name || "Jobbots").trim(),
      reply_to: reply_to ? String(reply_to).trim() : null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
