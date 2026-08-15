import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/* The privileged client.
 *
 * Every other database call in this product runs as the signed-in user, with
 * row-level security as the guard. That is why the security audit came back
 * clean and it is the right default. This client is the exception: it holds
 * the service role key, which bypasses row-level security entirely. Anything
 * it can reach, it can reach for every tenant at once.
 *
 * It exists for exactly one reason. A customer's API token is stored encrypted
 * in a table with row-level security on and no policy at all, and the three
 * functions that touch it are granted only to the service role. Nothing the
 * browser can do reaches any of it — which is the point, and which means the
 * one thing that legitimately needs to must run here.
 *
 * Three guards, because a mistake here hands over a customer's own systems:
 *
 *   - The "server-only" import above makes the build fail rather than ship, if
 *     this file is ever pulled into a client component. It does not warn; it
 *     refuses.
 *   - The key is read from SUPABASE_SERVICE_ROLE_KEY. That name has no
 *     NEXT_PUBLIC_ prefix, and it must never be given one — Next.js inlines
 *     anything so prefixed into the JavaScript every visitor downloads.
 *   - Session persistence is off. This client has no user and must never
 *     acquire one from a cookie lying around.
 *
 * If you are reading this because you want to use it for something else:
 * almost certainly do not. The ordinary client with the user's own session is
 * the right tool, and if row-level security is in the way then the policy is
 * what needs fixing.
 */

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Integrations cannot run without it."
    );
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The key that encrypts stored credentials. Held only in the environment. */
export function integrationKey(): string {
  const k = process.env.INTEGRATION_KEY;
  if (!k || k.length < 32) {
    throw new Error(
      "INTEGRATION_KEY is missing or too short. Generate 32 random bytes and set it in the environment."
    );
  }
  return k;
}
