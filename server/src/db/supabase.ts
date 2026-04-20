/**
 * Supabase admin client — server-side only.
 * Uses the service-role key which bypasses Row Level Security.
 * Never import this on the client.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env"
  );
}

export const supabase = createClient(url, key, {
  auth: {
    // Server-side only — no session persistence needed
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
