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

/**
 * A configuration fault whose message is safe to show an operator.
 *
 * The distinction matters because the route reports these and hides
 * everything else. An error thrown by a library may quote the value that
 * upset it, and when that value is a key, repeating it to the browser
 * publishes the key — which is exactly what happened here.
 */
export class ConfigError extends Error {}

/**
 * Reads a secret from the environment.
 *
 * Trims, because a key pasted into a hosting dashboard collects a trailing
 * newline that nothing displays and everything inherits. Left in, it reached
 * supabase-js, which put it in an HTTP header, which threw a TypeError quoting
 * the whole key — and that message was handed to the browser. The whitespace
 * was invisible at every step until it was on screen in front of a customer.
 *
 * Whitespace in the middle is different: nothing legitimate produces it, so it
 * means the value is truncated or two values got joined. That is reported
 * rather than trimmed away, and reported without quoting the value.
 */
function readSecret(name: string, minLength = 0): string {
  const raw = process.env[name];
  if (!raw || !raw.trim()) {
    throw new ConfigError(`${name} is not set. Integrations cannot run without it.`);
  }

  const value = raw.trim();

  if (/\s/.test(value)) {
    throw new ConfigError(
      `${name} has a space or line break inside it, so it cannot be sent as a ` +
      `header. It was probably pasted across two lines. Set it again as a single ` +
      `unbroken line.`
    );
  }

  if (minLength && value.length < minLength) {
    throw new ConfigError(
      `${name} is shorter than ${minLength} characters, so it is not a whole key.`
    );
  }

  return value;
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) throw new ConfigError("NEXT_PUBLIC_SUPABASE_URL is not set.");

  const key = readSecret("SUPABASE_SERVICE_ROLE_KEY");

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The key that encrypts stored credentials. Held only in the environment. */
export function integrationKey(): string {
  return readSecret("INTEGRATION_KEY", 32);
}

/**
 * What to tell the browser when the server is misconfigured.
 *
 * Only our own ConfigError text goes out. Anything else is logged and replaced,
 * because a library handed a bad value tends to quote that value back — and
 * when the value is a service role key, repeating the message to the browser
 * puts the key on the customer's screen. That is not hypothetical: a key pasted
 * into the hosting dashboard carried a line break, supabase-js tried to build
 * an HTTP header from it, and the TypeError it threw contained the whole key.
 * The route passed that message straight through.
 *
 * So the test is who wrote the sentence, not how alarming it looks.
 */
export function configErrorMessage(e: unknown): string {
  if (e instanceof ConfigError) return e.message;
  console.error("[integrations] configuration failure", e);
  return (
    "Integrations are not configured correctly on the server. The reason is in " +
    "the server log — it is kept out of this message because errors like it can " +
    "quote the key that caused them."
  );
}
