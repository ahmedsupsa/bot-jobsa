import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );
}

export async function GET() {
  try {
    const { data, error } = await db()
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, subject, body: emailBody, is_active } = body;
    if (!name || !subject || !emailBody) {
      return NextResponse.json({ error: "name, subject, body مطلوبة" }, { status: 400 });
    }
    const { data, error } = await db()
      .from("email_templates")
      .insert({ name, subject, body: emailBody, is_active: is_active ?? true })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
