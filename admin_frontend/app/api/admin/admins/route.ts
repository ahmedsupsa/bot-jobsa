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

export async function GET() {
  const auth = ensureSuper();
  if ("error" in auth) return auth.error;
  const { data, error } = await supabase
    .from("admin_accounts")
    .select("id,username,permissions,is_super,disabled,created_at,google_email")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, admins: data || [] });
}

export async function POST(req: Request) {
  const auth = ensureSuper();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const isSuper = !!body.is_super;
  const permissions = sanitizePerms(body.permissions);

  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    return NextResponse.json({ ok: false, error: "اسم المستخدم يجب أن يكون 3-32 حرف (أحرف إنجليزية وأرقام فقط)" }, { status: 400 });
  }
  if (username === "admin") {
    return NextResponse.json({ ok: false, error: "هذا الاسم محجوز" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("admin_accounts")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: false, error: "اسم المستخدم موجود مسبقاً" }, { status: 400 });

  const { data, error } = await supabase
    .from("admin_accounts")
    .insert({
      username,
      password_hash: hashPassword(password),
      permissions: isSuper ? [] : permissions,
      is_super: isSuper,
      disabled: false,
    })
    .select("id,username,permissions,is_super,disabled,created_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, admin: data });
}
