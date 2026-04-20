import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforcePermission } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const _denied_ = enforcePermission("affiliate"); if (_denied_) return _denied_;

  const formData = await req.formData();
  const withdrawalId = formData.get("withdrawal_id") as string;
  const file = formData.get("file") as File | null;
  if (!withdrawalId) return NextResponse.json({ ok: false, error: "withdrawal_id مطلوب" }, { status: 400 });
  if (!file) return NextResponse.json({ ok: false, error: "الصورة مطلوبة" }, { status: 400 });

  const MAX = 5 * 1024 * 1024;
  if (file.size > MAX) return NextResponse.json({ ok: false, error: "الصورة كبيرة جداً (حد أقصى 5 ميغابايت)" }, { status: 400 });

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
    return NextResponse.json({ ok: false, error: "صيغة غير مدعومة" }, { status: 400 });
  }

  const supabase = freshClient();
  const buffer = await file.arrayBuffer();
  const path = `${withdrawalId}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("withdrawal-proofs")
    .upload(path, Buffer.from(buffer), {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });
  if (upErr) {
    console.error("Proof upload error:", upErr);
    return NextResponse.json({ ok: false, error: `فشل رفع الصورة: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from("withdrawal-proofs").getPublicUrl(path);
  const proofUrl = pub.publicUrl;

  // Mark withdrawal paid
  await supabase
    .from("affiliate_withdrawals")
    .update({
      status: "paid",
      proof_url: proofUrl,
      paid_at: new Date().toISOString(),
    })
    .eq("id", withdrawalId);

  // Mark linked referrals as paid
  await supabase
    .from("affiliate_referrals")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("withdrawal_id", withdrawalId);

  return NextResponse.json({ ok: true, proof_url: proofUrl });
}
