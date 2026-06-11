import { describe, expect, it } from "vitest";
import { allocateReceipt, borrowedDollarLine, FunctionOutlay } from "../src/receipt/engine";
import { categoryForFunction } from "../src/receipt/categories";

const OUTLAYS: FunctionOutlay[] = [
  { functionName: "Social Security", outlays: 1_520_000 },
  { functionName: "Medicare", outlays: 1_100_000 },
  { functionName: "Health", outlays: 950_000 },
  { functionName: "Net Interest", outlays: 950_000 },
  { functionName: "National Defense", outlays: 886_000 },
  { functionName: "Income Security", outlays: 700_000 },
  { functionName: "Veterans Benefits and Services", outlays: 350_000 },
  { functionName: "Education, Training, Employment, and Social Services", outlays: 270_000 },
  { functionName: "Transportation", outlays: 145_000 },
  { functionName: "Agriculture", outlays: 38_000 },
  { functionName: "Undistributed Offsetting Receipts", outlays: -110_000 },
];

describe("allocateReceipt", () => {
  it("category amounts sum exactly to the tax paid", () => {
    const lines = allocateReceipt(8_114, OUTLAYS);
    const sum = lines.reduce((s, l) => s + l.amount, 0);
    expect(Math.round(sum * 100)).toBe(8_114 * 100);
  });

  it("maps functions to the locked plain-English categories", () => {
    expect(categoryForFunction("Medicare")).toBe("Health care for seniors & low-income families");
    expect(categoryForFunction("Health")).toBe("Health care for seniors & low-income families");
    expect(categoryForFunction("Net Interest")).toBe("Interest on the debt");
    expect(categoryForFunction("General Science, Space, and Technology")).toBe(
      "Science, space & environment",
    );
    // unmapped / novel functions can never silently vanish
    expect(categoryForFunction("Some Future Budget Function")).toBe("Everything else");
    expect(categoryForFunction("Income Security")).toBe("Everything else");
  });

  it("biggest line is health care (Medicare + Medicaid combined), sorted first", () => {
    const lines = allocateReceipt(10_000, OUTLAYS);
    expect(lines[0].category).toBe("Health care for seniors & low-income families");
    expect(lines[0].amount).toBeGreaterThan(lines[1].amount);
  });

  it("negative functions net into their category without breaking the sum", () => {
    const lines = allocateReceipt(100, OUTLAYS);
    const everythingElse = lines.find((l) => l.category === "Everything else")!;
    // 700,000 income security − 110,000 offsetting receipts = 590,000 net
    expect(everythingElse.amount).toBeGreaterThan(0);
    expect(Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100)).toBe(100 * 100);
  });

  it("rejects nonpositive total outlays", () => {
    expect(() => allocateReceipt(100, [{ functionName: "X", outlays: -5 }])).toThrow();
  });
});

describe("borrowedDollarLine", () => {
  it("computes spent-per-$100 from actual receipts vs outlays", () => {
    // fixture-year numbers: 7,179,000 outlays / 5,600,000 receipts → $128
    const line = borrowedDollarLine(5_600_000, 7_179_000);
    expect(line.spentPer100).toBe(128);
    expect(line.borrowedPer100).toBe(28);
  });

  it("a surplus year shows $0 borrowed, not negative", () => {
    const line = borrowedDollarLine(100, 95);
    expect(line.spentPer100).toBe(95);
    expect(line.borrowedPer100).toBe(0);
  });
});
