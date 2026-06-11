/**
 * Integration tests — require DATABASE_URL (local Postgres or Neon branch).
 * Verifies the spec §8 hard rule: every ingestion is an idempotent upsert,
 * safe to re-run (run twice → row counts stable).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql as pg, db } from "../src/db/client";
import { fiscalTotals, geoSpending, outlaysByFunction } from "../src/db/schema";
import { ingestOutlays } from "../pipelines/ingest-outlays";
import { ingestGeoSpending } from "../pipelines/ingest-geo-spending";
import { fixtureFetcher } from "../pipelines/lib/fixtures";

beforeAll(async () => {
  await db.delete(outlaysByFunction);
  await db.delete(fiscalTotals);
  await db.delete(geoSpending);
});

afterAll(async () => {
  await pg.end();
});

describe("ingest:outlays", () => {
  it("ingests budget functions + totals and is idempotent", async () => {
    const first = await ingestOutlays(fixtureFetcher);
    expect(first.fiscalYear).toBe(2025);
    expect(first.functions).toBe(20);
    expect(first.totalOutlays).toBe(7_179_000);

    const countAfterFirst = await db.$count(outlaysByFunction);
    await ingestOutlays(fixtureFetcher); // re-run: must not duplicate
    expect(await db.$count(outlaysByFunction)).toBe(countAfterFirst);
    expect(await db.$count(fiscalTotals)).toBe(1);
  });

  it("stored totals reproduce the borrowed-dollar ratio", async () => {
    const [row] = await db.select().from(fiscalTotals);
    const per100 = Math.round((Number(row.totalOutlays) / Number(row.totalReceipts)) * 100);
    expect(per100).toBe(128);
  });
});

describe("ingest:geo", () => {
  it("ingests county + district layers and is idempotent", async () => {
    const first = await ingestGeoSpending(2025, ["county", "district"], fixtureFetcher);
    expect(first.upserted.county).toBe(10);
    expect(first.upserted.district).toBe(6);

    const countAfterFirst = await db.$count(geoSpending);
    await ingestGeoSpending(2025, ["county", "district"], fixtureFetcher);
    expect(await db.$count(geoSpending)).toBe(countAfterFirst);
  });

  it("per-capita inflow supports rarity percentiles (Los Alamos is an outlier)", async () => {
    const rows = await db.select().from(geoSpending);
    const counties = rows.filter((r) => r.geoLayer === "county");
    const losAlamos = counties.find((r) => r.geoId === "35028")!;
    const perCapitas = counties.map((r) => Number(r.perCapita));
    const max = Math.max(...perCapitas);
    expect(Number(losAlamos.perCapita)).toBe(max); // tiny county, giant federal lab
  });
});
