/**
 * Federal income tax estimator — "Estimate for illustration, not tax advice."
 * Standard deduction + ordinary brackets only (no credits, no payroll tax).
 *
 * TAX YEAR 2025 constants (IRS Rev. Proc. 2024-40). Update annually; keeping
 * all year-dependent numbers in this one block is the upgrade path.
 */

export type FilingStatus = "single" | "married";

const YEAR = 2025;

const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 15_000,
  married: 30_000,
};

// [upper bound of bracket, marginal rate]; Infinity = top bracket
const BRACKETS: Record<FilingStatus, [number, number][]> = {
  single: [
    [11_925, 0.10],
    [48_475, 0.12],
    [103_350, 0.22],
    [197_300, 0.24],
    [250_525, 0.32],
    [626_350, 0.35],
    [Infinity, 0.37],
  ],
  married: [
    [23_850, 0.10],
    [96_950, 0.12],
    [206_700, 0.22],
    [394_600, 0.24],
    [501_050, 0.32],
    [751_600, 0.35],
    [Infinity, 0.37],
  ],
};

export interface TaxEstimate {
  taxYear: number;
  income: number;
  filingStatus: FilingStatus;
  taxableIncome: number;
  estimatedTax: number; // rounded to whole dollars
  effectiveRate: number; // of gross income, 0..1
}

export function estimateFederalIncomeTax(income: number, filingStatus: FilingStatus): TaxEstimate {
  if (income < 0) throw new Error("income must be >= 0");
  const taxableIncome = Math.max(0, income - STANDARD_DEDUCTION[filingStatus]);

  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of BRACKETS[filingStatus]) {
    if (taxableIncome <= lower) break;
    tax += (Math.min(taxableIncome, upper) - lower) * rate;
    lower = upper;
  }

  const estimatedTax = Math.round(tax);
  return {
    taxYear: YEAR,
    income,
    filingStatus,
    taxableIncome,
    estimatedTax,
    effectiveRate: income > 0 ? estimatedTax / income : 0,
  };
}
