# Project Receipt

A free, web-first app that shows any American where their federal tax dollars go in plain English, captures their opinion on that spending and key congressional votes, and scores how closely their representatives align with them — with receipts for every claim.

- Full spec: [`docs/spec.md`](docs/spec.md) · Decisions: [`docs/decisions.md`](docs/decisions.md)
- Local-data strategy: [`docs/local-spending-data.md`](docs/local-spending-data.md)
- UI design package (for Claude Design): [`design/claude-design-package.md`](design/claude-design-package.md)

## Stack

Next.js (App Router, TypeScript) · Drizzle ORM · Postgres (Neon in prod, any Postgres for dev) · Vitest. All pipeline state lives in Postgres — no local-filesystem state, every ingestion is an idempotent upsert.

## Setup

```bash
npm install
cp .env.example .env       # set DATABASE_URL (Neon or local Postgres)
npm run db:generate        # only after schema changes
npm run db:migrate
```

## Pipelines

```bash
npm run ingest:members                                   # congress-legislators (live, GitHub raw) → members
npm run ingest:votes                                     # House Clerk + Senate.gov XML → votes, member_votes (run members first)
npm run ingest:outlays                                   # Treasury MTS Table 9 → outlays_by_function + fiscal_totals
npm run ingest:geo -- --fy=2025 --layers=county,district # USAspending → geo_spending (per-county/district federal inflow)
npm run ingest:soi -- --year=2022                        # IRS SOI county CSV → county_tax (income tax paid per county)
```

Starter roll calls live in `pipelines/votes-config.ts` — the bill↔roll-number pairs are marked VERIFY (set offline; confirm against clerk.house.gov/Votes and senate.gov vote menus before trusting real output).

Offline/deterministic mode: set `PIPELINE_FIXTURES=1` to run both pipelines from recorded fixtures in `pipelines/fixtures/` (no network needed). **First live run note:** the outlays pipeline was built against documented API shapes from a sandbox that blocked the live hosts — it self-validates (function rows must sum to reported Total Outlays) and fails loudly with diagnostics if Treasury's field names differ; adjust the `FIELDS` constant in `pipelines/ingest-outlays.ts` if so.

## Tests

```bash
npm test
```

Unit tests (tax estimator, receipt allocation, rarity engine) plus integration tests that verify upsert idempotency against `DATABASE_URL`.

## What exists so far

- **Schema & migrations** — all spec §10 tables (`members`, `votes`, `member_votes`, `zip_district`, `responses`, `email_subscribers`) plus data tables (`fiscal_totals`, `outlays_by_function`, `geo_spending`, `county_tax`)
- **M1 pipelines** — `ingest:members` (live, verified: 537 current members with LIS ids and photo URLs) and `ingest:votes` (House Clerk + Senate.gov XML, per-party tallies, Present/Not Voting handled)
- **Receipt engine** (`src/receipt/`) — 2025 tax estimator, proportional-to-outlays allocation into the 10 plain-English categories (sums to the penny), borrowed-dollar line computed from actual receipts/outlays
- **Rarity engine** (`src/rarity/`) — deterministic trading-card tiers; `src/rarity/local.ts` joins county inflow (USAspending) with county tax paid (IRS SOI) into the per-county "dollars back per $100" factor (see `docs/decisions.md` D3, D6)
- **Spending pipelines** — outlays-by-function, spending-by-geography, and IRS SOI county tax ingestion
- **Not started:** zip_district crosswalk ingest, card-gen CLI (M2), alignment engine (M3), all UI (M4 — design package ready)
