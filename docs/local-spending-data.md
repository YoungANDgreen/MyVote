# Local Spending Data — what we can get, in order of effort

Goal: maximize local variance for the receipt + trading-card rarity without breaking the v1 "federal only" scope or the privacy rules (district/county geography only — never below).

## Tier 1 — Shipped now (pipeline: `ingest:geo`)

**USAspending `spending_by_geography`** — federal award dollars flowing into every **state, county, and congressional district**, with population and per-capita, by fiscal year. One POST per layer, no key, free.

- Powers: the P1 county card ("$X.XB flowed into [County] last year") and the card's **local-inflow percentile** rarity factor (your county vs. all ~3,100 counties).
- Caveats: awards only (contracts, grants, direct payments, loans) — no interest on the debt, no federal payroll, no classified. Copy must say "federal money flowed into," not "your share."
- Optional richness, same API: per-county **breakdown by agency or award type** ("mostly Medicare payments" vs. "mostly defense contracts") — one extra request per displayed county, cacheable.

## Tier 2 — The rarity unlock: IRS SOI ZIP/county data (recommended next)

**IRS Statistics of Income** publishes, free, per **ZIP code and per county**: number of returns, AGI, and **total income tax paid**, broken out by income band. Static annual CSV — a one-time ingest job, no API needed.

This is the missing half of the trading card. With it we can compute, per county:

> **dollars back per $100 paid in** = (USAspending county inflow) ÷ (IRS SOI county income tax paid)

That ratio varies enormously county-to-county (deep donor suburbs vs. counties with a giant federal lab or base), which is exactly the user-to-user variance the rarity mechanic wants — and it's all sourced, all aggregate, all above the privacy floor. It also localizes the borrowed-dollar story: "your county sent $X, $Y came back."

Bonus: SOI income bands give an honest **local tax-paid percentile** ("your estimated tax vs. your county's filers") instead of a national guess.

## Tier 3 — More texture, still federal, still free

- **Per-district award breakdown by agency/CFDA program** (USAspending search endpoints): "the biggest federal program in AZ-01 is ___" — great card flavor text.
- **Census ACS** population/income per district: denominators and context lines.
- **FAADS/grant detail for named landmarks** ("includes $1.2B to [University/Base]") — heavier parsing, high delight; defer until the card design demands it.

## Tier 4 — v2 territory (true state/local budgets — do NOT build for midterms)

State & local government finances (Census Annual Survey of State & Local Government Finances, state ACFRs, state transparency portals) are inconsistent, lagged, and per-state bespoke. This is the v2 moat per spec §4. Design the schema so a future `level` column ('federal' | 'state' | 'local') is additive — nothing else needed now.

## Privacy & neutrality constraints (apply to all tiers)

- Geography stored/displayed: **state, county, district. Never ZIP+income together, never below county.** (ZIP is used transiently for district lookup only.)
- Rarity scores **extremity, not direction** of the local return ratio — receiving more federal money is never framed as winning or losing; the number is just displayed with its sources.
- Every local figure on a card carries a source link, same standard as the receipt.
