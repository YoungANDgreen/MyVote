/**
 * Trading-card rarity engine.
 *
 * Rarity is DETERMINISTIC and DATA-DRIVEN — never random. Two users with the
 * same inputs always pull the same card, and every factor on the card is a
 * verifiable number with a source (the receipt ethos applies to the game too).
 *
 * Factors (all 0..1):
 *  1. taxPercentile      — where the user's estimated tax falls among U.S.
 *                          income-tax payers (bigger payment = rarer card).
 *  2. localInflowPercentile — user's county/district per-capita federal award
 *                          inflow vs. all counties/districts (geo_spending).
 *  3. returnExtremity    — how UNUSUAL the local "dollars back per $100 paid
 *                          in" ratio is, in either direction. Donor counties
 *                          and big-recipient counties are both rare; typical
 *                          counties are common. (Neutral by construction —
 *                          extremity, not direction, scores.)
 *
 * The national spent-per-$100 ratio is the same for everyone in a fiscal year,
 * so it acts as the card SET/season stamp (e.g. "FY2025: $128 spent per $100"),
 * not a per-user rarity factor.
 */

export const TIERS = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
export type Tier = (typeof TIERS)[number];

// score thresholds, ascending; tuned so roughly 55/25/12/6/2 % of pulls
const TIER_FLOORS: [number, Tier][] = [
  [0.0, "Common"],
  [0.55, "Uncommon"],
  [0.78, "Rare"],
  [0.91, "Epic"],
  [0.975, "Legendary"],
];

export interface RarityWeights {
  taxPercentile: number;
  localInflowPercentile: number;
  returnExtremity: number;
}

export const DEFAULT_WEIGHTS: RarityWeights = {
  taxPercentile: 0.35,
  localInflowPercentile: 0.35,
  returnExtremity: 0.3,
};

export interface RarityInputs {
  /** 0..1 percentile of user's estimated tax among taxpayers */
  taxPercentile: number;
  /** 0..1 percentile of user's county/district per-capita federal inflow */
  localInflowPercentile: number;
  /** local dollars back per $100 of federal tax paid locally (e.g. 87, 230) */
  localReturnPer100: number;
}

export interface RarityResult {
  tier: Tier;
  score: number; // 0..1
  factors: { taxPercentile: number; localInflowPercentile: number; returnExtremity: number };
}

/** Distance from the typical return ratio, scaled to 0..1 (capped at ±$150/100). */
export function returnExtremity(localReturnPer100: number, nationalPer100 = 100): number {
  return Math.min(1, Math.abs(localReturnPer100 - nationalPer100) / 150);
}

export function computeRarity(inputs: RarityInputs, weights = DEFAULT_WEIGHTS): RarityResult {
  for (const [k, v] of Object.entries(inputs)) {
    if (!Number.isFinite(v)) throw new Error(`rarity input ${k} is not a number`);
  }
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const factors = {
    taxPercentile: clamp(inputs.taxPercentile),
    localInflowPercentile: clamp(inputs.localInflowPercentile),
    returnExtremity: returnExtremity(inputs.localReturnPer100),
  };
  const wTotal = weights.taxPercentile + weights.localInflowPercentile + weights.returnExtremity;
  const score =
    (factors.taxPercentile * weights.taxPercentile +
      factors.localInflowPercentile * weights.localInflowPercentile +
      factors.returnExtremity * weights.returnExtremity) /
    wTotal;

  let tier: Tier = "Common";
  for (const [floor, t] of TIER_FLOORS) if (score >= floor) tier = t;
  return { tier, score, factors };
}

/**
 * Percentile of `value` within a population of values (e.g. a county's
 * per-capita inflow among all counties in geo_spending for the FY).
 * Mean-rank method; returns 0..1. Empty population → 0.5 (neutral).
 */
export function percentileOf(value: number, population: number[]): number {
  if (population.length === 0) return 0.5;
  let below = 0;
  let equal = 0;
  for (const v of population) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  return (below + equal / 2) / population.length;
}
