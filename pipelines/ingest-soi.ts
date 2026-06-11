/**
 * ingest:soi — IRS Statistics of Income, county-level totals: returns filed,
 * AGI, and income tax paid per county. The "dollars IN" half of the local
 * return-per-$100 ratio (docs/local-spending-data.md Tier 2).
 *
 * Source: https://www.irs.gov/pub/irs-soi/{yy}incyallnoagi.csv — one row per
 * county, totals across all AGI bands. Static annual file, no key.
 *
 * ⚠ VERIFY-AT-FIRST-RUN (built offline; irs.gov blocked in sandbox):
 *  - latest available vintage (run with --year=YYYY)
 *  - column names in FIELDS below. A06500 = income tax after credits; if the
 *    vintage lacks it, A10300 (total tax liability) is the fallback — switch
 *    deliberately, it changes the ratio's meaning slightly.
 * County FIPS is stored as 5 digits (state+county) and joins directly to
 * geo_spending.geo_id for the county layer.
 */
import "dotenv/config";
import { db, sql } from "../src/db/client";
import { countyTax } from "../src/db/schema";
import { liveTextFetcher, TextFetcher } from "./lib/http";
import { pickTextFetcher } from "./lib/fixtures";

const FIELDS = {
  stateFips: "STATEFIPS",
  state: "STATE",
  countyFips: "COUNTYFIPS",
  countyName: "COUNTYNAME",
  returns: "N1",
  agiThousands: "A00100",
  incomeTaxThousands: "A06500",
};

/** Minimal CSV parser (handles quoted fields with commas). */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const header = parseLine(lines[0]).map((h) => h.trim().toUpperCase());
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? "").trim()]));
  });
}

export async function ingestSoi(
  taxYear: number,
  fetcher: TextFetcher = liveTextFetcher,
): Promise<{ taxYear: number; counties: number; skippedStateTotals: number }> {
  const yy = String(taxYear % 100).padStart(2, "0");
  const csv = await fetcher(`https://www.irs.gov/pub/irs-soi/${yy}incyallnoagi.csv`);
  const rows = parseCsv(csv);
  if (rows.length === 0) throw new Error("SOI CSV parsed to zero rows");

  const missing = Object.values(FIELDS).filter((f) => !(f in rows[0]));
  if (missing.length) {
    throw new Error(
      `SOI CSV missing expected columns: ${missing.join(", ")}. ` +
        `Actual columns: ${Object.keys(rows[0]).join(", ")}. Adjust FIELDS in ingest-soi.ts.`,
    );
  }

  let counties = 0;
  let skippedStateTotals = 0;
  for (const row of rows) {
    const countyPart = row[FIELDS.countyFips].padStart(3, "0");
    if (countyPart === "000") {
      skippedStateTotals++; // state-total rows
      continue;
    }
    const fips = row[FIELDS.stateFips].padStart(2, "0") + countyPart;
    const returns = Number(row[FIELDS.returns]);
    const agi = Number(row[FIELDS.agiThousands]);
    const tax = Number(row[FIELDS.incomeTaxThousands]);
    if (![returns, agi, tax].every(Number.isFinite)) {
      throw new Error(`SOI: non-numeric amounts for county ${fips} (${row[FIELDS.countyName]})`);
    }
    await db
      .insert(countyTax)
      .values({
        taxYear,
        countyFips: fips,
        state: row[FIELDS.state],
        countyName: row[FIELDS.countyName],
        returns,
        agiThousands: agi.toFixed(2),
        incomeTaxThousands: tax.toFixed(2),
      })
      .onConflictDoUpdate({
        target: [countyTax.taxYear, countyTax.countyFips],
        set: {
          state: row[FIELDS.state],
          countyName: row[FIELDS.countyName],
          returns,
          agiThousands: agi.toFixed(2),
          incomeTaxThousands: tax.toFixed(2),
          updatedAt: new Date(),
        },
      });
    counties++;
  }
  return { taxYear, counties, skippedStateTotals };
}

if (typeof require !== "undefined" && require.main === module) {
  const args = new Map(
    process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=") as [string, string]),
  );
  const year = args.has("year") ? Number(args.get("year")) : 2022; // VERIFY latest vintage
  ingestSoi(year, pickTextFetcher(liveTextFetcher))
    .then(async (r) => {
      console.log(
        `✔ SOI ${r.taxYear}: ${r.counties} county rows upserted (${r.skippedStateTotals} state-total rows skipped)`,
      );
      await sql.end();
    })
    .catch(async (err) => {
      console.error("✘ ingest:soi failed:", err.message ?? err);
      await sql.end();
      process.exit(1);
    });
}
