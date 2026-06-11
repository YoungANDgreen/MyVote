/**
 * Starter list of final-passage roll calls (spec §16 task 4).
 *
 * ⚠ VERIFY-AT-FIRST-RUN: bill ↔ roll-call numbers below were set offline
 * (sandbox blocked clerk.house.gov / senate.gov). Confirm each at:
 *   House:  https://clerk.house.gov/Votes  (year + roll number)
 *   Senate: https://www.senate.gov/legislative/votes_new.htm (congress, session, number)
 * Fixture mode ships matching fixture XML for exactly these references.
 */
export interface VoteRef {
  billId: string; // canonical, e.g. "hr1-119"
  shortTitle: string;
  congress: number;
  house?: { year: number; roll: number; session: 1 | 2 };
  senate?: { session: 1 | 2; number: number };
}

export const STARTER_VOTES: VoteRef[] = [
  {
    billId: "hr1-119",
    shortTitle: "One Big Beautiful Bill Act",
    congress: 119,
    house: { year: 2025, roll: 190, session: 1 }, // VERIFY roll number
    senate: { session: 1, number: 244 }, // VERIFY vote number
  },
  {
    billId: "s5-119",
    shortTitle: "Laken Riley Act",
    congress: 119,
    house: { year: 2025, roll: 23, session: 1 }, // VERIFY
    senate: { session: 1, number: 12 }, // VERIFY
  },
  {
    billId: "hr4-119",
    shortTitle: "Rescissions Act of 2025",
    congress: 119,
    house: { year: 2025, roll: 145, session: 1 }, // VERIFY
    senate: { session: 1, number: 190 }, // VERIFY
  },
];
