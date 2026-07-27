/* A stand-in for Samsara.
 *
 * Replies in exactly the shape their published reference documents, so the
 * connector can be proven end to end without an account:
 *
 *   { "data": [ { "id": "...", "name": "...", "vin": "...",
 *                 "licensePlate": "...", "make": "...", "model": "...",
 *                 "year": "..." } ],
 *     "pagination": { "endCursor": "...", "hasNextPage": true } }
 *
 * It deliberately misbehaves in the ways a real API does, because a connector
 * that only works against a polite server is not finished:
 *   - rejects a missing or wrong token with 401
 *   - pages, so the cursor logic is actually exercised
 *   - includes one vehicle with no id, to prove bad rows are skipped and
 *     reported rather than silently dropped
 *
 * Run: node supabase/seed/fake-samsara.js
 * Then point a connection's base URL at http://localhost:4599
 */

const http = require("http");

const PORT = Number(process.env.PORT || 4599);
const TOKEN = process.env.FAKE_SAMSARA_TOKEN || "test-token";
const TOTAL = Number(process.env.FAKE_SAMSARA_VEHICLES || 47);

const MAKES = [
  ["Freightliner", "Cascadia"],
  ["Volvo", "VNL 760"],
  ["Kenworth", "T680"],
  ["Ford", "Transit"],
  ["Mercedes-Benz", "Sprinter"],
  ["Peterbilt", "579"],
  ["Isuzu", "NPR"],
];

/** Deterministic, so a second run produces the same fleet. */
function vehicle(i) {
  const [make, model] = MAKES[i % MAKES.length];
  return {
    id: String(212014918732717n + BigInt(i)),
    name: `${make} ${String(101 + i)}`,
    vin: `1FUJGLD${String(10000000 + i * 7919).slice(0, 8)}`,
    licensePlate: `AB${String(10000 + i * 13).slice(0, 5)}`,
    serial: `GCKT9ZM${String(i).padStart(3, "0")}`,
    make,
    model,
    year: String(2016 + (i % 9)),
    harshAccelerationSettingType: "automatic",
    notes: "",
    externalIds: { "samsara.serial": `GCKT9ZM${String(i).padStart(3, "0")}` },
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Invalid API token." }));
    console.log(`  401  ${url.pathname}  (bad or missing token)`);
    return;
  }

  if (url.pathname !== "/fleet/vehicles") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Not found." }));
    return;
  }

  const limit = Math.min(Number(url.searchParams.get("limit") || 512), 512);
  const after = Number(url.searchParams.get("after") || 0);

  const slice = [];
  for (let i = after; i < Math.min(after + limit, TOTAL); i++) {
    slice.push(vehicle(i));
  }

  // One malformed row, once, on the first page. A real feed always has one.
  if (after === 0 && slice.length > 3) {
    slice.splice(2, 0, { name: "Vehicle with no id", make: "Unknown" });
  }

  const nextIndex = after + limit;
  const hasNextPage = nextIndex < TOTAL;

  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      data: slice,
      pagination: {
        endCursor: hasNextPage ? String(nextIndex) : "",
        hasNextPage,
      },
    })
  );

  console.log(
    `  200  /fleet/vehicles  limit=${limit} after=${after}  ` +
      `→ ${slice.length} rows, hasNextPage=${hasNextPage}`
  );
});

server.listen(PORT, () => {
  console.log(`Stand-in Samsara listening on http://localhost:${PORT}`);
  console.log(`  token    ${TOKEN}`);
  console.log(`  vehicles ${TOTAL}`);
  console.log(`  endpoint GET /fleet/vehicles`);
});
