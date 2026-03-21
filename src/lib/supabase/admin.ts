import { createClient } from "@supabase/supabase-js";

function serviceRoleKeyFromEnv(): string | undefined {
  const a = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (a) return a;
  /** Some setups / docs use this alias; prefer SUPABASE_SERVICE_ROLE_KEY. */
  const b = process.env.SUPABASE_SERVICE_KEY?.trim();
  return b || undefined;
}

/**
 * Service-role client for server-only operations (e.g. delete user). Never import in client code.
 * Set `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_KEY`) in the server environment — never NEXT_PUBLIC_*.
 */
export function supabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = serviceRoleKeyFromEnv();

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for admin operations.");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
