import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Fetcher } from "./http";

// cwd-relative: npm scripts and vitest both run from the repo root
const FIXTURE_DIR = join(process.cwd(), "pipelines", "fixtures");

/** URL-pattern → fixture file. Used when PIPELINE_FIXTURES=1 and in tests. */
const ROUTES: [RegExp, string][] = [
  [/fiscaldata\.treasury\.gov.*mts_table_9/, "mts_table_9.json"],
  [/api\.usaspending\.gov.*spending_by_geography/, ""], // resolved by body, below
];

export const fixtureFetcher: Fetcher = async (url, init) => {
  if (/spending_by_geography/.test(url)) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const file = `usaspending_${body.geo_layer}.json`;
    return JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8"));
  }
  for (const [pattern, file] of ROUTES) {
    if (pattern.test(url) && file) {
      return JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8"));
    }
  }
  throw new Error(`No fixture for URL: ${url}`);
};

export function pickFetcher(live: Fetcher): Fetcher {
  return process.env.PIPELINE_FIXTURES === "1" ? fixtureFetcher : live;
}
