/**
 * ingest:outlays — Outlays by budget function + FY totals, from Treasury
 * Fiscal Data, Monthly Treasury Statement Table 9 ("Summary of Receipts by
 * Source, and Outlays by Function"). Decision record: docs/decisions.md #D2.
 *
 * Strategy: take the latest September (FY-final) MTS, keep rows whose
 * classification matches the canonical OMB budget-function list, take
 * fiscal-year-to-date amounts, and cross-check that functions sum to the
 * reported Total Outlays within 2% — so a field-name or row-shape change in
 * the API fails LOUDLY with diagnostics instead of producing a wrong receipt.
 *
 * VERIFY-AT-FIRST-RUN: built offline against documented response shapes
 * (sandbox blocks the API). If field names differ, the error message lists
 * what actually came back; adjust FIELDS below. All pipeline state lives in
 * Postgres; idempotent upsert, safe to re-run (spec §8 hard rule).
 */
import "dotenv/config";
import { db, sql } from "../src/db/client";
import { fiscalTotals, outlaysByFunction } from "../src/db/schema";
import { normalizeFunctionName } from "../src/receipt/categories";
import { Fetcher, liveFetcher } from "./lib/http";
import { pickFetcher } from "./lib/fixtures";

const BASE = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service";
const DATASET = "/v1/accounting/mts/mts_table_9";

// Single place to adjust if live field names differ.
const FIELDS = {
  fiscalYear: "record_fiscal_year",
  calendarMonth: "record_calendar_month",
  classification: "classification_desc",
  fytdAmount: "fytd_rcpt_outly_amt", // fiscal-year-to-date receipt/outlay amount
};

// Canonical OMB budget-function names (normalized) — the row filter.
const FUNCTION_NAMES = new Map(
  [
    "National Defense",
    "International Affairs",
    "General Science, Space, and Technology",
    "Energy",
    "Natural Resources and Environment",
    "Agriculture",
    "Commerce and Housing Credit",
    "Transportation",
    "Community and Regional Development",
    "Education, Training, Employment, and Social Services",
    "Health",
    "Medicare",
    "Income Security",
    "Social Security",
    "Veterans Benefits and Services",
    "Administration of Justice",
    "General Government",
    "Net Interest",
    "Allowances",
    "Undistributed Offsetting Receipts",
  ].map((n) => [normalizeFunctionName(n), n]),
);

const TOTAL_OUTLAYS = new Set(["total outlays", "total outlays "].map(normalizeFunctionName));
const TOTAL_RECEIPTS = new Set(["total receipts"].map(normalizeFunctionName));
const SUM_TOLERANCE = 0.02;

type Row = Record<string, string>;

export async function ingestOutlays(fetcher: Fetcher = liveFetcher): Promise<{
  fiscalYear: number;
  functions: number;
  totalOutlays: number;
  totalReceipts: number;
}> {
  // 1. Latest FY-final (September) statement.
  const probe = (await fetcher(
    `${BASE}${DATASET}?filter=${FIELDS.calendarMonth}:eq:09&sort=-record_date&page[size]=1`,
  )) as { data?: Row[] };
  const probeRow = probe.data?.[0];
  if (!probeRow) throw new Error("MTS table 9: no September rows returned");
  assertFields(probeRow);
  const fiscalYear = Number(probeRow[FIELDS.fiscalYear]);

  // 2. All rows for that FY's September statement.
  const page = (await fetcher(
    `${BASE}${DATASET}?filter=${FIELDS.fiscalYear}:eq:${fiscalYear},${FIELDS.calendarMonth}:eq:09&page[size]=900`,
  )) as { data?: Row[] };
  const rows = page.data ?? [];
  if (rows.length === 0) throw new Error(`MTS table 9: no rows for FY${fiscalYear} September`);

  // 3. Partition into function rows and totals.
  const functions = new Map<string, number>();
  let totalOutlays: number | undefined;
  let totalReceipts: number | undefined;
  const unmatched: string[] = [];

  for (const row of rows) {
    const norm = normalizeFunctionName(row[FIELDS.classification] ?? "");
    const amount = Number(row[FIELDS.fytdAmount]);
    if (!Number.isFinite(amount)) continue;
    const canonical = FUNCTION_NAMES.get(norm);
    if (canonical) {
      // last write wins if dataset repeats a classification within the statement
      functions.set(canonical, amount);
    } else if (TOTAL_OUTLAYS.has(norm)) {
      totalOutlays = amount;
    } else if (TOTAL_RECEIPTS.has(norm)) {
      totalReceipts = amount;
    } else if (norm) {
      unmatched.push(row[FIELDS.classification]);
    }
  }

  if (totalOutlays === undefined || totalReceipts === undefined) {
    throw new Error(
      `MTS table 9: missing Total Outlays/Total Receipts rows. ` +
        `Classifications seen: ${[...new Set(unmatched)].slice(0, 40).join(" | ")}`,
    );
  }

  // 4. Invariant: functions must sum to reported total outlays.
  const sum = [...functions.values()].reduce((s, v) => s + v, 0);
  if (Math.abs(sum - totalOutlays) / totalOutlays > SUM_TOLERANCE) {
    throw new Error(
      `MTS table 9: function rows sum to ${sum} but Total Outlays is ${totalOutlays} ` +
        `(>${SUM_TOLERANCE * 100}% off). Matched ${functions.size} functions; ` +
        `unmatched classifications: ${[...new Set(unmatched)].slice(0, 40).join(" | ")}`,
    );
  }

  // 5. Idempotent upserts.
  for (const [functionName, outlays] of functions) {
    await db
      .insert(outlaysByFunction)
      .values({
        fiscalYear,
        functionName,
        outlays: outlays.toFixed(2),
        source: `Treasury Fiscal Data MTS Table 9, FY${fiscalYear} September statement`,
      })
      .onConflictDoUpdate({
        target: [outlaysByFunction.fiscalYear, outlaysByFunction.functionName],
        set: { outlays: outlays.toFixed(2), updatedAt: new Date() },
      });
  }
  await db
    .insert(fiscalTotals)
    .values({
      fiscalYear,
      totalReceipts: totalReceipts.toFixed(2),
      totalOutlays: totalOutlays.toFixed(2),
      source: `Treasury Fiscal Data MTS Table 9, FY${fiscalYear} September statement`,
    })
    .onConflictDoUpdate({
      target: fiscalTotals.fiscalYear,
      set: {
        totalReceipts: totalReceipts.toFixed(2),
        totalOutlays: totalOutlays.toFixed(2),
        updatedAt: new Date(),
      },
    });

  return { fiscalYear, functions: functions.size, totalOutlays, totalReceipts };
}

function assertFields(row: Row) {
  const missing = Object.values(FIELDS).filter((f) => !(f in row));
  if (missing.length) {
    throw new Error(
      `MTS table 9: expected fields missing: ${missing.join(", ")}. ` +
        `Actual fields: ${Object.keys(row).join(", ")}. Adjust FIELDS in ingest-outlays.ts.`,
    );
  }
}

if (typeof require !== "undefined" && require.main === module) {
  ingestOutlays(pickFetcher(liveFetcher))
    .then(async (r) => {
      console.log(
        `✔ FY${r.fiscalYear}: ${r.functions} budget functions upserted; ` +
          `outlays ${r.totalOutlays.toLocaleString()} vs receipts ${r.totalReceipts.toLocaleString()} ` +
          `(spent $${Math.round((r.totalOutlays / r.totalReceipts) * 100)} per $100 paid in)`,
      );
      await sql.end();
    })
    .catch(async (err) => {
      console.error("✘ ingest:outlays failed:", err.message ?? err);
      await sql.end();
      process.exit(1);
    });
}
