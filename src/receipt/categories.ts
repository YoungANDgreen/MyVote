/**
 * Maps official OMB budget-function names → the ~10 plain-English receipt
 * categories locked in spec §11. Keyed on normalized function name (the MTS
 * and USAspending both report by function name; OMB codes shown in comments).
 *
 * Anything unmapped lands in "Everything else" — by design, so a new or
 * renamed function can never silently vanish from the receipt.
 */

export const CATEGORIES = [
  "Health care for seniors & low-income families",
  "Social Security checks",
  "Defense & military",
  "Interest on the debt",
  "Veterans",
  "Education & job training",
  "Transportation & infrastructure",
  "Food & farm programs",
  "Science, space & environment",
  "Everything else",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const EVERYTHING_ELSE: Category = "Everything else";

export function normalizeFunctionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MAP: Record<string, Category> = {
  // 050
  "national defense": "Defense & military",
  // 150 → Everything else (international affairs)
  // 250
  "general science space and technology": "Science, space & environment",
  // 270
  energy: "Science, space & environment",
  // 300
  "natural resources and environment": "Science, space & environment",
  // 350
  agriculture: "Food & farm programs",
  // 400
  transportation: "Transportation & infrastructure",
  // 500
  "education training employment and social services": "Education & job training",
  // 550 (Medicaid, CHIP, public health)
  health: "Health care for seniors & low-income families",
  // 570
  medicare: "Health care for seniors & low-income families",
  // 650
  "social security": "Social Security checks",
  // 700
  "veterans benefits and services": "Veterans",
  // 900
  "net interest": "Interest on the debt",
  // 370 commerce & housing credit, 450 community & regional development,
  // 600 income security, 750 justice, 800 general government, 920 allowances,
  // 950 undistributed offsetting receipts → Everything else (fall-through)
};

export function categoryForFunction(functionName: string): Category {
  return MAP[normalizeFunctionName(functionName)] ?? EVERYTHING_ELSE;
}
