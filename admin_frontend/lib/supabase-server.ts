import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || "";

if (!url || !key) {
  console.warn("SUPABASE_URL / SUPABASE_KEY not set");
}

export const supabase = createClient(url, key);
