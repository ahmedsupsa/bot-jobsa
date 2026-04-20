import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import {
  ALL_PERMISSIONS,
  forbiddenResponse,
  getAdminSession,
  hashPassword,
  unauthorizedResponse,
  type Permission,
} from "@/lib/admin-auth";

function ensureSuper() {
  const s = getAdminSession();
  if (!s) return { error: unauthorizedResponse() } as const;
  if (!s.isSuper) return { error: forbiddenResponse() } as const;
  return { session: s } as const;
}

function sanitizePerms(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  const set = new Set(ALL_PERMISSIONS as readonly string[]);
  return input.filter((p): p is Permission => typeof p === "string" && set.has(p));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = ensureSuper();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const update: Record<string, any> = {};

  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 6) {
      return NextResponse.json({ ok: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
    }
    update.password_hash = hashPassword(body.password);
  }
  if (Array.isArray(body.permissions)) update.permissions = sanitizePerms(body.permissions);
  if (typeof body.is_super === "boolean") update.is_super = body.is_super;
  if (typeof body.disabled === "boolean") update.disabled = body.disabled;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: "لا يوجد تغييرات" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("admin_accounts")
    .update(update)
    .eq("id", params.id)
    .select("id,username,permissions,is_super,disabled,created_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, admin: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = ensureSuper();
  if ("error" in auth) return auth.error;
  const { error } = await supabase.from("admin_accounts").delete().eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
