/**
 * ingest:geo — Federal award spending flowing INTO each county / congressional
 * district / state, from USAspending `spending_by_geography` (recipient
 * location). This is the "local spending" layer: powers the county card (P1)
 * and the rarity engine's local-inflow percentiles.
 *
 * Coverage caveat (display copy must reflect this): award data = contracts,
 * grants, direct payments, loans. It does NOT include interest on the debt,
 * federal employee compensation, or classified spending — it is "federal money
 * flowing into [County]", not "your county's share of the budget".
 *
 * Usage: npm run ingest:geo -- --fy=2025 --layers=county,district,state
 * Defaults: latest complete fiscal year, county+district.
 * Idempotent upsert; all state in Postgres (spec §8 hard rule).
 */
import "dotenv/config";
import { db, sql } from "../src/db/client";
import { geoSpending } from "../src/db/schema";
import { Fetcher, liveFetcher, postInit } from "./lib/http";
import { pickFetcher } from "./lib/fixtures";

const URL = "https://api.usaspending.gov/api/v2/search/spending_by_geography/";
export type GeoLayer = "state" | "county" | "district";

interface GeoResult {
  shape_code: string;
  display_name: string;
  aggregated_amount: number;
  population?: number | null;
  per_capita?: number | null;
}

/** Latest complete federal fiscal year (FY ends Sep 30). */
export function latestCompleteFY(today = new Date()): number {
  const y = today.getUTCFullYear();
  return today.getUTCMonth() >= 9 ? y : y - 1; // month 9 = October
}

export async function ingestGeoSpending(
  fiscalYear: number,
  layers: GeoLayer[],
  fetcher: Fetcher = liveFetcher,
): Promise<{ fiscalYear: number; upserted: Record<string, number> }> {
  const upserted: Record<string, number> = {};

  for (const layer of layers) {
    const body = {
      scope: "recipient_location",
      geo_layer: layer,
      filters: {
        time_period: [
          { start_date: `${fiscalYear - 1}-10-01`, end_date: `${fiscalYear}-09-30` },
        ],
      },
    };
    const res = (await fetcher(URL, postInit(body))) as { results?: GeoResult[] };
    const results = res.results ?? [];
    if (results.length === 0) {
      throw new Error(`USAspending returned no ${layer} results for FY${fiscalYear}`);
    }

    for (const r of results) {
      if (!r.shape_code || !Number.isFinite(r.aggregated_amount)) continue;
      await db
        .insert(geoSpending)
        .values({
          fiscalYear,
          geoLayer: layer,
          geoId: r.shape_code,
          displayName: r.display_name ?? r.shape_code,
          amount: r.aggregated_amount.toFixed(2),
          population: r.population ?? null,
          perCapita: r.per_capita != null ? r.per_capita.toFixed(2) : null,
        })
        .onConflictDoUpdate({
          target: [geoSpending.fiscalYear, geoSpending.geoLayer, geoSpending.geoId],
          set: {
            displayName: r.display_name ?? r.shape_code,
            amount: r.aggregated_amount.toFixed(2),
            population: r.population ?? null,
            perCapita: r.per_capita != null ? r.per_capita.toFixed(2) : null,
            updatedAt: new Date(),
          },
        });
    }
    upserted[layer] = results.length;
  }

  return { fiscalYear, upserted };
}

if (typeof require !== "undefined" && require.main === module) {
  const args = new Map(
    process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=") as [string, string]),
  );
  const fy = args.has("fy") ? Number(args.get("fy")) : latestCompleteFY();
  const layers = (args.get("layers")?.split(",") ?? ["county", "district"]) as GeoLayer[];

  ingestGeoSpending(fy, layers, pickFetcher(liveFetcher))
    .then(async (r) => {
      console.log(
        `✔ FY${r.fiscalYear} geo spending: ` +
          Object.entries(r.upserted)
            .map(([l, n]) => `${n} ${l} rows`)
            .join(", "),
      );
      await sql.end();
    })
    .catch(async (err) => {
      console.error("✘ ingest:geo failed:", err.message ?? err);
      await sql.end();
      process.exit(1);
    });
}
