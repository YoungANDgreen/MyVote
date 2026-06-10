# Project Receipt — v1 Build Spec
**Codename:** Project Receipt (naming is an open item — see §15)
**Owner:** Ryan · **Spec date:** June 10, 2026 · **Launch target:** soft launch ~Oct 20, 2026; peak Nov 3 midterms

---

## 1. Summary & Locked Decisions

A free, web-first app that shows any American where their federal tax dollars go in plain English, captures their opinion on that spending and on key congressional votes, and scores how closely their actual representatives align with them — with receipts for every claim.

| Decision | Locked Choice |
|---|---|
| Scope | **Federal only**, nationwide (state/local deferred) |
| Platform | **Web-first** (Next.js); no native app in v1 |
| Screen one | **Fused receipt + quiz** — the receipt IS the quiz |
| Editorial stance | We author nothing: **translate official documents, quote named people, link everything** |
| Framing | **Supporters say / Opponents say** (named + cited), never "Democrats say / Republicans say" |
| Business | For-profit LLC (PBC later), **free at launch**, trust rules public day one |
| Revenue path | Audience + dataset asset → premium alerts later → aggregate insights / media-exit optionality |
| Privacy | **Anonymous-first, district-only geography, no individual data sales ever** |
| Build mode | **Parallel with Saturday Ball**: backend summer, UI in October, September frozen |

---

## 2. Problem Statement

Federal spending and legislative activity are intentionally hard to follow — omnibus bills run thousands of pages, budget documents are written for specialists, and no tool connects "where my money went" to "how my representatives voted" to "what I actually believe." The cost: voters make choices misaligned with their own stated preferences, and accountability between elections is near zero. Existing tools each hold one piece (USAFacts: spending; iSideWith: matching; GovTrack: votes) but nobody closes the loop.

## 3. Goals

1. **Comprehension:** A median user understands their personal federal tax allocation in under 3 minutes (measured: flow completion + time-to-payoff).
2. **Activation:** ≥60% of users who enter a ZIP complete the full receipt → quiz → alignment flow.
3. **Virality:** ≥8% of completers share their result card.
4. **Scale by midterms:** 10,000 completed flows by Nov 3, 2026 (stretch: 50,000).
5. **Trust:** Zero published neutrality corrections that survive review; methodology page live at launch; ≥10% of completers opt into email.

## 4. Non-Goals (v1)

- **State & local data.** Different (worse) data landscape; it's the v2 moat, not the v1 ship.
- **Challenger/candidate matching.** Incumbents only — challengers have no voting record, only stated positions. Users WILL ask for this during midterms; it's a deliberate P2 (see §15).
- **Accounts/profiles.** Anonymous-first. Email capture only, unlinked to answers.
- **Native iOS app.** Web + share links is the distribution; Capacitor wrap is post-validation.
- **The daily-question game.** It's the retention layer, not the launch blocker. Fast-follow (P1).
- **Comments, social features, forums.** Trust-destroying surface area; never without moderation budget.

## 5. User Stories (priority order)

1. As a curious taxpayer, I want to see where my specific tax dollars went in plain English so that the federal budget stops being an abstraction.
2. As a voter, I want to rate whether each spending category feels right to me so that my opinion is grounded in real numbers, not vibes.
3. As a constituent, I want to see how my 3 members of Congress voted on major bills versus how I would have, so I know whether they actually represent me.
4. As a skeptical user, I want every claim linked to its official source so that I can verify the app isn't spinning me.
5. As a sharer, I want a result card that shows my alignment scores without exposing my individual answers, so I can compare with friends safely.
6. (Edge) As a user in a ZIP that spans two districts, I want a one-step disambiguation that doesn't store my address.
7. (Edge) As a user whose senator missed a vote, I want absences handled visibly ("did not vote"), not silently scored.

## 6. Core Experience Spec — The Fused Flow

**Design budget: ≤3 minutes landing → payoff. One required input (ZIP). ~12–18 taps total.**

### Step 1 — Locate (≤10s)
- Input: ZIP code. Lookup against `zip_district` crosswalk.
- If ZIP maps to one district → proceed. If split → ask street address, resolve via Census Geocoder, **discard address immediately**, store district only.
- Output stored: `state`, `district` (e.g., `AZ-01`). Nothing else.

**Acceptance:** Given a split ZIP, when the user enters an address, then the request resolves client-side (or via a no-log proxy), only `state+district` persists, and the address never appears in any log, DB row, or analytics event.

### Step 2 — Income (optional, ≤10s)
- Slider or quick-pick (defaults to U.S. median household income, current-year figure).
- Filing status toggle: single / married filing jointly.
- Estimator: current-year IRS brackets + standard deduction → estimated federal income tax. Labeled clearly: *"Estimate for illustration — not tax advice."*

### Step 3 — The Receipt (the hook)
- Their estimated tax, allocated across ~10 plain-English budget categories using **actual prior-FY outlays by budget function** (see §11).
- Includes the arithmetic-honesty line: *"For every $100 you paid in, Washington spent $1XX. The extra $XX was borrowed."* (Ratio computed from actual receipts/outlays — never hardcoded.)

### Step 4 — Rate the Receipt (quiz part 1)
- Each line item flips to: **Too much / About right / Too little / Skip.**
- This single mechanic = pillar 1 (transparency) + pillar 2 (opinion) in one interaction, and quietly generates district-level fiscal-preference data that exists nowhere else.

### Step 5 — IssueCards (quiz part 2)
- 8–12 cards from the curated key-vote set (§12). Each: plain-English what-it-does → user answers **Support / Oppose / Unsure.**
- Card anatomy is the locked schema:

```
IssueCard {
  bill_id, congress, short_title
  what_it_does:   plain-English translation of the CRS summary   [cite]
  what_it_costs:  CBO estimate or "not scored"                    [cite]
  supporters_say: [{claim, named_source, link}]   // identical structure,
  opponents_say:  [{claim, named_source, link}]   // matched word budget
  the_vote:       {chamber(s), date, tally, party_split}
  question:       neutrally-worded prompt
}
```

### Step 6 — Payoff
- Alignment score per member (House rep + 2 senators): "You and Sen. X agreed on 7 of 9 votes — 78%."
- **Per-vote receipts expandable under every score.** A naked percentage with no breakdown is where trust dies.
- (P1 slot) One teaser card: "$X.XB in federal money flowed into [County] last year" via USAspending geography.
- Share card (OG image): district + alignment %s, **never individual answers.** Sharing is opt-in.
- Email capture: "Get notified when your reps vote on something big." Unlinked to answers (§13).

**Acceptance (flow):**
- [ ] ZIP-only happy path completes with zero additional required inputs
- [ ] Absent/"present" votes display as "did not vote" and are excluded from the denominator
- [ ] Every card renders bill-text, CRS-summary, and roll-call links
- [ ] Share image contains no answer-level data
- [ ] Full flow median completion ≤3 min in testing

## 7. Requirements

**P0 — cannot ship without:** ZIP→district resolution with split-ZIP handling · tax estimator + receipt from real outlays data · line-item rating capture · 8–12 reviewed IssueCards · alignment engine with per-vote receipts · share card generation · methodology + trust-rules page · responsive web (mobile-first) · privacy-respecting analytics (e.g., Plausible) · corrections log page (can be empty at launch).

**P1 — fast follow (Oct if ahead, else Nov):** county federal-inflow card · email digest pipeline (generic, per-district) · daily question mode (one card/day — the retention engine, and it's a mechanic you already know cold) · multiple share-card variants.

**P2 — architectural insurance (design for, don't build):** state/local layers · consent-linked premium alerts ("email me when my rep diverges from MY answers" — requires explicit opt-in linking answers↔email, and it's the natural paid tier) · challenger matching via stated positions · aggregate insights product (k≥100 floor) · accounts · iOS wrap · Spanish.

## 8. System Architecture

```
                        ┌──────────────────────────────┐
                        │  Next.js app (App Router)    │
                        │  SSR/SSG pages · API routes  │
                        │  OG image gen (share cards)  │
                        └──────┬───────────────┬───────┘
                               │               │
                 client-side   │               │ server
              ┌────────────────┘               ▼
              ▼                        ┌───────────────┐
   Census Geocoder API                 │ Neon Postgres │◄──────────────┐
   (address→CD, discard)               │  (Drizzle ORM)│               │
                                       └──────▲────────┘               │
                                              │ idempotent upserts     │
                              ┌───────────────┴───────────────┐        │
                              │  Ingestion jobs (Node, cron   │        │
                              │  via GitHub Actions schedule) │        │
                              └──┬─────┬─────┬─────┬──────────┘        │
                                 │     │     │     │                   │
              congress-legislators  Congress.gov  House Clerk /     USAspending +
              (GitHub, members)     API (bills,   Senate.gov vote   Treasury Fiscal
                                    summaries)    XML (roll calls)  Data (cached) ──┘

   IssueCards live as versioned JSON/MDX **in the repo** (editorial
   transparency + PR review trail), generated by a CLI that drafts via
   Claude API → human-edited → merged. Never auto-published.
```

**Stack:** Next.js (SSR for SEO — the reason web-first won) · Neon Postgres (known quantity) · Drizzle ORM · deploy on Vercel (OG image gen + ISR friction-free) or Railway if you prefer one platform — either works, Vercel mildly favored. **All pipeline state lives in Postgres. Zero local-filesystem state.** (The Railway ephemeral-FS lesson is now policy.)

**Trade-offs made explicit:** Cards-in-repo vs. cards-in-DB → repo wins at 8–12 cards (versioned editorial record, PR review, no admin UI to build); revisit at ~50+ cards. GitHub Actions cron vs. Railway cron → Actions wins (free, no container state, logs retained). Live USAspending calls vs. nightly materialization → live + Next.js revalidate cache for v1 (one endpoint, low volume); materialize if the P1 county card lands.

## 9. Data Sources (all free)

| Source | Provides | Notes / verify-at-build |
|---|---|---|
| Congress.gov API | Bills, **CRS summaries** (the neutral baseline), members, cosponsors; House roll-call endpoints | API key (free). House-votes endpoint was beta — **verify coverage in Session 1** |
| House Clerk XML / Senate.gov XML | Roll-call votes, both chambers | Stable public XML; the `unitedstates/congress` scrapers are reference tooling/fallback |
| GovInfo API | Bill text, **Congressional Record** (floor statements → supporters/opponents quotes) | Free key |
| `unitedstates/congress-legislators` (GitHub) | Clean member metadata: bioguide IDs, district, party, terms | Pull raw JSON; refresh weekly |
| Treasury Fiscal Data API | Receipts, outlays, deficit (the borrowed-dollar ratio) | Verify best endpoint for outlays-by-function (MTS) vs. fallback below |
| USAspending API | Outlays by **budget function/subfunction**; spending-by-geography (county/CD) | Spending Explorer endpoints; OMB Historical Tables as cross-check |
| Census Geocoder | Address → congressional district, free, no key | **Verify CORS for client-side calls**; else no-log proxy route |
| ZCTA↔CD crosswalk | ZIP → district(s), static table | Census relationship files; flags split ZIPs |
| CBO | Cost estimates per bill | Documents, not an API — link + manual extract per card |

## 10. Database Schema (Neon Postgres)

```sql
members        (bioguide_id PK, chamber, state, district, party,
                full_name, photo_url, urls jsonb, current bool, updated_at)

votes          (vote_id PK, congress, chamber, bill_id, question,
                date, result, totals jsonb)          -- totals incl. party split

member_votes   (vote_id FK, bioguide_id FK, position,  -- Yea/Nay/Present/NV
                PRIMARY KEY (vote_id, bioguide_id))

zip_district   (zip, state, district, is_split bool, PRIMARY KEY (zip, district))

responses      (anon_id uuid, item_type,              -- 'line_item' | 'card'
                item_key, answer, state, district, created_at)
                -- NO ip, NO address, NO email linkage. anon_id = client UUID.

email_subscribers (email PK, state, district, verified bool, created_at)
                -- deliberately NOT joinable to responses (no anon_id column)

-- aggregates: materialized views over responses with HAVING count(*) >= 100
```

Cards: `content/cards/*.json` in repo (schema in §6), each carrying `vote_ids[]` that join to `votes`/`member_votes` at build/runtime for scoring.

## 11. Receipt Methodology (decision + rationale)

**v1 method: proportional-to-total-outlays.** User's estimated income tax × (each budget function's share of total outlays), plus the borrowed-dollar line computed from actual receipts vs. outlays. **Why:** simplest defensible math; the trust-fund-aware version (separating payroll-tax-funded Social Security/Medicare-HI) is more "correct" but doubles methodology complexity for v1. Mitigation: a plainly worded footnote on the receipt — *"Social Security and most of Medicare are funded by payroll taxes, shown here for the full picture; see methodology"* — and the full explanation on the methodology page. Upgrade path to trust-fund split is P2 and doesn't change the schema.

Plain-English category labels (≈10): Health care for seniors & low-income families · Social Security checks · Defense & military · Interest on the debt · Veterans · Education & job training · Transportation & infrastructure · Food & farm programs · Science, space & environment · Everything else (expandable). Each expands one level into subfunctions with one-line descriptions.

## 12. IssueCard Editorial Pipeline & Neutrality QA

**Vote selection criteria (curate 8–12):** current Congress · **final-passage roll calls only** (no procedural votes) · prefer bills with recorded floor votes in **both chambers** so all 3 of a user's members have positions · spread across budget functions/issue areas · deliberate mix of margins — party-line AND bipartisan/lopsided votes (an all-party-line set is itself an editorial bias) · high salience.

**Pipeline:** `card-gen` CLI takes a bill ID → pulls metadata + CRS summary + roll calls + Congressional Record excerpts → Claude API drafts `what_it_does` translation and extracts supporter/opponent claims **with named sources and links** → writes draft JSON → **Ryan edits and signs off → PR merge publishes.** Nothing auto-publishes. At 8–12 cards, manual review is hours, not weeks.

**Neutrality QA checklist (every card, enforced by CI where possible):**
- [ ] `what_it_does` traceable to CRS summary; no adjectives of judgment
- [ ] Reading level ≤ grade 9 (automated Flesch-Kincaid check in CI)
- [ ] Loaded-language lexicon lint passes (maintained word list: "slush fund," "handout," "scheme," etc.)
- [ ] Supporters/opponents blocks: identical structure, word counts within ±20%
- [ ] Every claim has a named human source + working link (CI link check)
- [ ] Adversarial review: two LLM passes primed with opposing ideological priors; both must return "no skew" or card is revised
- [ ] Question wording follows survey-neutrality norms (no presuppositions, no double-barrel, balanced response options)
- [ ] The vote tally + party split displayed verbatim — the data tells the partisan story; we don't

Public **methodology page** documents all of the above + a **corrections log** with timestamps. This page is also the press answer and the app-review answer when someone calls the product biased.

## 13. Privacy & Trust Implementation

The four public rules, as engineering:

1. **Never sell/share individual data** → `responses` carries no email, no IP, no address, no fingerprinting; analytics is cookieless (Plausible-class); `email_subscribers` is structurally unjoinable to answers.
2. **No political ads, no campaign/PAC clients** → policy page; no ad SDKs in the bundle, ever.
3. **Aggregate-only, k≥100** → all public/aggregate surfaces read from materialized views with a hard `HAVING n >= 100`; enforced in one place (the view), not per-query.
4. **Published methodology + corrections** → §12 page, versioned in repo.

Additional: address resolution client-side where CORS allows, else a proxy route with logging disabled; treat political opinions as GDPR special-category data and build to that standard everywhere (cheaper now than retrofitted); consent-linked features (premium alerts) are opt-in with their own checkbox and their own table, P2.

## 14. Build Plan — Parallel Mode Calendar

**Operating rules:** max **2 bounded sessions/week** before Sept 5, each ends with a merged PR and a checked milestone box. WIP limit = 1 milestone. **September is frozen — zero scheduled work.** Sequencing principle: summer = data/backend (analyst muscle, no overlap with Saturday Ball's UI crunch); October = the entire front end.

| Window | Milestone | Done means |
|---|---|---|
| Jun 10–14 (M0) | Repo, Neon project, decisions doc committed, API keys obtained | `git log` exists; this spec is `/docs/spec.md` |
| Jun 15–30 (M1) | Members + votes pipelines | Real 119th-Congress members and final-passage roll calls in Postgres; idempotent re-runs; **House-votes API coverage question resolved** |
| Jul (M2) | Receipt engine + card pipeline | Outlays-by-function snapshot job; tax estimator with unit tests; borrowed-dollar ratio from live Fiscal Data; `card-gen` CLI working; 3 draft cards generated |
| Aug (M3) | Editorial + alignment | 8–12 cards finalized through full QA checklist; alignment engine with tests (incl. absences, unicameral-vote exclusion); JSON API routes serving everything the UI needs |
| **Sep** | **— FROZEN (Saturday Ball ships Sep 5) —** | Only allowed action: register domain when the name lands |
| Oct 1–19 (M4) | UI sprint | Full fused flow, share-card OG images, methodology page, analytics, mobile polish |
| Oct 20–26 (M5) | Soft launch | Friends/family + seed posts (the receipt visual is inherently r/dataisbeautiful-shaped); fix list burned down |
| Oct 27–Nov 3 | Ride | Distribution push into midterms; capture emails at peak for the off-cycle product (P1 daily question) |

**Post-Nov 3 reality check, scheduled now:** traffic will crater after the election — that's the category, not a failure. The daily question (P1) is the off-cycle retention engine; the email list is the relight switch.

## 15. Open Questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| 1 | House roll-call coverage: Congress.gov API vs. Clerk XML as primary | Eng | **Blocks M1** — resolve in Session 1 |
| 2 | Census Geocoder CORS from browser (else build no-log proxy) | Eng | Blocks M4 only |
| 3 | Best outlays-by-function source: Fiscal Data MTS vs. USAspending explorer vs. OMB tables | Eng | Blocks M2 — timebox 1 hr, pick, document |
| 4 | Receipt methodology footnote final wording (trust-fund caveat) | Ryan | Blocks M2 card copy, not code |
| 5 | Name + domain | Ryan | Non-blocking until Oct 1; park candidates, decide once |
| 6 | Challenger-matching demand during midterms — pre-write the "incumbents only, here's why" FAQ answer | Ryan | Non-blocking |
| 7 | LLC formation timing (before launch for liability hygiene?) | Ryan | Non-blocking; recommend before public launch |

## 16. Claude Code — Session 1 Kickoff Prompt (M1)

Paste this to start:

```
You are building Session 1 of "Project Receipt," a civic transparency web app.
Full spec is in /docs/spec.md — read §8–§10 and §15 before writing code.

GOAL (this session only): scaffold the project and ship the members + votes
ingestion pipelines against real data.

STACK: Next.js (App Router, TypeScript), Drizzle ORM, Neon Postgres
(DATABASE_URL in .env), Vitest. Node scripts in /pipelines, runnable via
`npm run ingest:members` and `npm run ingest:votes`.

HARD RULES:
- All pipeline state lives in Postgres. No local-filesystem state, no temp
  caches on disk. Every ingestion is an idempotent upsert, safe to re-run.
- Secrets only via env. Commit .env.example, never .env.

TASKS:
1. Scaffold repo: Next.js app, Drizzle config, /docs, /pipelines, /content/cards.
2. Drizzle schema + migration for: members, votes, member_votes, zip_district
   (column spec in /docs/spec.md §10). Generate and run migration against Neon.
3. ingest:members — pull current legislators from the unitedstates/
   congress-legislators GitHub repo (raw JSON), upsert into members.
   Include party, chamber, state, district, bioguide_id, photo URL strategy.
4. ingest:votes — DECISION TASK FIRST: check whether the Congress.gov API
   roll-call endpoints fully cover 119th Congress House final-passage votes.
   If yes, use it (+ Senate.gov XML for Senate). If patchy, use House Clerk
   XML + Senate.gov XML directly. Document the decision in /docs/decisions.md,
   then implement: ingest final-passage roll calls for a hardcoded starter
   list of 3 bill IDs (I'll supply), populating votes + member_votes,
   including per-party tallies in votes.totals.
5. Tests: estimator-free this session — test upsert idempotency (run twice,
   row counts stable) and member_votes position parsing incl. Present/Not Voting.
6. README: setup, env vars, how to run pipelines, what exists so far.

DONE = migrations applied, both pipelines run green against real APIs,
tests pass, README accurate. Do not start any UI.
```

---

## 17. What This Is Not (paste-ready honesty, for yourself in March)

This is not the wealth engine — Bid Lebowski keeps that job. This is the Wordle/Immaculate Grid play: built cheap at your shipping speed, free, viral mechanic, election-cycle tailwind, with three real prizes — an audience, a dataset nobody else has (district-level fiscal preferences), and acquisition optionality with media/civic orgs. The floor is a beloved free tool that cost you a summer of side sessions. The trust rules are the moat. Don't trade them for revenue that wouldn't change your life anyway.
