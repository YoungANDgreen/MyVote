import { describe, expect, it } from "vitest";
import { estimateFederalIncomeTax } from "../src/receipt/estimator";

describe("estimateFederalIncomeTax (tax year 2025)", () => {
  it("single, $75k: hand-computed bracket math", () => {
    // taxable 60,000 → 10%×11,925 + 12%×36,550 + 22%×11,525 = 8,114
    const r = estimateFederalIncomeTax(75_000, "single");
    expect(r.taxableIncome).toBe(60_000);
    expect(r.estimatedTax).toBe(8_114);
  });

  it("married, $100k: stays in 12% bracket", () => {
    // taxable 70,000 → 10%×23,850 + 12%×46,150 = 7,923
    const r = estimateFederalIncomeTax(100_000, "married");
    expect(r.estimatedTax).toBe(7_923);
  });

  it("income below the standard deduction owes nothing", () => {
    expect(estimateFederalIncomeTax(12_000, "single").estimatedTax).toBe(0);
    expect(estimateFederalIncomeTax(0, "married").estimatedTax).toBe(0);
  });

  it("top bracket engages for very high income", () => {
    const r = estimateFederalIncomeTax(1_000_000, "single");
    expect(r.estimatedTax).toBeGreaterThan(300_000);
    expect(r.effectiveRate).toBeLessThan(0.37);
  });

  it("rejects negative income", () => {
    expect(() => estimateFederalIncomeTax(-1, "single")).toThrow();
  });
});
