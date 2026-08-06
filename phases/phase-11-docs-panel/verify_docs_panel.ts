/**
 * Phase 11 test — supporting documents panel config.
 *
 * The panel itself is DOM behaviour and is verified in the browser. What is
 * unit-testable, and what actually sinks a submission, is the **config**: a
 * surviving `REPLACE ME`, a link that 404s, or a personal name in the copy are
 * all invisible in code review and fatal in front of an evaluator.
 *
 * Link liveness is checked separately by `check_links.ts`, because it makes
 * real network calls and this suite must stay offline and instant.
 *
 * Run:  node phases/phase-11-docs-panel/verify_docs_panel.ts
 */

// Plain-JS config, byte-identical across both apps by design (spec §2).
// `allowJs` is on, so its shape is still inferred.
import { DISCLAIMER, TYPE_LABELS } from "../../src/disclaimer.config.js";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${label}${detail ? `  — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${label}${detail ? `  — ${detail}` : ""}`);
  }
}

interface DocLink {
  label: string;
  url: string;
  type?: string;
  description?: string;
}
interface DocGroup {
  heading?: string;
  links: DocLink[];
}

const groups = DISCLAIMER.groups as DocGroup[];
const notes = DISCLAIMER.note as string[];
const allLinks: DocLink[] = groups.flatMap((g) => g.links);

/**
 * Every string an evaluator can read in the panel. The name check has to run
 * over all of it, not just the note — a label or a description would leak just
 * as effectively.
 */
const visibleCopy = [
  DISCLAIMER.title,
  ...notes,
  DISCLAIMER.footerNote ?? "",
  ...groups.map((g) => g.heading ?? ""),
  ...allLinks.flatMap((l) => [l.label, l.description ?? "", l.url]),
].join("\n");

// ---------------------------------------------------------------------------
console.log("\n-- no placeholder survived --------------------------------------------");
{
  check(
    "no REPLACE ME anywhere in the config",
    !/REPLACE\s*ME|REPLACE\.ME/i.test(visibleCopy),
  );
  check("the title is set", typeof DISCLAIMER.title === "string" && DISCLAIMER.title.length > 0);
  check(
    "the title fits on one line at 560px (spec: under ~60 chars)",
    DISCLAIMER.title.length <= 60,
    `${DISCLAIMER.title.length} chars`,
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- the note ------------------------------------------------------------");
{
  check("the note has at least one paragraph", notes.length >= 1);
  check(
    "the note is at most 2 paragraphs (spec: more pushes links below the fold)",
    notes.length <= 2,
    `${notes.length}`,
  );
  check(
    "every paragraph is non-empty",
    notes.every((p) => typeof p === "string" && p.trim().length > 0),
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- NO PERSONAL NAME (spec non-negotiable #6) ---------------------------");
{
  // Taken from this repo's git author identity. If the fellow's name has
  // another form, add it here — this check is only as good as its list.
  const FORBIDDEN = ["dhairya", "bansal", "dhairyabansal"];
  const hits = FORBIDDEN.filter((n) => visibleCopy.toLowerCase().includes(n));
  check(
    "no personal name in any visible string or URL",
    hits.length === 0,
    hits.length ? `FOUND: ${hits.join(", ")}` : `checked ${FORBIDDEN.length} forms`,
  );

  check(
    "no email address in the copy",
    !/[\w.+-]+@[\w-]+\.[\w.]+/.test(visibleCopy),
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- every link is well formed -------------------------------------------");
{
  check("there is at least one link", allLinks.length > 0, `${allLinks.length} links`);

  for (const link of allLinks) {
    const name = link.label || "(unlabelled)";

    check(`${name}: has a non-empty label`, typeof link.label === "string" && link.label.trim().length > 0);

    let url: URL | null = null;
    try {
      url = new URL(link.url);
    } catch {
      /* reported by the next check */
    }

    check(`${name}: url is absolute and parseable`, url !== null, link.url);
    check(`${name}: url is https`, url?.protocol === "https:", url?.protocol ?? "?");

    check(
      `${name}: badge resolves to a real label`,
      Boolean(TYPE_LABELS[link.type as keyof typeof TYPE_LABELS]),
      `type "${link.type}" → ${TYPE_LABELS[link.type as keyof typeof TYPE_LABELS] ?? "falls back to Link"}`,
    );

    if (link.description !== undefined) {
      check(
        `${name}: description is one short line (spec: under ~70 chars)`,
        link.description.length <= 70,
        `${link.description.length} chars`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- hygiene -------------------------------------------------------------");
{
  const withTracking = allLinks.filter((l) => /[?&](usp|utm_|share_link_id|tab)=/.test(l.url));
  // share_link_id is functional on Miro share links, so it is reported rather
  // than failed — stripping it risks breaking access for a param we cannot
  // verify is decorative.
  console.log(
    withTracking.length
      ? `NOTE  ${withTracking.length} url(s) carry a query param: ${withTracking.map((l) => l.label).join(", ")}`
      : "NOTE  no query params on any url",
  );

  check(
    "no google url carries ?usp=sharing (spec §2: strip it)",
    !allLinks.some((l) => l.url.includes("google.com") && l.url.includes("usp=sharing")),
  );

  const urls = allLinks.map((l) => l.url);
  check("no duplicate urls", new Set(urls).size === urls.length);

  const labels = allLinks.map((l) => l.label);
  check("no duplicate labels", new Set(labels).size === labels.length);

  check(
    "suppressWithinSession is false (spec: leave false)",
    DISCLAIMER.suppressWithinSession === false,
    String(DISCLAIMER.suppressWithinSession),
  );
}

// ---------------------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} checks passed`);
if (failed > 0) process.exitCode = 1;
