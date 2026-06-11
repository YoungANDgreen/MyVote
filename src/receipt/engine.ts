import { CATEGORIES, Category, categoryForFunction } from "./categories";

export interface FunctionOutlay {
  functionName: string;
  outlays: number; // dollars; may be negative (undistributed offsetting receipts)
}

export interface ReceiptLine {
  category: Category;
  amount: number; // user dollars, rounded to cents
  share: number; // 0..1 share of total outlays
}

export interface BorrowedLine {
  spentPer100: number; // "For every $100 you paid in, Washington spent $X"
  borrowedPer100: number; // the extra borrowed (0 if surplus)
}

/**
 * v1 method (spec §11): proportional-to-total-outlays.
 * User's estimated tax × each function's share of total NET outlays.
 * Negative functions (offsetting receipts) net into their category, so
 * category amounts always sum to exactly the user's tax (largest-remainder
 * rounding on cents).
 */
export function allocateReceipt(
  estimatedTax: number,
  outlays: FunctionOutlay[],
): ReceiptLine[] {
  const total = outlays.reduce((s, f) => s + f.outlays, 0);
  if (!(total > 0)) throw new Error("Total outlays must be positive");
  if (estimatedTax < 0) throw new Error("estimatedTax must be >= 0");

  const byCategory = new Map<Category, number>();
  for (const c of CATEGORIES) byCategory.set(c, 0);
  for (const f of outlays) {
    const c = categoryForFunction(f.functionName);
    byCategory.set(c, byCategory.get(c)! + f.outlays);
  }

  // Exact cents via largest-remainder so the receipt sums to the tax paid.
  const centsTotal = Math.round(estimatedTax * 100);
  const lines = CATEGORIES.map((category) => {
    const share = byCategory.get(category)! / total;
    const exactCents = share * centsTotal;
    return { category, share, floor: Math.floor(exactCents), rem: exactCents - Math.floor(exactCents) };
  });
  let remainder = centsTotal - lines.reduce((s, l) => s + l.floor, 0);
  for (const l of [...lines].sort((a, b) => b.rem - a.rem)) {
    if (remainder <= 0) break;
    l.floor += 1;
    remainder -= 1;
  }

  return lines
    .map(({ category, share, floor }) => ({ category, share, amount: floor / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

/** Ratio computed from actual receipts/outlays — never hardcoded (spec §6 step 3). */
export function borrowedDollarLine(totalReceipts: number, totalOutlays: number): BorrowedLine {
  if (!(totalReceipts > 0)) throw new Error("Total receipts must be positive");
  const spentPer100 = Math.round((totalOutlays / totalReceipts) * 100);
  return { spentPer100, borrowedPer100: Math.max(0, spentPer100 - 100) };
}
