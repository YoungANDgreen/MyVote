import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Fetcher, TextFetcher } from "./http";

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

/** Text-resource fixtures (YAML / XML / CSV pipelines). */
const TEXT_ROUTES: [RegExp, (url: string) => string][] = [
  [/legislators-current\.yaml/, () => "legislators-current.yaml"],
  [/clerk\.house\.gov\/evs\/(\d+)\/roll(\d+)\.xml/, (u) => {
    const m = u.match(/evs\/(\d+)\/roll(\d+)\.xml/)!;
    return `house_${m[1]}_roll${m[2]}.xml`;
  }],
  [/senate\.gov.*vote_(\d+)_(\d+)_(\d+)\.xml/, (u) => {
    const m = u.match(/vote_(\d+)_(\d+)_(\d+)\.xml/)!;
    return `senate_${m[1]}_${m[2]}_${m[3]}.xml`;
  }],
  [/irs\.gov\/pub\/irs-soi\/(\d+)incyallnoagi\.csv/, (u) => {
    const m = u.match(/(\d+)incyallnoagi\.csv/)!;
    return `soi_${m[1]}_county.csv`;
  }],
];

export const fixtureTextFetcher: TextFetcher = async (url) => {
  for (const [pattern, file] of TEXT_ROUTES) {
    if (pattern.test(url)) return readFileSync(join(FIXTURE_DIR, file(url)), "utf8");
  }
  throw new Error(`No text fixture for URL: ${url}`);
};

export function pickTextFetcher(live: TextFetcher): TextFetcher {
  return process.env.PIPELINE_FIXTURES === "1" ? fixtureTextFetcher : live;
}
