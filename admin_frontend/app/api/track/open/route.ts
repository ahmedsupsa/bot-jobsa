import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("t");

  if (token) {
    // Mark as opened if not already
    await supabase
      .from("email_campaign_recipients")
      .update({ opened_at: new Date().toISOString() })
      .eq("token", token)
      .is("opened_at", null);

    // Update campaign total_opened count
    const { data: rec } = await supabase
      .from("email_campaign_recipients")
      .select("campaign_id")
      .eq("token", token)
      .maybeSingle();

    if (rec?.campaign_id) {
      const { count } = await supabase
        .from("email_campaign_recipients")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", rec.campaign_id)
        .not("opened_at", "is", null);

      await supabase
        .from("email_campaigns")
        .update({ total_opened: count || 0 })
        .eq("id", rec.campaign_id);
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
