import { describe, expect, it } from "vitest";
import { computeRarity, percentileOf, returnExtremity, TIERS } from "../src/rarity/engine";

describe("computeRarity", () => {
  it("is deterministic — same inputs, same card", () => {
    const inputs = { taxPercentile: 0.7, localInflowPercentile: 0.4, localReturnPer100: 130 };
    expect(computeRarity(inputs)).toEqual(computeRarity(inputs));
  });

  it("typical user in a typical county pulls a Common", () => {
    const r = computeRarity({
      taxPercentile: 0.5,
      localInflowPercentile: 0.5,
      localReturnPer100: 100, // exactly average return → zero extremity
    });
    expect(r.tier).toBe("Common");
  });

  it("maxed-out factors pull a Legendary", () => {
    const r = computeRarity({
      taxPercentile: 1,
      localInflowPercentile: 1,
      localReturnPer100: 400, // wildly atypical return ratio
    });
    expect(r.tier).toBe("Legendary");
    expect(r.score).toBeGreaterThanOrEqual(0.975);
  });

  it("extremity is direction-neutral: donor and recipient counties score alike", () => {
    expect(returnExtremity(40)).toBeCloseTo(returnExtremity(160)); // ±60 from 100
  });

  it("clamps out-of-range percentiles instead of exploding scores", () => {
    const r = computeRarity({ taxPercentile: 7, localInflowPercentile: -2, localReturnPer100: 100 });
    expect(r.score).toBeLessThanOrEqual(1);
    expect(r.factors.localInflowPercentile).toBe(0);
  });

  it("rejects non-finite inputs", () => {
    expect(() =>
      computeRarity({ taxPercentile: NaN, localInflowPercentile: 0.5, localReturnPer100: 100 }),
    ).toThrow();
  });

  it("tier ladder is ordered", () => {
    expect(TIERS).toEqual(["Common", "Uncommon", "Rare", "Epic", "Legendary"]);
  });
});

describe("percentileOf", () => {
  it("ranks a value within a population", () => {
    expect(percentileOf(5, [1, 2, 3, 4, 6, 7, 8, 9, 10])).toBeCloseTo(4 / 9);
    expect(percentileOf(100, [1, 2, 3])).toBe(1);
    expect(percentileOf(0, [1, 2, 3])).toBe(0);
  });

  it("handles ties with mean rank and empty populations neutrally", () => {
    expect(percentileOf(2, [1, 2, 2, 3])).toBeCloseTo((1 + 1) / 4);
    expect(percentileOf(42, [])).toBe(0.5);
  });
});
