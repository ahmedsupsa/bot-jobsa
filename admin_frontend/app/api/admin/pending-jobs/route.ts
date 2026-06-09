import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { enforcePermission } from "@/lib/admin-auth";
import { tg, postJobToChannel } from "@/lib/telegram";
import fs from "fs";
import path from "path";

const WORKER_DIR = path.resolve(process.cwd(), "..", "worker");
const PENDING_FILE = path.join(WORKER_DIR, "pending_jobs.json");

function readPending(): any[] {
  try {
    if (!fs.existsSync(PENDING_FILE)) return [];
    const raw = fs.readFileSync(PENDING_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writePending(data: any[]) {
  fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  const _denied_ = enforcePermission("jobs"); if (_denied_) return _denied_;
  const jobs = readPending();
  return NextResponse.json({ ok: true, jobs });
}

export async function POST(req: Request) {
  const _denied_ = enforcePermission("jobs"); if (_denied_) return _denied_;
  const body = await req.json().catch(() => ({}));
  const { id, title_ar, company, description_ar, application_email, link_url, specializations, salary } = body;

  if (!id || !title_ar) {
    return NextResponse.json({ ok: false, error: "معرف الوظيفة والعنوان مطلوبان" }, { status: 400 });
  }

  // Inject salary into description if provided
  let finalDesc = (description_ar || "").trim();
  if (salary && salary.trim()) {
    const salaryLine = `💰 الراتب: ${salary.trim()}`;
    finalDesc = finalDesc ? `${salaryLine}\n\n${finalDesc}` : salaryLine;
  }

  // Insert into admin_jobs
  const { error, data } = await supabase.from("admin_jobs").insert({
    title_ar: title_ar.trim(),
    company: (company || "").trim() || null,
    description_ar: finalDesc || null,
    application_email: (application_email || "").trim() || null,
    link_url: link_url || null,
    specializations: specializations || title_ar,
    is_active: true,
    created_at: new Date().toISOString(),
  }).select("id").single();

  if (error) {
    console.error("pending-jobs publish error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  tg.jobAdded(title_ar, (company || "").trim(), application_email || "").catch(() => {});
  postJobToChannel({ title_ar, description_ar: description_ar || "", application_email: application_email || "" })
    .then(async (msgId) => {
      if (msgId && data?.id) {
        await supabase.from("admin_jobs").update({ tg_message_id: msgId }).eq("id", data.id);
      }
    }).catch(() => {});

  // Remove from pending file
  const jobs = readPending();
  const filtered = jobs.filter((j: any) => j.id !== id);
  writePending(filtered);

  return NextResponse.json({ ok: true, job: data });
}

export async function DELETE(req: Request) {
  const _denied_ = enforcePermission("jobs"); if (_denied_) return _denied_;
  const body = await req.json().catch(() => ({}));
  const { id } = body;

  if (!id) {
    return NextResponse.json({ ok: false, error: "معرف الوظيفة مطلوب" }, { status: 400 });
  }

  const jobs = readPending();
  const filtered = jobs.filter((j: any) => j.id !== id);
  writePending(filtered);

  return NextResponse.json({ ok: true });
}
