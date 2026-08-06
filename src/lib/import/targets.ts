/* What a spreadsheet can be turned into.
 *
 * A prospect exports whatever their system produces. The column will be called
 * "Item Code" or "Material" or "Part No" or "SKU" — never the same twice — so
 * every field carries the names it is likely to arrive under. Auto-matching
 * saves the operator from mapping twenty columns by hand, and being wrong
 * costs nothing because the mapping is shown and can be corrected before
 * anything is written.
 *
 * Rules:
 *   - Required fields are the ones without which the row means nothing.
 *   - Nothing is invented. A missing optional field stays missing rather than
 *     being defaulted to a number somebody might later act on.
 */

export type FieldKind = "text" | "number" | "integer" | "date" | "enum";

export interface TargetField {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Lower-case fragments a matching header might contain. Order matters. */
  aliases: string[];
  /** For enum fields — accepted values, and what incoming text maps onto them. */
  values?: Record<string, string[]>;
  help?: string;
}

export interface ImportTarget {
  id: string;
  label: string;
  /** What the operator would call the export. */
  blurb: string;
  table: string;
  module: string;
  fields: TargetField[];
  /** Column whose value identifies the row, for updating rather than duplicating. */
  naturalKey: string;
}

export const TARGETS: ImportTarget[] = [
  {
    id: "inventory_sku",
    label: "Stock items",
    blurb: "Your product or item master — one row per thing you hold.",
    table: "inventory_sku",
    module: "inventory",
    naturalKey: "sku",
    fields: [
      { key: "sku", label: "Item code", kind: "text", required: true,
        aliases: ["sku", "item code", "item no", "item number", "material", "part no",
                  "part number", "product code", "stock code", "article"] },
      { key: "name", label: "Description", kind: "text", required: true,
        aliases: ["description", "name", "item name", "product name", "material description"] },
      { key: "category", label: "Category", kind: "text",
        aliases: ["category", "group", "product group", "class", "family", "type"] },
      // The specific names come first so a file carrying both "Qty On Hand"
      // and a bare "Quantity" puts each in the right place.
      { key: "quantity_on_hand", label: "On hand", kind: "integer",
        aliases: ["on hand", "qty on hand", "quantity on hand", "stock", "soh",
                  "available stock", "unrestricted", "quantity", "qty"] },
      { key: "quantity_reserved", label: "Reserved", kind: "integer",
        aliases: ["reserved", "allocated", "committed", "qty reserved"] },
      { key: "reorder_level", label: "Reorder level", kind: "integer",
        aliases: ["reorder level", "reorder point", "min", "minimum", "safety stock", "rop"] },
      { key: "reorder_quantity", label: "Reorder quantity", kind: "integer",
        aliases: ["reorder qty", "reorder quantity", "order quantity", "eoq", "max"] },
      { key: "unit_cost", label: "Unit cost", kind: "number",
        aliases: ["unit cost", "cost", "standard cost", "avg cost", "moving average"] },
      { key: "unit_price", label: "Unit price", kind: "number",
        aliases: ["unit price", "price", "sell price", "list price"] },
      { key: "warehouse_location", label: "Location", kind: "text",
        aliases: ["location", "bin", "aisle", "storage", "storage location", "slot"] },
      { key: "supplier", label: "Supplier", kind: "text",
        aliases: ["supplier", "vendor", "manufacturer", "source"],
        help: "Used to group shortages into one order per supplier." },
    ],
  },
  {
    id: "inventory_movement",
    label: "Stock movements",
    blurb: "Goods in and out — the transaction or movement history.",
    table: "inventory_movement",
    module: "inventory",
    naturalKey: "reference",
    fields: [
      { key: "sku", label: "Item code", kind: "text", required: true,
        aliases: ["sku", "item code", "item no", "material", "part no", "product code", "stock code"],
        help: "Matched against stock items already loaded." },
      { key: "date", label: "Date", kind: "date", required: true,
        aliases: ["date", "posting date", "movement date", "transaction date", "document date"] },
      { key: "type", label: "Direction", kind: "enum", required: true,
        aliases: ["type", "movement type", "direction", "transaction type", "in/out"],
        values: {
          inbound: ["inbound", "in", "receipt", "received", "goods receipt", "gr", "purchase", "+"],
          outbound: ["outbound", "out", "issue", "issued", "despatch", "dispatch", "shipment",
                     "goods issue", "gi", "sale", "delivery", "-"],
          adjustment: ["adjustment", "adjust", "correction", "count", "stocktake", "variance"],
        },
        help: "Outbound movements are what the run-out forecast is built from." },
      { key: "quantity", label: "Quantity", kind: "integer", required: true,
        aliases: ["quantity", "qty", "amount", "units", "movement qty"] },
      { key: "reference", label: "Reference", kind: "text",
        aliases: ["reference", "ref", "document", "doc no", "order no", "transaction id"],
        help: "Stops the same file being counted twice if it is loaded again." },
    ],
  },
  {
    id: "fleet_vehicle",
    label: "Vehicles",
    blurb: "Your fleet list — one row per vehicle, trailer or unit.",
    table: "fleet_vehicle",
    module: "fleet",
    naturalKey: "name",
    fields: [
      { key: "name", label: "Vehicle name", kind: "text", required: true,
        aliases: ["name", "vehicle", "unit", "asset", "vehicle name", "description", "fleet no"] },
      { key: "type", label: "Type", kind: "text", required: true,
        aliases: ["type", "vehicle type", "class", "category", "body type", "asset type"] },
      { key: "license_plate", label: "Registration", kind: "text",
        aliases: ["registration", "reg", "plate", "licence plate", "license plate", "number plate"] },
      { key: "fuel_type", label: "Fuel", kind: "text",
        aliases: ["fuel", "fuel type", "energy"] },
      { key: "mileage", label: "Odometer", kind: "integer",
        aliases: ["odometer", "mileage", "km", "kilometres", "miles", "distance"] },
      { key: "status", label: "Status", kind: "enum",
        aliases: ["status", "state", "condition"],
        values: {
          active: ["active", "in service", "operational", "available", "on road"],
          maintenance: ["maintenance", "workshop", "service", "repair", "vor", "off road"],
          inactive: ["inactive", "idle", "parked", "unavailable"],
          retired: ["retired", "sold", "disposed", "scrapped"],
        } },
      { key: "purchase_date", label: "Purchase date", kind: "date",
        aliases: ["purchase date", "acquired", "in service date", "registration date"] },
    ],
  },
  {
    id: "fleet_trip",
    label: "Trips",
    blurb: "Journey history from telematics or a dispatch system.",
    table: "fleet_trip",
    module: "fleet",
    naturalKey: "reference",
    fields: [
      { key: "vehicle", label: "Vehicle", kind: "text", required: true,
        aliases: ["vehicle", "unit", "asset", "vehicle name", "fleet no", "registration"],
        help: "Matched against vehicles already loaded." },
      { key: "date", label: "Date", kind: "date", required: true,
        aliases: ["date", "trip date", "start date", "departure", "start time"] },
      { key: "miles_driven", label: "Distance", kind: "number", required: true,
        aliases: ["distance", "miles", "km", "kilometres", "mileage", "trip distance"] },
      { key: "fuel_used", label: "Fuel used", kind: "number",
        aliases: ["fuel", "fuel used", "litres", "liters", "gallons", "consumption"] },
      { key: "origin", label: "From", kind: "text",
        aliases: ["origin", "from", "start location", "departure", "source", "depot"],
        help: "Used to work out which vehicles serve which site." },
      { key: "destination", label: "To", kind: "text",
        aliases: ["destination", "to", "end location", "arrival", "delivery point"] },
    ],
  },
];

/** Normalises a header for comparison — case, spaces, punctuation, units. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")        // "Quantity (EA)" → "Quantity"
    .replace(/[_\-./]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Suggests a column for each field. Exact alias match beats a contained match,
 * so a file with both "Qty" and "Qty On Hand" puts each in the right place
 * rather than whichever appeared first.
 */
export function autoMap(target: ImportTarget, headers: string[]): Record<string, number> {
  const normed = headers.map(norm);
  const out: Record<string, number> = {};
  const taken = new Set<number>();

  for (const pass of ["exact", "contains"] as const) {
    for (const f of target.fields) {
      if (out[f.key] !== undefined) continue;
      for (const alias of f.aliases) {
        const a = norm(alias);
        const idx = normed.findIndex((h, i) =>
          !taken.has(i) && (pass === "exact" ? h === a : h.includes(a))
        );
        if (idx > -1) {
          out[f.key] = idx;
          taken.add(idx);
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Maps a raw cell onto one of an enum field's accepted values.
 *
 * The literal comparison runs first because some systems write the direction
 * as a bare "+" or "-", and normalising strips punctuation to nothing.
 * Returns null rather than a guess — an unrecognised movement type is shown
 * to the operator, never quietly filed as inbound.
 */
export function matchEnum(field: TargetField, raw: string): string | null {
  if (!field.values) return null;
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const v = norm(trimmed);

  for (const [key, accepted] of Object.entries(field.values)) {
    if (v && v === key) return key;
    for (const a of accepted) {
      if (trimmed.toLowerCase() === a.toLowerCase()) return key;
      const na = norm(a);
      if (na && v && v === na) return key;
    }
  }
  return null;
}
