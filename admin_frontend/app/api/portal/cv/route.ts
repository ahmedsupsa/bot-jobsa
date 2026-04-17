import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { extractToken, verifyToken } from "@/lib/auth";

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const { data: rows } = await supabase
    .from("user_cvs")
    .select("*")
    .eq("user_id", uid)
    .limit(1);

  const cv = rows?.[0];
  if (!cv) return NextResponse.json({ has_cv: false });

  let preview_url = "";
  if (cv.storage_path) {
    const { data: signed } = await supabase.storage
      .from("cvs")
      .createSignedUrl(cv.storage_path, 3600);
    preview_url = signed?.signedUrl || "";
  }

  return NextResponse.json({
    has_cv: true,
    file_name: cv.file_name || "cv.pdf",
    storage_path: cv.storage_path || "",
    updated_at: cv.created_at || "",
    preview_url,
  });
}

export async function DELETE(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const { data: rows } = await supabase
    .from("user_cvs")
    .select("storage_path")
    .eq("user_id", uid);

  for (const row of rows || []) {
    if (row.storage_path) {
      await supabase.storage.from("cvs").remove([row.storage_path]);
    }
  }

  await supabase.from("user_cvs").delete().eq("user_id", uid);
  return NextResponse.json({ status: "ok" });
}
