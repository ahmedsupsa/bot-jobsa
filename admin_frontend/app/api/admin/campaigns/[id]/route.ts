import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const RESEND_API_KEY   = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.jobbots.org";

function buildHtml(subject: string, body: string, from_name: string, trackingToken: string) {
  const safeBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const pixelUrl = `${APP_URL}/api/track/open?t=${trackingToken}`;

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Segoe UI',Tahoma,sans-serif;background:#f5f5f5;margin:0;padding:24px;direction:rtl;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
    <h2 style="color:#1a1a1a;margin:0 0 16px;font-size:20px;">${subject}</h2>
    <div style="color:#333;line-height:1.9;font-size:15px;">${safeBody}</div>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0 16px;">
    <p style="color:#999;font-size:12px;margin:0;text-align:center;">Jobbots — منصة التقديم التلقائي للوظائف</p>
  </div>
  <img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />
</body></html>`;
}

// GET /api/admin/campaigns/[id] — campaign details + recipients
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("email-test"); if (denied) return denied;

  const [campaignRes, recipientsRes] = await Promise.all([
    supabase.from("email_campaigns").select("*").eq("id", params.id).single(),
    supabase
      .from("email_campaign_recipients")
      .select("id,email,name,opened_at,error,created_at")
      .eq("campaign_id", params.id)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (campaignRes.error) {
    return NextResponse.json({ ok: false, error: campaignRes.error.message }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    campaign: campaignRes.data,
    recipients: recipientsRes.data || [],
  });
}

// POST /api/admin/campaigns/[id] — send the campaign
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const denied = enforcePermission("email-test"); if (denied) return denied;

  const body = await _req.json().catch(() => ({}));
  const rawList: string[] = body.recipients || [];

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY أو RESEND_FROM_EMAIL غير معرّف" }, { status: 400 });
  }

  // Parse recipients (email or "Name <email>")
  const parsed = rawList
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const m = line.match(/^(.+?)\s*<([^>]+)>\s*$/);
      if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
      return { name: "", email: line.toLowerCase() };
    })
    .filter(r => r.email.includes("@"));

  if (parsed.length === 0) {
    return NextResponse.json({ ok: false, error: "لا توجد إيميلات صالحة" }, { status: 400 });
  }

  // Fetch campaign
  const { data: campaign, error: cErr } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", params.id)
    .single();

  if (cErr || !campaign) {
    return NextResponse.json({ ok: false, error: "الحملة غير موجودة" }, { status: 404 });
  }

  // Insert recipients with unique tokens
  const rows = parsed.map(r => ({
    campaign_id: params.id,
    email: r.email,
    name: r.name || null,
  }));

  await supabase.from("email_campaign_recipients").insert(rows);

  // Fetch the inserted recipients (with their generated tokens)
  const { data: recipients } = await supabase
    .from("email_campaign_recipients")
    .select("id,email,name,token")
    .eq("campaign_id", params.id)
    .is("opened_at", null)
    .order("created_at", { ascending: false })
    .limit(parsed.length + 10);

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "فشل تحضير المستلمين" }, { status: 500 });
  }

  // Send emails one by one (or in small batches of 10 to avoid rate limits)
  let sent = 0;
  const BATCH = 10;

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    await Promise.all(batch.map(async (r) => {
      const html = buildHtml(campaign.subject, campaign.body, campaign.from_name, r.token);
      const payload: Record<string, unknown> = {
        from: `${campaign.from_name} <${RESEND_FROM_EMAIL}>`,
        to: [r.name ? `${r.name} <${r.email}>` : r.email],
        subject: campaign.subject,
        html,
      };
      if (campaign.reply_to) payload.reply_to = campaign.reply_to;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        sent++;
      } else {
        const err = await res.json().catch(() => ({}));
        await supabase
          .from("email_campaign_recipients")
          .update({ error: err?.message || `HTTP ${res.status}` })
          .eq("id", r.id);
      }
    }));
  }

  // Update campaign stats
  await supabase
    .from("email_campaigns")
    .update({ total_sent: sent, sent_at: new Date().toISOString() })
    .eq("id", params.id);

  return NextResponse.json({ ok: true, sent, total: recipients.length });
}
