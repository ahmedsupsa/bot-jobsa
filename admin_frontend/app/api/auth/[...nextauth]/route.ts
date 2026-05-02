import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { buildSessionCookieValue, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/admin-auth";

const ALLOWED_EMAILS = (process.env.GOOGLE_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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
      const email = (user.email || "").toLowerCase();
      if (!email) return false;
      if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email)) return false;
      return true;
    },
    async redirect({ baseUrl }) {
      return baseUrl + "/api/auth/google-complete";
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
