/* Taking translated records and putting them into Opservor.
 *
 * This is where integrations usually go wrong. The naive version inserts what
 * it fetched, so the second sync produces a second copy of every vehicle and
 * the third produces a third. The fix is the identity map: before touching
 * anything we ask "have we seen this external id before, on this connection?"
 *
 * Two further rules, both learned the hard way by everyone who has built one
 * of these:
 *
 *   - The remote system does not own every field. If someone has marked a
 *     truck as retired in Opservor, a sync must not quietly set it back to
 *     active because Samsara still lists it. Only fields the provider is
 *     authoritative for get overwritten.
 *
 *   - A row that fails to import is reported, not swallowed. A sync that says
 *     "success" while dropping four vehicles is worse than one that fails.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalVehicle, Connector, ConnectorConfig, SyncSummary } from "./types";

/**
 * A short fingerprint of what the provider sent, so an unchanged record can
 * be skipped on the next run rather than rewritten.
 */
function fingerprint(v: CanonicalVehicle): string {
  // depot belongs here. Without it, moving a truck between yards at the
  // provider leaves the hash unchanged, the row is skipped as "nothing moved",
  // and the depot never updates — a silent staleness rather than an error.
  const stable = [
    v.name, v.type, v.registration, v.vin, v.make, v.model, v.year, v.fuelType, v.depot,
  ];
  let h = 0;
  const s = stable.join("\0");
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export async function syncVehicles(
  supabase: SupabaseClient,
  connector: Connector,
  cfg: ConnectorConfig,
  companyId: string,
  connectionId: string
): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();
  const summary: SyncSummary = {
    provider: connector.provider,
    vehiclesSeen: 0,
    vehiclesCreated: 0,
    vehiclesUpdated: 0,
    tripsSeen: 0,
    tripsCreated: 0,
    maintenanceSeen: 0,
    maintenanceCreated: 0,
    warnings: [],
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  // Existing mappings for this connection, fetched once rather than a lookup
  // per vehicle. A thousand vehicles should not mean a thousand round trips.
  const { data: refRows, error: refError } = await supabase
    .from("integration_external_ref")
    .select("external_id, internal_id, external_hash")
    .eq("company_id", companyId)
    .eq("connection_id", connectionId)
    .eq("entity_type", "vehicle");

  if (refError) {
    summary.errors.push(`Could not read the identity map: ${refError.message}`);
    summary.finishedAt = new Date().toISOString();
    return summary;
  }

  const known = new Map(
    (refRows ?? []).map((r) => [
      String(r.external_id),
      { internalId: String(r.internal_id), hash: r.external_hash as string | null },
    ])
  );

  let cursor: string | undefined;
  let guard = 0;

  do {
    // A provider that keeps returning a cursor would loop forever. 500 pages
    // at 200 a page is 100,000 vehicles — far past any real fleet.
    if (++guard > 500) {
      summary.errors.push("Stopped after 500 pages — the provider kept returning a cursor.");
      break;
    }

    let page;
    try {
      page = await connector.fetchVehicles(cfg, cursor);
    } catch (e) {
      summary.errors.push(e instanceof Error ? e.message : String(e));
      break;
    }

    if (page.warnings?.length) summary.warnings.push(...page.warnings);

    for (const v of page.items) {
      summary.vehiclesSeen++;
      const hash = fingerprint(v);
      const existing = known.get(v.externalId);

      // Fields the provider is authoritative for. status is absent on
      // purpose — see the note at the top.
      const providerOwned: Record<string, unknown> = {
        name: v.name,
        type: v.type ?? "Vehicle",
        license_plate: v.registration ?? null,
      };
      if (v.fuelType) providerOwned.fuel_type = v.fuelType;
      // Only written when the provider actually said something. A vehicle that
      // has been assigned a depot by hand must not be blanked by a sync from a
      // system where nobody set up groups.
      if (v.depot) providerOwned.depot = v.depot;

      try {
        if (existing) {
          if (existing.hash === hash) continue; // nothing moved

          const { error } = await supabase
            .from("fleet_vehicle")
            .update(providerOwned)
            .eq("id", existing.internalId)
            .eq("company_id", companyId);

          if (error) {
            summary.errors.push(`${v.name}: ${error.message}`);
            continue;
          }

          await supabase
            .from("integration_external_ref")
            .update({ external_hash: hash, last_seen_at: new Date().toISOString() })
            .eq("company_id", companyId)
            .eq("connection_id", connectionId)
            .eq("entity_type", "vehicle")
            .eq("external_id", v.externalId);

          summary.vehiclesUpdated++;
        } else {
          const { data: created, error } = await supabase
            .from("fleet_vehicle")
            .insert({
              company_id: companyId,
              ...providerOwned,
              // New vehicles start active. Mileage is left at zero because
              // migration 0009 derives it from trips.
              status: "active",
            })
            .select("id")
            .single();

          if (error || !created) {
            summary.errors.push(`${v.name}: ${error?.message ?? "insert returned nothing"}`);
            continue;
          }

          const { error: mapError } = await supabase.from("integration_external_ref").insert({
            company_id: companyId,
            connection_id: connectionId,
            entity_type: "vehicle",
            external_id: v.externalId,
            internal_id: created.id,
            external_hash: hash,
          });

          if (mapError) {
            // The vehicle exists but is unmapped, so the next sync would
            // create it again. Say so loudly rather than report success.
            summary.errors.push(
              `${v.name}: created but could not be mapped (${mapError.message}). ` +
                `It will be duplicated on the next sync until this is resolved.`
            );
            continue;
          }

          summary.vehiclesCreated++;
        }
      } catch (e) {
        summary.errors.push(`${v.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    cursor = page.cursor;
  } while (cursor);

  summary.finishedAt = new Date().toISOString();

  const status =
    summary.errors.length === 0 ? "success" : summary.vehiclesSeen > 0 ? "partial" : "failed";

  await supabase
    .from("integration_connection")
    .update({
      last_sync_at: summary.finishedAt,
      last_sync_status: status,
      last_sync_message:
        summary.errors[0] ??
        `${summary.vehiclesCreated} added, ${summary.vehiclesUpdated} updated, ` +
          `${summary.vehiclesSeen} seen.`,
      status: status === "failed" ? "error" : "active",
    })
    .eq("id", connectionId)
    .eq("company_id", companyId);

  return summary;
}

/* ------------------------------------------------------------------ *
 * Trips.
 *
 * Written after vehicles, and only ever after them, because a trip is
 * meaningless without the vehicle it belongs to. The provider names a vehicle
 * by its own id, so the identity map built during the vehicle sync is what
 * turns that into something Opservor can store.
 *
 * Trips are a ledger rather than a state table: a journey that happened does
 * not change afterwards. So an already-imported trip is skipped rather than
 * rewritten, and the provider's own id is what makes that possible.
 * ------------------------------------------------------------------ */

export async function syncTrips(
  supabase: SupabaseClient,
  connector: Connector,
  cfg: ConnectorConfig,
  companyId: string,
  connectionId: string,
  since: string,
  summary: SyncSummary
): Promise<void> {
  if (!connector.fetchTrips) {
    summary.warnings.push(`${connector.provider} does not provide trips.`);
    return;
  }

  // Which provider vehicle id maps to which of ours. Built by the vehicle
  // sync that ran moments ago.
  const { data: vehicleRefs, error: refError } = await supabase
    .from("integration_external_ref")
    .select("external_id, internal_id")
    .eq("company_id", companyId)
    .eq("connection_id", connectionId)
    .eq("entity_type", "vehicle");

  if (refError) {
    summary.errors.push(`Could not read the vehicle map: ${refError.message}`);
    return;
  }

  const vehicleFor = new Map(
    (vehicleRefs ?? []).map((r) => [String(r.external_id), String(r.internal_id)])
  );

  if (vehicleFor.size === 0) {
    summary.warnings.push("No vehicles are mapped yet, so trips were skipped.");
    return;
  }

  // Trips already imported for this connection, so a second run adds only
  // what is new rather than duplicating a year of journeys.
  const { data: tripRefs } = await supabase
    .from("integration_external_ref")
    .select("external_id")
    .eq("company_id", companyId)
    .eq("connection_id", connectionId)
    .eq("entity_type", "trip");

  const alreadyHave = new Set((tripRefs ?? []).map((r) => String(r.external_id)));

  let cursor: string | undefined;
  let guard = 0;

  do {
    if (++guard > 500) {
      summary.errors.push("Stopped after 500 pages of trips — the provider kept returning a cursor.");
      break;
    }

    let page;
    try {
      page = await connector.fetchTrips(cfg, since, cursor);
    } catch (e) {
      summary.errors.push(e instanceof Error ? e.message : String(e));
      break;
    }

    if (page.warnings?.length) summary.warnings.push(...page.warnings);

    const newRows: Record<string, unknown>[] = [];
    const newRefs: Record<string, unknown>[] = [];

    for (const t of page.items) {
      summary.tripsSeen++;
      if (alreadyHave.has(t.externalId)) continue;

      const vehicleId = vehicleFor.get(t.vehicleExternalId);
      if (!vehicleId) {
        // A trip for a vehicle we have never seen. Reported rather than
        // dropped silently, because it usually means the vehicle sync was
        // cut short and the fleet is incomplete.
        summary.warnings.push(
          `A trip referenced vehicle ${t.vehicleExternalId}, which is not in the fleet list.`
        );
        continue;
      }

      newRows.push({
        company_id: companyId,
        vehicle_id: vehicleId,
        date: t.date,
        miles_driven: t.distanceMiles,
        fuel_used: t.fuelUsed ?? null,
        origin: t.origin ?? null,
        destination: t.destination ?? null,
        status: t.status ?? "completed",
      });
      newRefs.push({
        company_id: companyId,
        connection_id: connectionId,
        entity_type: "trip",
        external_id: t.externalId,
      });
      alreadyHave.add(t.externalId);
    }

    if (newRows.length) {
      const { data: inserted, error } = await supabase
        .from("fleet_trip")
        .insert(newRows)
        .select("id");

      if (error) {
        summary.errors.push(`Could not write trips: ${error.message}`);
        break;
      }

      // The reference rows can only be written once the trips have ids, and
      // they must line up — insert returns rows in the order they were sent.
      const ids = (inserted ?? []).map((r) => String(r.id));
      const refsWithIds = newRefs
        .map((ref, i) => (ids[i] ? { ...ref, internal_id: ids[i] } : null))
        .filter(Boolean) as Record<string, unknown>[];

      if (refsWithIds.length) {
        const { error: refErr } = await supabase
          .from("integration_external_ref")
          .insert(refsWithIds);
        if (refErr) {
          // The trips are in but unmapped, which would mean importing them
          // again next time. Worth saying out loud.
          summary.warnings.push(
            `Trips were imported but not all could be recorded as seen: ${refErr.message}`
          );
        }
      }

      summary.tripsCreated += ids.length;
    }

    cursor = page.cursor;
  } while (cursor);
}

/**
 * Scheduled and completed service work.
 *
 * Runs after vehicles, like trips, because a maintenance record is meaningless
 * without the vehicle it belongs to and the mapping built moments ago is what
 * resolves one to the other.
 *
 * Two rules the database enforces and this has to respect:
 *
 *   - A completed job must carry a completion date, and anything not completed
 *     must carry none. A provider that reports work as done without saying when
 *     would otherwise fail the whole batch on a constraint.
 *   - A booking with no date is not a booking. Those are dropped rather than
 *     imported as something the capacity check would then have to ignore.
 */
export async function syncMaintenance(
  supabase: SupabaseClient,
  connector: Connector,
  cfg: ConnectorConfig,
  companyId: string,
  connectionId: string,
  summary: SyncSummary
): Promise<void> {
  if (!connector.fetchMaintenance) {
    // Not a failing. Telematics systems genuinely do not have this.
    return;
  }

  const { data: vehicleRefs, error: refError } = await supabase
    .from("integration_external_ref")
    .select("external_id, internal_id")
    .eq("company_id", companyId)
    .eq("connection_id", connectionId)
    .eq("entity_type", "vehicle");

  if (refError) {
    summary.errors.push(`Could not read the vehicle map: ${refError.message}`);
    return;
  }

  const vehicleFor = new Map(
    (vehicleRefs ?? []).map((r) => [String(r.external_id), String(r.internal_id)])
  );

  if (vehicleFor.size === 0) {
    summary.warnings.push("No vehicles are mapped yet, so service work was skipped.");
    return;
  }

  const { data: existingRefs } = await supabase
    .from("integration_external_ref")
    .select("external_id")
    .eq("company_id", companyId)
    .eq("connection_id", connectionId)
    .eq("entity_type", "maintenance");

  const alreadyHave = new Set((existingRefs ?? []).map((r) => String(r.external_id)));

  let cursor: string | undefined;
  let guard = 0;

  do {
    if (++guard > 200) {
      summary.errors.push("Stopped after 200 pages of service work — the provider kept returning a cursor.");
      break;
    }

    let page;
    try {
      page = await connector.fetchMaintenance(cfg, cursor);
    } catch (e) {
      summary.errors.push(e instanceof Error ? e.message : String(e));
      break;
    }

    if (page.warnings?.length) summary.warnings.push(...page.warnings);

    const newRows: Record<string, unknown>[] = [];
    const newRefs: Record<string, unknown>[] = [];

    for (const m of page.items) {
      summary.maintenanceSeen++;
      if (alreadyHave.has(m.externalId)) continue;

      const vehicleId = vehicleFor.get(m.vehicleExternalId);
      if (!vehicleId) {
        summary.warnings.push(
          `Service work referenced vehicle ${m.vehicleExternalId}, which is not in the fleet list.`
        );
        continue;
      }

      const completed = m.status === "completed";
      if (completed && !m.completedDate) {
        // The constraint would reject this. Reported rather than quietly
        // downgraded, because "done, date unknown" is a real data problem at
        // the provider and worth someone seeing.
        summary.warnings.push(
          `A completed job on ${m.vehicleExternalId} had no completion date and was skipped.`
        );
        continue;
      }
      if (!completed && !m.scheduledDate) continue;

      newRows.push({
        company_id: companyId,
        vehicle_id: vehicleId,
        type: m.type,
        status: m.status,
        priority: "routine",
        scheduled_date: m.scheduledDate ?? null,
        completed_date: completed ? m.completedDate : null,
        odometer: m.odometerMiles ?? null,
        cost: m.cost ?? null,
        vendor: m.vendor ?? null,
        reference: m.reference ?? null,
        notes: m.notes ?? null,
      });
      newRefs.push({
        company_id: companyId,
        connection_id: connectionId,
        entity_type: "maintenance",
        external_id: m.externalId,
      });
      alreadyHave.add(m.externalId);
    }

    if (newRows.length) {
      const { data: inserted, error } = await supabase
        .from("fleet_maintenance")
        .insert(newRows)
        .select("id");

      if (error) {
        summary.errors.push(`Could not write service work: ${error.message}`);
        break;
      }

      const ids = (inserted ?? []).map((r) => String(r.id));
      const refsWithIds = newRefs
        .map((ref, i) => (ids[i] ? { ...ref, internal_id: ids[i] } : null))
        .filter(Boolean) as Record<string, unknown>[];

      if (refsWithIds.length) {
        const { error: refErr } = await supabase
          .from("integration_external_ref")
          .insert(refsWithIds);
        if (refErr) {
          summary.warnings.push(
            `Service work was imported but not all could be recorded as seen: ${refErr.message}`
          );
        }
      }

      summary.maintenanceCreated += ids.length;
    }

    cursor = page.cursor;
  } while (cursor);
}
