import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
// Session signing key — independent of ADMIN_PASSWORD so password rotation doesn't break sessions.
// Production MUST set ADMIN_SESSION_SECRET; dev falls back with a loud warning.
const SESSION_SECRET = (() => {
  const v = process.env.ADMIN_SESSION_SECRET;
  if (v && v.length >= 16) return v;
  if (process.env.NODE_ENV === "production") {
    console.error("[admin-auth] ADMIN_SESSION_SECRET is missing or too short in production. Refusing to issue sessions.");
    return "";
  }
  console.warn("[admin-auth] ADMIN_SESSION_SECRET not set — using insecure dev fallback.");
  return "dev-only-insecure-fallback-do-not-use-in-prod";
})();
const COOKIE_NAME = "admin_session";
const SESSION_TTL_DAYS = 7;

export const ALL_PERMISSIONS = [
  "users",
  "codes",
  "jobs",
  "templates",
  "notifications",
  "store",
  "support",
  "affiliate",
  "finance",
  "email-test",
  "admins",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export interface AdminSession {
  username: string;
  isSuper: boolean;
  permissions: Permission[];
  exp: number;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}
function sign(payload: string): string {
  return b64urlEncode(crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest());
}

export function buildSessionCookieValue(input: { username: string; isSuper: boolean; permissions: Permission[] }): string {
  if (!SESSION_SECRET) throw new Error("ADMIN_SESSION_SECRET not configured");
  const payload: AdminSession = {
    username: input.username,
    isSuper: input.isSuper,
    permissions: input.isSuper ? [...ALL_PERMISSIONS] : input.permissions,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_DAYS * 24 * 60 * 60,
  };
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

export function parseSessionCookieValue(raw: string | undefined | null): AdminSession | null {
  if (!raw || !SESSION_SECRET) return null;
  // Legacy unsigned cookie ("1") is no longer accepted — must re-login.
  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (sign(body) !== sig) return null;
  try {
    const json = JSON.parse(b64urlDecode(body).toString("utf8")) as AdminSession;
    if (typeof json.exp !== "number" || json.exp * 1000 < Date.now()) return null;
    return {
      username: String(json.username || "admin"),
      isSuper: !!json.isSuper,
      permissions: Array.isArray(json.permissions) ? (json.permissions as Permission[]) : [],
      exp: json.exp,
    };
  } catch {
    return null;
  }
}

export function getAdminSession(): AdminSession | null {
  const cookieStore = cookies();
  return parseSessionCookieValue(cookieStore.get(COOKIE_NAME)?.value);
}

/** Backwards-compatible: returns "ok" or null. Prefer getAdminSession() for permission checks. */
export function requireAdminSession(): string | null {
  return getAdminSession() ? "ok" : null;
}

export function requirePermission(perm: Permission): AdminSession | null {
  const s = getAdminSession();
  if (!s) return null;
  if (s.isSuper || s.permissions.includes(perm)) return s;
  return null;
}

/** Returns a 401/403 NextResponse if the caller lacks the permission, otherwise null. */
export function enforcePermission(perm: Permission): NextResponse | null {
  const s = getAdminSession();
  if (!s) return unauthorizedResponse();
  if (!s.isSuper && !s.permissions.includes(perm)) return forbiddenResponse();
  return null;
}

export function unauthorizedResponse() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export function forbiddenResponse() {
  return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

// ─── password hashing (scrypt) ───
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const test = crypto.scryptSync(password, salt, expected.length);
    return crypto.timingSafeEqual(test, expected);
  } catch {
    return false;
  }
}
