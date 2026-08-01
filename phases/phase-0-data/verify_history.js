/**
 * verify_history.js — the build spec's Phase 0.3 test.
 *
 * Loads history.json, catalogue.json and tiles.json, classifies every tile the
 * way the recommender will, and asserts the persona has the shape the panel
 * needs. Prints a table and exits non-zero if any required condition fails.
 *
 * Usage:  node phases/phase-0-data/verify_history.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", p), "utf8"));

const catalogue = read("catalogue.json");
const tiles = read("tiles.json");
const history = read("history.json");

// Mirrors src/lib/config.ts. Phase 1 writes the real constants; this test runs
// before that file exists, so the values are restated here on purpose.
const DORMANCY_THRESHOLD_DAYS = 30;
const TENURE_MIN_DAYS = 180;

const byId = new Map(catalogue.map((p) => [p.id, p]));

const stats = new Map(tiles.map((t) => [t.id, { orders: 0, items: 0, recent: null }]));
const ownedProductIds = new Set();
let unknownIds = 0;

for (const order of history.orders) {
  const touched = new Set();
  for (const item of order.items) {
    const product = byId.get(item.productId);
    if (!product) {
      unknownIds += 1;
      continue;
    }
    ownedProductIds.add(product.id);
    const s = stats.get(product.tile);
    s.items += 1;
    touched.add(product.tile);
  }
  for (const tile of touched) {
    const s = stats.get(tile);
    s.orders += 1;
    if (s.recent === null || order.daysAgo < s.recent) s.recent = order.daysAgo;
  }
}

const classify = (s) => {
  if (s.orders === 0) return "never-bought";
  if (s.recent >= DORMANCY_THRESHOLD_DAYS) return "dormant";
  return "active";
};

const rows = tiles.map((t) => ({ tile: t, s: stats.get(t.id), cls: classify(stats.get(t.id)) }));

console.log("tile                      class          orders  items  mostRecentDaysAgo");
console.log("-".repeat(76));
for (const { tile, s, cls } of rows) {
  console.log(
    tile.id.padEnd(25) +
      cls.padEnd(15) +
      String(s.orders).padStart(5) +
      String(s.items).padStart(7) +
      (s.recent === null ? "       —" : String(s.recent).padStart(8))
  );
}

const active = rows.filter((r) => r.cls === "active");
const dormant = rows.filter((r) => r.cls === "dormant");
const never = rows.filter((r) => r.cls === "never-bought");

// Durables the persona owns, grouped by tile — these must be excluded from
// dormant candidates, and the rule is only observable if some exist.
const ownedDurablesByTile = {};
for (const id of ownedProductIds) {
  const p = byId.get(id);
  if (!p.isConsumable) (ownedDurablesByTile[p.tile] ||= []).push(p);
}

// A lapsed staple: a consumable in a dormant tile bought in 3+ separate orders.
const buyCounts = new Map();
for (const order of history.orders) {
  for (const item of order.items) {
    buyCounts.set(item.productId, (buyCounts.get(item.productId) || 0) + 1);
  }
}
const dormantIds = new Set(dormant.map((r) => r.tile.id));
const lapsedStaples = [...buyCounts.entries()]
  .filter(([id, n]) => n >= 3 && byId.has(id) && byId.get(id).isConsumable && dormantIds.has(byId.get(id).tile))
  .map(([id, n]) => ({ p: byId.get(id), n }));

// "Bought once, then re-bought after a gap" reads as an Adopter, not a Dabbler.
const adopterPattern = [];
for (const t of tiles) {
  const days = history.orders
    .filter((o) => o.items.some((i) => byId.has(i.productId) && byId.get(i.productId).tile === t.id))
    .map((o) => o.daysAgo)
    .sort((a, b) => a - b);
  if (days.length < 2) continue;
  const gaps = days.slice(1).map((d, i) => d - days[i]);
  const span = days[days.length - 1] - days[0];
  const maxGap = Math.max(...gaps);
  if (maxGap > 60 && maxGap > span * 0.6) adopterPattern.push({ tile: t.id, days, maxGap });
}

console.log("\n" + "=".repeat(76));
const checks = [];
const check = (label, pass, detail) => {
  checks.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
};

check("every history productId exists in the catalogue", unknownIds === 0,
  unknownIds ? `${unknownIds} unknown` : "");
check("accountAgeDays clears the tenure gate", history.user.accountAgeDays >= TENURE_MIN_DAYS,
  `${history.user.accountAgeDays} >= ${TENURE_MIN_DAYS}`);
check("5–6 active tiles", active.length >= 5 && active.length <= 6, `${active.length}`);
check("active tiles all ordered within 7 days", active.every((r) => r.s.recent <= 7),
  `max ${Math.max(...active.map((r) => r.s.recent))} daysAgo`);
check("3–4 dormant tiles", dormant.length >= 3 && dormant.length <= 4, `${dormant.length}`);
check("dormant tiles lapsed between 35 and 120 days",
  dormant.every((r) => r.s.recent >= 35 && r.s.recent <= 120),
  dormant.map((r) => `${r.tile.id}:${r.s.recent}`).join(", "));
check("every remaining tile is never-bought",
  active.length + dormant.length + never.length === tiles.length, `${never.length} never-bought`);
check("a dormant tile contains a durable the persona owns",
  dormant.some((r) => (ownedDurablesByTile[r.tile.id] || []).length > 0),
  Object.entries(ownedDurablesByTile)
    .filter(([t]) => dormantIds.has(t))
    .map(([t, ps]) => `${t}: ${ps.map((p) => p.id).join("/")}`)
    .join("; ") || "none");
check("a dormant tile contains a repeatedly-bought lapsed consumable",
  lapsedStaples.length > 0,
  lapsedStaples.map((x) => `${x.p.id} x${x.n} (${x.p.tile})`).slice(0, 3).join(", ") || "none");
check("no tile shows the Adopter buy-once-then-return pattern", adopterPattern.length === 0,
  adopterPattern.map((a) => `${a.tile} gap ${a.maxGap}d`).join(", "));
check("~40 orders", history.orders.length >= 30 && history.orders.length <= 50,
  `${history.orders.length}`);
check("~200 line items",
  (() => { const n = history.orders.reduce((a, o) => a + o.items.length, 0); return n >= 150 && n <= 260; })(),
  `${history.orders.reduce((a, o) => a + o.items.length, 0)}`);

console.log("\nowned durables in dormant tiles (must be excluded from candidates):");
for (const [tile, ps] of Object.entries(ownedDurablesByTile)) {
  if (!dormantIds.has(tile)) continue;
  for (const p of ps) console.log(`  ${p.id}  rank ${p.bestsellerRank}  Rs${p.price}  ${p.name.slice(0, 46)}`);
}

const failed = checks.filter((c) => !c).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
