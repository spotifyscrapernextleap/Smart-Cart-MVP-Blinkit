/**
 * Phase 11 — link liveness check.
 *
 * Automates the first and most important item on the panel spec's §8
 * checklist: *"do this first and in an incognito window, signed out of
 * Google"*. This process carries no Google or Miro cookies, so every request
 * here **is** a signed-out request — the same view an evaluator gets.
 *
 * Separate from `verify_docs_panel.ts` because it makes real network calls:
 * that suite must stay offline and instant, and this one must be re-runnable
 * on its own before any submission.
 *
 * A 200 is necessary but not sufficient. Google serves a 200 for its "Request
 * access" interstitial, so the response body is inspected too, and a document
 * is only reported public if its real title comes back.
 *
 * Run:  node phases/phase-11-docs-panel/check_links.ts
 */

// Plain-JS config, byte-identical across both apps by design (spec §2).
// `allowJs` is on, so its shape is still inferred.
import { DISCLAIMER } from "../../src/disclaimer.config.js";

interface DocLink {
  label: string;
  url: string;
  type?: string;
}
interface DocGroup {
  links: DocLink[];
}

const links: DocLink[] = (DISCLAIMER.groups as DocGroup[]).flatMap((g) => g.links);

type Verdict = "PUBLIC" | "BLOCKED" | "UNVERIFIABLE" | "ERROR";

interface Result {
  link: DocLink;
  status: number | string;
  verdict: Verdict;
  detail: string;
}

async function probe(link: DocLink): Promise<Result> {
  let res: Response;
  try {
    res = await fetch(link.url, { redirect: "follow" });
  } catch (err) {
    return {
      link,
      status: "—",
      verdict: "ERROR",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const finalUrl = res.url || link.url;

  // A redirect to a login screen is the unambiguous failure.
  if (/accounts\.google\.com|ServiceLogin|miro\.com\/(login|signup)/i.test(finalUrl)) {
    return { link, status: res.status, verdict: "BLOCKED", detail: "redirected to sign-in" };
  }
  if (res.status === 404) {
    return { link, status: 404, verdict: "BLOCKED", detail: "not found" };
  }
  if (!res.ok) {
    return { link, status: res.status, verdict: "BLOCKED", detail: `HTTP ${res.status}` };
  }

  const body = await res.text();

  if (/request access|you need permission|need access to/i.test(body)) {
    return { link, status: res.status, verdict: "BLOCKED", detail: "request-access wall" };
  }

  const title = body.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";

  // Google renders the document's real title into public HTML. Miro is a SPA
  // whose server HTML is byte-identical whether the board is public or not, so
  // it genuinely cannot be settled from here — say so rather than guess.
  if (/miro\.com/i.test(link.url)) {
    return {
      link,
      status: res.status,
      verdict: "UNVERIFIABLE",
      detail: "SPA — server HTML is the same either way; check by hand in incognito",
    };
  }

  if (title && !/^(sign in|google (docs|sheets|slides))$/i.test(title)) {
    return { link, status: res.status, verdict: "PUBLIC", detail: `title: "${title}"` };
  }

  return {
    link,
    status: res.status,
    verdict: "UNVERIFIABLE",
    detail: title ? `generic title: "${title}"` : "no title in response",
  };
}

const ICON: Record<Verdict, string> = {
  PUBLIC: "OK  ",
  BLOCKED: "FAIL",
  UNVERIFIABLE: "??  ",
  ERROR: "ERR ",
};

console.log(`\nChecking ${links.length} links, signed out (no cookies sent).\n`);

const results = await Promise.all(links.map(probe));

for (const r of results) {
  console.log(`${ICON[r.verdict]} ${r.link.label}`);
  console.log(`     ${r.link.url}`);
  console.log(`     ${r.status}  ${r.verdict}  — ${r.detail}\n`);
}

const blocked = results.filter((r) => r.verdict === "BLOCKED" || r.verdict === "ERROR");
const manual = results.filter((r) => r.verdict === "UNVERIFIABLE");

console.log(
  `${results.length - blocked.length - manual.length}/${results.length} confirmed public` +
    (manual.length ? `, ${manual.length} need a manual incognito check` : "") +
    (blocked.length ? `, ${blocked.length} BLOCKED` : ""),
);

if (manual.length) {
  console.log("\nCheck these by hand in an incognito window:");
  for (const r of manual) console.log(`  - ${r.link.label}: ${r.link.url}`);
}

if (blocked.length) {
  console.log("\nA private link inside a fix-it panel is worse than no panel. Fix these:");
  for (const r of blocked) console.log(`  - ${r.link.label}: ${r.detail}`);
  process.exitCode = 1;
}
