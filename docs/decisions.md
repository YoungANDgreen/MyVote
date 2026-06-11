# Decision Log

## D1 — Outlays-by-function source: Treasury Fiscal Data MTS Table 9 (2026-06-11)

**Resolves spec §15 open question #3.**

**Decision:** Primary source for the receipt is the **Monthly Treasury Statement, Table 9** ("Summary of Receipts by Source, and Outlays by Function") via the Fiscal Data API — the latest **September** statement gives final fiscal-year-to-date outlays per OMB budget function AND total receipts/outlays in one dataset, so the receipt allocation and the borrowed-dollar line come from a single authoritative pull.

**Rejected:**
- *USAspending Spending Explorer* (`/api/v2/spending/`) — reports **obligations** (GTAS), not outlays; wrong measure for "where the money actually went." Retained for subfunction drill-down detail and all geography work (D2).
- *OMB Historical Tables 3.2* — true outlays by function/subfunction but XLSX documents, no API. Retained as the **annual cross-check** in the methodology QA, not a pipeline.

**Caveats baked into the pipeline (`pipelines/ingest-outlays.ts`):**
- Built offline (sandbox network allowlist blocked the live API), against documented response shapes. **Verify on first live run.** Field names are isolated in one `FIELDS` constant; a mismatch fails loudly listing the actual fields returned.
- Self-validation invariant: matched function rows must sum to the reported Total Outlays within 2%, or the run aborts with diagnostics. A silent wrong receipt is the failure mode we never accept.
- Units: ratio and share math are unit-agnostic; confirm whether amounts arrive in dollars or millions before displaying absolute "$X.XB" figures anywhere.

## D2 — "Local spending" in v1 = federal money flowing INTO a geography (2026-06-11)

True state/local government budgets stay v2 (spec §4). What we CAN ship now, federal-only and nationwide, is **USAspending `spending_by_geography`** (recipient location) at state / county / congressional-district resolution, with population and per-capita included. This powers the P1 county card and the trading-card rarity percentiles. Full strategy and the richer-local-data roadmap: `docs/local-spending-data.md`.

**Display-copy rule:** this is award data (contracts, grants, direct payments, loans) — say "federal money flowed into [County]," never "your county's share of the budget" (excludes interest, federal payroll, classified).

## D3 — Trading-card rarity is deterministic and data-driven (2026-06-11)

Rarity (`src/rarity/engine.ts`) is computed from verifiable numbers — never RNG: the user's tax-paid percentile, their county/district per-capita federal-inflow percentile, and the *extremity* (not direction) of the local return-per-$100 ratio. The national spent-per-$100 figure is identical for every user in a fiscal year, so it stamps the card **set/season**, not per-user rarity.

**Neutrality guard:** scoring extremity instead of direction means a deep donor county and a big recipient county are equally rare — the mechanic never implies that receiving more (or less) federal money is good or bad. Tier names are game-neutral (Common→Legendary). Every factor printed on a card links to its source, same as the receipt.

## D4 — Local Postgres 16 for dev/CI parity (2026-06-11)

Dev and tests run against any `DATABASE_URL` (local Postgres in the sandbox, Neon in real environments). Pipelines accept an injectable fetcher; `PIPELINE_FIXTURES=1` runs them from recorded fixtures in `pipelines/fixtures/` for offline dev and deterministic CI.
