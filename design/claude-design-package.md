# Project Receipt — UI Design Package (v1)

**Purpose of this document:** A complete, self-contained design brief for the Project Receipt web app, ready to upload to Claude Design. It specifies every screen, component, state, and copy rule needed to design the v1 UI. No other context is required.

**Product in one sentence:** A free, mobile-first web app that shows any American where their federal tax dollars went in plain English, lets them rate that spending and key congressional votes, and scores how closely their actual representatives align with them — with a linked source ("receipt") behind every claim.

---

## 1. Design Principles (non-negotiable)

1. **The receipt is the brand.** The core visual metaphor is a printed store receipt: itemized, monospaced figures, totals, a torn edge. Lean into it everywhere — it's what makes the result screenshot-able and shareable.
2. **Trust through receipts, not through tone.** Every factual claim in the UI carries a visible source link. A number with no expandable breakdown is a design defect.
3. **Aggressively plain English.** Reading level ≤ grade 9. No budget jargon ("outlays," "appropriations," "budget function") on user-facing surfaces — those live on the methodology page.
4. **Scrupulously non-partisan surfaces.** Never use red/blue as the app's brand or accent colors. The ONLY place partisan red/blue appears is in factual vote-tally party splits (D/R counts), where convention demands it. Framing is always "Supporters say / Opponents say" with named people — never "Democrats say / Republicans say."
5. **One required input.** ZIP code is the only mandatory field in the entire flow. Everything else is optional or pre-filled with defaults.
6. **Speed is a feature.** Landing → payoff in ≤3 minutes, roughly 12–18 taps. Every screen must be completable in seconds on a phone.
7. **Anonymous by design, visibly.** No account, no sign-in, no address stored. The UI should *say* this at the moments users would worry (ZIP entry, address disambiguation, email capture).

---

## 2. Visual Direction & Design Tokens

### Mood
"Civic utility meets thermal-printer receipt." Clean, warm, paper-like, data-forward. Think: a modern gov-data dashboard had a baby with a CVS receipt. NOT: partisan news site, fintech dark mode, government brutalism.

### Color (proposed tokens — designer may refine, but obey the partisan-color rule)
- `--paper`: #FAF8F3 (warm off-white app background — receipt paper)
- `--ink`: #1A1A1A (primary text — receipt ink)
- `--ink-soft`: #5C5C57 (secondary text)
- `--accent`: a neutral civic teal/green (e.g., #0F766E) for CTAs, links, progress — deliberately neither red nor blue
- `--highlight`: #F4C542 (sparingly: the "borrowed dollar" line, key callouts)
- `--agree`: #2E7D32 / `--disagree`: #B3461E (alignment results — green/orange-rust, NOT green/red-blue; avoid anything readable as party colors)
- `--dem`: #3B6FB6 / `--gop`: #C0392B — used ONLY inside factual party-split tally bars, never decoratively
- Borders/dividers: dashed 1px lines (receipt perforation feel)

### Typography
- **Numbers & receipt line items:** a monospace or tabular-figure face (e.g., IBM Plex Mono / Space Mono) — dollar amounts must align in columns
- **UI & body copy:** a highly legible humanist sans (e.g., Inter, Public Sans)
- **Receipt header:** uppercase, letterspaced, mono — like a printed merchant name
- Minimum body size 16px mobile; dollar figures on the receipt are the visual heroes (24–32px)

### Texture & shape
- Receipt panels: subtle paper texture or flat warm white, slight drop shadow, **zig-zag torn edge** on top/bottom of the receipt component (this detail sells the metaphor and the share card)
- Corner radius: small (4–8px) on cards/buttons — crisp, not bubbly
- Iconography: simple line icons, one per budget category (heart/health, shield/defense, graduation cap/education, etc.)

### Layout
- **Mobile-first, single column, max-width ~640px centered on desktop.** This is a phone product that happens to run in a browser.
- Persistent slim progress indicator across the 6-step flow (dots or thin bar; steps: ZIP → Income → Receipt → Rate → Votes → Results)

---

## 3. The Core Flow — Screen-by-Screen Specs

The entire product is one fused flow of 6 steps plus a results page. Design budget: ≤3 minutes total.

### Screen 1 — Landing + ZIP Entry
**Job:** Hook + collect the one required input in ≤10 seconds.

- Hero headline (working copy): **"See exactly where your tax dollars went."**
- Subhead: "Then find out if your representatives in Congress actually vote the way you would. Free, anonymous, every claim linked to its source."
- Single large input: ZIP code (numeric keypad on mobile, 5 digits) + primary CTA button: **"Show me my receipt"**
- Trust microcopy directly under the input: "No account. No address stored. We only keep your congressional district (like AZ-01)."
- Optional below the fold: a small illustrative receipt preview (blurred/sample) as a teaser; footer links to Methodology · Privacy & Trust Rules · Corrections Log
- **States:** invalid ZIP (inline error, "That doesn't look like a U.S. ZIP code"); ZIP not found; loading spinner on lookup

### Screen 1b — Split-ZIP Disambiguation (conditional)
**Job:** Some ZIPs span two congressional districts. Resolve in one step without scaring the user.

- Headline: "Your ZIP covers two districts — which is yours?"
- Two options, in priority order:
  1. **Pick from a short list** of the 2–3 districts with their rep names/photos ("I know my rep: …")
  2. **Or enter your street address** — with prominent reassurance: "Used once to find your district, then immediately discarded. Never stored, never logged."
- **State:** address lookup failure → fall back to district picker

### Screen 2 — Income (optional)
**Job:** Personalize the receipt; ≤10 seconds; skippable.

- Headline: "Roughly what's your household income?"
- A **slider** with live dollar readout, defaulting to the U.S. median household income, plus 4–5 quick-pick chips ($30k / $50k / $75k(median, pre-selected) / $120k / $200k+)
- Toggle: **Single / Married filing jointly**
- Below: live-updating line — "Estimated federal income tax: **$X,XXX**" with disclaimer microcopy: "Estimate for illustration — not tax advice."
- Secondary action: "Skip — use the U.S. median" (flow must never block here)

### Screen 3 — The Receipt (the hook; the most important screen in the product)
**Job:** The payoff visual. Their estimated tax, itemized across ~10 plain-English categories. This screen is inherently screenshot-shaped — design it like a poster.

- Rendered as a literal receipt: torn top edge, mono type, dashed separators.
- **Receipt header block:** "YOUR FEDERAL TAX RECEIPT" · tax year · district (e.g., AZ-01) · "Estimated federal income tax: $8,240"
- **Line items (~10), each:** category icon · plain-English label · dollar amount (right-aligned, mono) · percent of total. Sorted largest-first. Labels (fixed copy):
  1. Health care for seniors & low-income families
  2. Social Security checks
  3. Defense & military
  4. Interest on the debt
  5. Veterans
  6. Education & job training
  7. Transportation & infrastructure
  8. Food & farm programs
  9. Science, space & environment
  10. Everything else
- Each line item **expands** (tap/chevron) one level into 2–4 subcategories with one-line descriptions and amounts.
- **The borrowed-dollar line** — visually distinct (highlight color, its own boxed strip near the total): *"For every $100 you paid in, Washington spent $1XX. The extra $XX was borrowed."*
- **Footnote** (small, but present, with link): "Social Security and most of Medicare are funded by payroll taxes, shown here for the full picture — see how we calculate this." → methodology page
- Receipt footer: dashed line, "SOURCES: U.S. Treasury · USAspending.gov" with links
- CTA: **"Now — does this look right to you?"** → Step 4

### Screen 4 — Rate the Receipt (quiz part 1)
**Job:** Flip each receipt line into a one-tap opinion. Same receipt, now interactive.

- Same receipt layout; each line item now carries a 3-button segmented control: **Too much / About right / Too little** (+ a subtle "Skip" text action)
- Interaction options (designer's choice, but must be one-tap-per-item): inline segmented controls on the receipt, OR a card-per-category swipe/tap sequence with a progress count ("3 of 10")
- Selected state is bold and persistent; a running "X of 10 rated" indicator; "Continue" enabled at any time (skipping all is allowed)
- Microcopy at top: "Tap your gut reaction. There are no wrong answers — this stays anonymous."

### Screen 5 — IssueCards (quiz part 2)
**Job:** 8–12 cards on real congressional votes. Each card: what the bill does → user answers Support / Oppose / Unsure. This card's neutrality is the product's reputation — the layout must be visibly symmetric.

**Card anatomy (strict order, one card per screen, swipe/next navigation, "Card 3 of 9" progress):**
1. **Short title** (plain-English bill name) + chip with bill number (e.g., "H.R. 1234 · 119th Congress")
2. **What it does** — 2–3 sentence plain-English summary · small "source" link (CRS summary)
3. **What it costs** — one line, CBO estimate or "Not scored by CBO" · source link
4. **Supporters say / Opponents say** — two visually IDENTICAL blocks (same size, same styling, same structure; stacked on mobile, side-by-side ≥768px; order randomized or alternating so neither side always leads). Each block: 1–2 quoted claims, each with a **named person + their title** and a link icon. Never party-labeled blocks.
5. **The vote** — factual strip: chamber(s), date, tally (e.g., "Passed House 218–214"), and a thin horizontal **party-split bar** (the only red/blue element in the app), rendered verbatim with counts.
6. **The question** — neutrally worded prompt + three equal-weight buttons: **Support / Oppose / Unsure** (all three same size and visual weight — "Unsure" must not look like a lesser option)

- All source links open in new tab; link icon style consistent app-wide ("receipt" affordance)
- **States:** card loading skeleton; last card transitions to "Calculating your alignment…" interstitial (brief, with the receipt-printer animation — a fun moment: results "print" out)

### Screen 6 — Payoff / Results
**Job:** The emotional payoff and the viral moment. Alignment score per member of Congress, with per-vote receipts under every score.

- Headline: "How well does Congress represent you?"
- **Three member cards** (House rep + 2 senators), each:
  - Photo, name, role + state/district, party (small text label, not color-coded card)
  - **Big alignment score:** "You agreed on **7 of 9** votes — **78%**" (the fraction is as prominent as the percent)
  - Ring/donut or bar visualization in agree/disagree colors (green/rust — NOT party colors)
  - **Expandable per-vote breakdown** (the receipts — this expander is mandatory, never a naked percentage): one row per IssueCard → bill short title · your answer · their vote · match icon (✓ agree / ✗ disagree). **Absences:** "Did not vote" rows are visibly grey, marked excluded, and the denominator visibly adjusts ("7 of 9 votes you both weighed in on").
  - Rows where user answered "Unsure" also excluded and shown as such.
- **Fiscal echo (optional small module):** "Your receipt ratings vs. your district" teaser — only if k≥100 aggregate exists; otherwise omit entirely (design both presence and absence).
- **Share module:** preview of the share card (see §4) + "Share my scorecard" button. Microcopy: "Your card shows your scores — never your individual answers." Sharing is opt-in; nothing auto-posts.
- **Email capture (clearly separated, after share):** "Get notified when your reps vote on something big." Single email field + button. Microcopy: "Your email is never connected to your answers." 
- Footer: Methodology · Privacy & Trust Rules · Corrections Log · "Start over"

---

## 4. Share Card (OG image, 1200×630)

The most-seen artifact of the product. Design as a static social image:

- Receipt visual language: torn-edge paper panel on a contrasting background
- Contents: **district** (e.g., "AZ-01") · the three members' names + alignment percentages (e.g., "Rep. Smith 78% · Sen. Jones 44% · Sen. Lee 67%") · one-line hook ("How aligned are YOU with your representatives?") · app name + URL
- **Hard rule: NO individual answers, no income, no per-vote detail on the card.** District + scores only.
- Design 2–3 variants if possible: (a) alignment scorecard, (b) "my federal receipt" with category percentages (no dollar amounts), (c) borrowed-dollar stat card

---

## 5. Secondary Pages

### Methodology & Trust Rules page
- Long-form readable article layout (prose, ~680px measure), sticky table of contents on desktop
- Sections: How the receipt is calculated · The trust-fund caveat · How votes are selected · How cards are written & neutrality-checked (the 8-point QA checklist, displayed) · The four privacy rules, stated plainly:
  1. We never sell or share individual data — ever.
  2. No political ads. No campaign or PAC clients.
  3. Public data is aggregate-only, minimum 100 people per district.
  4. Published methodology and a public corrections log.
- This page doubles as the press/skeptic answer — design it to feel like terms a human would actually read: short sections, pull-quote styling for the four rules.

### Corrections Log page
- Simple reverse-chronological table/list: date · what was wrong · what changed · link
- **Empty state matters** (it launches empty): "No corrections yet. When we get something wrong, it gets logged here with a timestamp — that's the deal." 

### Error / edge pages
- ZIP not found, district lookup service down ("Our district lookup is having trouble — try again in a minute"), generic 404/500 in receipt visual language ("RECEIPT NOT FOUND")

---

## 6. Component Inventory (build these as reusable pieces)

| Component | Used in | Notes |
|---|---|---|
| ReceiptPanel | Screens 3, 4, share card, errors | Torn edge, mono figures, dashed dividers |
| ReceiptLineItem | 3, 4 | Icon + label + $ + %, expandable, optional rating control |
| BorrowedDollarStrip | 3, share variant | Highlight-colored callout |
| RatingControl | 4 | Too much / About right / Too little segmented control + skip |
| IssueCard | 5 | Full anatomy per §3-Screen 5 |
| SaySayBlocks | 5 | Twin supporters/opponents quote blocks, enforced symmetry |
| VoteTallyStrip | 5, 6 | Tally + party-split bar (only red/blue element) |
| AnswerButtons | 5 | Support / Oppose / Unsure, equal weight |
| MemberScoreCard | 6 | Photo, score fraction + %, expandable per-vote rows |
| VoteReceiptRow | 6 | Your answer vs. their vote, match/absent/excluded states |
| SourceLink | everywhere | Consistent cited-claim affordance |
| ProgressDots | flow shell | 6-step indicator |
| TrustMicrocopy | 1, 1b, 6 | Standardized reassurance text style |
| EmailCapture | 6 | Single field, unlinked-to-answers microcopy |
| ShareModule | 6 | Card preview + opt-in share actions |

---

## 7. Copy & Tone Rules (apply to all designed text)

- Grade-9 reading level or below; short sentences; second person ("your receipt," "your reps")
- Banned words anywhere in UI: "slush fund," "handout," "scheme," "bloated," "pork," any adjective of judgment about spending or bills
- Never "Democrats say / Republicans say" — always named humans with titles
- Numbers are always sourced; if a number appears, a source affordance appears
- Honest hedging where real: "estimate," "did not vote," "not scored by CBO"
- Voice: a sharp, fair friend explaining the budget over coffee — warm, dry, never snarky, never preachy

---

## 8. Accessibility & Platform Requirements

- WCAG 2.1 AA: contrast on the paper background, visible focus states, full keyboard operability through the entire flow
- Rating and answer controls must not rely on color alone (labels always present)
- Party-split bar needs text counts adjacent (not color-only)
- Touch targets ≥44px; numeric inputmode for ZIP; respects `prefers-reduced-motion` (receipt-printing animation degrades to fade)
- Performance: flow screens are lightweight — no heavy imagery in steps 1–5; the share OG image is server-generated, not client-rendered

---

## 9. Explicitly Out of Scope (do NOT design)

- Accounts, profiles, login of any kind
- Comments, forums, or any social features
- State/local tax surfaces
- Challenger/candidate matching (incumbents only in v1)
- Daily-question game mode (fast-follow; leave room in the nav/IA but design nothing)
- Native app chrome — this is responsive web only
- Dark mode (nice-to-have at best; paper-light is the brand)

---

## 10. Deliverables Checklist for the Design Pass

- [ ] Landing + ZIP (incl. error states)
- [ ] Split-ZIP disambiguation
- [ ] Income step
- [ ] Receipt (collapsed + expanded line item + borrowed-dollar strip)
- [ ] Rate-the-receipt interaction
- [ ] IssueCard (full anatomy, mobile + ≥768px layouts)
- [ ] Results page (member cards collapsed + expanded per-vote receipts, incl. "did not vote" row)
- [ ] Share card OG image (1200×630), 1–3 variants
- [ ] Email capture module
- [ ] Methodology page layout
- [ ] Corrections log (incl. empty state)
- [ ] Error pages in receipt voice
- [ ] Token sheet: colors, type scale, spacing, iconography direction
