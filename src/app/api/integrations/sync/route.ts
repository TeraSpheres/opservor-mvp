import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, integrationKey } from "@/lib/supabase/admin";
import { getConnector } from "@/lib/connectors";
import { syncVehicles, syncTrips, syncMaintenance, syncItems } from "@/lib/connectors/sync";

/* Running a sync.
 *
 * The only place a stored credential is ever decrypted. It exists for the
 * length of this request, is passed to the adapter, and is never written
 * anywhere — not to a log line, not to the summary, not to the error message
 * that comes back when something fails.
 *
 * That last one is the easy mistake. A provider returning 401 will often echo
 * the token back in its own error body, and passing that through to the screen
 * would put a customer's key in a browser tab, a screenshot and a support
 * email. Everything that leaves here is written here.
 */

export const dynamic = "force-dynamic";
// A first sync of a real fleet reads several pages. The default would cut it
// off partway and leave half a fleet imported with no explanation.
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: appUser } = await supabase
    .from("app_user").select("company_id, role").eq("auth_id", user.id).single();
  if (!appUser) return NextResponse.json({ error: "No company found." }, { status: 400 });

  const companyId = appUser.company_id as string;

  let body: { id?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Could not read the request." }, { status: 400 }); }

  const id = (body.id || "").trim();
  if (!id) return NextResponse.json({ error: "Which connection?" }, { status: 400 });

  let admin, key;
  try {
    admin = createAdminClient();
    key = integrationKey();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Integrations are not configured." },
      { status: 500 }
    );
  }

  // Scoped to the caller's own company. Without this, an id from another
  // tenant would sync their fleet into this one.
  const { data: conn } = await admin
    .from("integration_connection")
    .select("id, provider, base_url")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (!conn) return NextResponse.json({ error: "No such connection." }, { status: 404 });

  const connector = getConnector(conn.provider as string);
  if (!connector) {
    return NextResponse.json({ error: `No adapter for ${conn.provider}.` }, { status: 400 });
  }

  const { data: token, error: keyErr } = await admin.rpc("integration_credential_get", {
    p_connection: conn.id,
    p_key: key,
  });

  if (keyErr || !token) {
    await note(admin, conn.id as string, "failed", "The stored key could not be read. Enter it again.");
    return NextResponse.json(
      { error: "The stored key could not be read. Enter it again on the Connections page." },
      { status: 400 }
    );
  }

  const cfg = {
    baseUrl: (conn.base_url as string) || connector.defaultBaseUrl,
    token: token as string,
  };

  try {
    // The connection id goes through so each imported vehicle keeps a record
    // of which connection produced it — that is what lets a second sync update
    // a vehicle rather than create a duplicate of it.
    const summary = await syncVehicles(admin, connector, cfg, companyId, conn.id as string);

    // Trips only after vehicles, and only ever after them — a trip is
    // meaningless without the vehicle it belongs to, and the mapping the
    // vehicle sync just built is what resolves one to the other.
    //
    // Ninety days because that is Samsara's ceiling and a sensible first
    // window for the others: enough history for a daily rate to mean
    // something, not so much that a first sync takes all afternoon.
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    await syncTrips(admin, connector, cfg, companyId, conn.id as string, since, summary);

    // Service work, where the provider has any. Telematics systems do not —
    // they report defects, not bookings — so this is a no-op for three of the
    // four and the whole point of the fourth.
    await syncMaintenance(admin, connector, cfg, companyId, conn.id as string, summary);

    // Stock, where the provider holds any. An inventory system contributes
    // only this; a telematics system contributes none of it.
    await syncItems(admin, connector, cfg, companyId, conn.id as string, summary);

    const status =
      summary.errors.length ? "partial" :
      summary.warnings.length ? "partial" : "success";

    const message =
      `${summary.vehiclesCreated} vehicles added, ${summary.vehiclesUpdated} updated` +
      (summary.tripsCreated ? `, ${summary.tripsCreated} trips imported` : "") +
      (summary.maintenanceCreated
        ? `, ${summary.maintenanceCreated} service jobs imported`
        : "") +
      (summary.itemsCreated || summary.itemsUpdated
        ? `, ${summary.itemsCreated} stock items added, ${summary.itemsUpdated} updated`
        : "") +
      (summary.warnings.length ? ` · ${summary.warnings.length} warning(s)` : "");

    await note(admin, conn.id as string, status, message);
    await admin.rpc("integration_credential_verified", { p_connection: conn.id });

    // The summary is built here rather than passed through, so nothing the
    // provider said can reach the screen unedited.
    return NextResponse.json({
      vehiclesSeen: summary.vehiclesSeen,
      vehiclesCreated: summary.vehiclesCreated,
      vehiclesUpdated: summary.vehiclesUpdated,
      tripsSeen: summary.tripsSeen,
      tripsCreated: summary.tripsCreated,
      maintenanceSeen: summary.maintenanceSeen,
      maintenanceCreated: summary.maintenanceCreated,
      itemsSeen: summary.itemsSeen,
      itemsCreated: summary.itemsCreated,
      itemsUpdated: summary.itemsUpdated,
      warnings: summary.warnings.slice(0, 20),
      message,
    });
  } catch (e) {
    // Deliberately not the provider's own words. Their 401 body frequently
    // contains the token that was sent.
    const safe = describe(e);
    await note(admin, conn.id as string, "failed", safe);
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}

/** Records the outcome against the connection, for the screen to show. */
async function note(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  status: "success" | "partial" | "failed",
  message: string
) {
  await admin
    .from("integration_connection")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_message: message.slice(0, 300),
      status: status === "failed" ? "error" : "active",
    })
    .eq("id", id);
}

/**
 * Turns whatever went wrong into something safe to show.
 *
 * Written as a small set of recognised cases rather than passing the original
 * message through, because the original may contain the credential and will
 * certainly contain wording nobody running a depot can act on.
 */
function describe(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const s = raw.toLowerCase();

  if (s.includes("401") || s.includes("unauthor") || s.includes("forbidden") || s.includes("403"))
    return "That system rejected the key. It may have been revoked or lack read access.";
  if (s.includes("429") || s.includes("rate limit"))
    return "That system asked us to slow down. Try again in a few minutes.";
  if (s.includes("timeout") || s.includes("etimedout") || s.includes("abort"))
    return "That system did not respond in time. It may be busy — try again shortly.";
  if (s.includes("enotfound") || s.includes("econnrefused") || s.includes("fetch failed"))
    return "Could not reach that system. Check the address if you set a custom one.";
  if (s.includes("500") || s.includes("502") || s.includes("503"))
    return "That system returned an error of its own. Nothing wrong at this end.";

  return "The sync did not complete. Nothing was left half-written.";
}
