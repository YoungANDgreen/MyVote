/**
 * IRS SOI ingest + local rarity factors (require DATABASE_URL).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { sql as pg, db } from "../src/db/client";
import { countyTax, geoSpending } from "../src/db/schema";
import { ingestSoi, parseCsv } from "../pipelines/ingest-soi";
import { ingestGeoSpending } from "../pipelines/ingest-geo-spending";
import { fixtureFetcher, fixtureTextFetcher } from "../pipelines/lib/fixtures";
import { computeLocalFactors } from "../src/rarity/local";
import { computeRarity } from "../src/rarity/engine";

beforeAll(async () => {
  await db.delete(countyTax);
  await db.delete(geoSpending);
});

afterAll(async () => {
  await pg.end();
});

describe("parseCsv", () => {
  it("handles quoted fields containing commas", () => {
    const rows = parseCsv('A,B\n"x, y",2\n');
    expect(rows).toEqual([{ A: "x, y", B: "2" }]);
  });
});

describe("ingest:soi", () => {
  it("ingests county totals, skips state-total rows, idempotent", async () => {
    const first = await ingestSoi(2022, fixtureTextFetcher);
    expect(first.counties).toBe(10);
    expect(first.skippedStateTotals).toBe(1);

    await ingestSoi(2022, fixtureTextFetcher);
    expect(await db.$count(countyTax)).toBe(10);
  });

  it("builds 5-digit FIPS that joins to geo_spending county ids", async () => {
    const [maricopa] = await db
      .select()
      .from(countyTax)
      .where(and(eq(countyTax.countyFips, "04013"), eq(countyTax.taxYear, 2022)));
    expect(maricopa.countyName).toBe("Maricopa County");
    expect(Number(maricopa.incomeTaxThousands)).toBe(22_500_000);
  });
});

describe("local rarity factors (the full join)", () => {
  it("computes return-per-$100 and inflow percentile from both tables", async () => {
    await ingestGeoSpending(2025, ["county"], fixtureFetcher);
    const geoRows = (await db.select().from(geoSpending))
      .filter((r) => r.geoLayer === "county")
      .map((r) => ({
        geoId: r.geoId,
        amount: Number(r.amount),
        perCapita: r.perCapita === null ? null : Number(r.perCapita),
      }));
    const taxRows = (await db.select().from(countyTax)).map((r) => ({
      countyFips: r.countyFips,
      returns: r.returns,
      incomeTaxThousands: Number(r.incomeTaxThousands),
    }));

    // Los Alamos: $5.4B inflow vs $182M tax paid → massive return ratio + top percentile
    const losAlamos = computeLocalFactors("35028", geoRows, taxRows);
    expect(losAlamos.returnPer100).toBeGreaterThan(1000);
    expect(losAlamos.inflowPercentile).toBeGreaterThan(0.9);

    // Maricopa: $31.2B inflow vs $22.5B tax → middling, ordinary
    const maricopa = computeLocalFactors("04013", geoRows, taxRows);
    expect(maricopa.returnPer100).toBeGreaterThan(100);
    expect(maricopa.returnPer100).toBeLessThan(200);

    // and they feed straight into the rarity engine with sensible ordering
    const laCard = computeRarity({
      taxPercentile: 0.5,
      localInflowPercentile: losAlamos.inflowPercentile,
      localReturnPer100: losAlamos.returnPer100,
    });
    const mcCard = computeRarity({
      taxPercentile: 0.5,
      localInflowPercentile: maricopa.inflowPercentile,
      localReturnPer100: maricopa.returnPer100,
    });
    expect(laCard.score).toBeGreaterThan(mcCard.score);
    expect(["Rare", "Epic", "Legendary"]).toContain(laCard.tier);
  });

  it("fails loudly when a county is missing from either side", () => {
    expect(() => computeLocalFactors("99999", [], [])).toThrow(/geo_spending/);
  });
});
