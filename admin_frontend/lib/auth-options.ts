import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const SUPER_EMAILS = (process.env.GOOGLE_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function isAllowedEmail(email: string): Promise<boolean> {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (SUPER_EMAILS.includes(lower)) return true;
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_accounts?google_email=eq.${encodeURIComponent(lower)}&disabled=eq.false&select=id&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await r.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-prod",
  callbacks: {
    async signIn({ user }) {
      const allowed = await isAllowedEmail(user.email || "");
      return allowed;
    },
    async redirect({ baseUrl }) {
      const base = baseUrl.replace(/\/$/, "");
      return base + "/api/auth/google-complete";
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
