import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

// Use service role key (bypasses RLS) for server-side operations.
// Falls back to anon key if service role not configured.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || "";
const key = serviceKey || anonKey;

if (!url || !key) {
  console.warn("SUPABASE_URL / SUPABASE_KEY not set");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
