/**
 * M1 integration tests (require DATABASE_URL): members + votes pipelines.
 * Spec §16 task 5: upsert idempotency (run twice, counts stable) and
 * member_votes position parsing including Present / Not Voting.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { sql as pg, db } from "../src/db/client";
import { members, memberVotes, votes } from "../src/db/schema";
import { ingestMembers } from "../pipelines/ingest-members";
import { ingestVotes, normalizePosition, parseVoteDate, buildTotals } from "../pipelines/ingest-votes";
import { STARTER_VOTES } from "../pipelines/votes-config";
import { fixtureTextFetcher } from "../pipelines/lib/fixtures";

process.env.PIPELINE_FIXTURES = "1"; // fixture file is a partial chamber

beforeAll(async () => {
  await db.delete(memberVotes);
  await db.delete(votes);
  await db.delete(members);
});

afterAll(async () => {
  await pg.end();
});

describe("ingest:members", () => {
  it("ingests current members from the legislators file and is idempotent", async () => {
    const first = await ingestMembers(fixtureTextFetcher);
    expect(first.upserted).toBe(24);
    expect(first.senate).toBe(12);
    expect(first.house).toBe(12);

    await ingestMembers(fixtureTextFetcher);
    expect(await db.$count(members)).toBe(24);
  });

  it("stores senate LIS ids and zero-padded house districts", async () => {
    const [kelly] = await db.select().from(members).where(eq(members.bioguideId, "K000377"));
    expect(kelly.lisId).toBe("S406");
    expect(kelly.chamber).toBe("senate");
    expect(kelly.district).toBeNull();

    const [schweikert] = await db.select().from(members).where(eq(members.bioguideId, "S001183"));
    expect(schweikert.district).toBe("01");
    expect(schweikert.state).toBe("AZ");
    expect(schweikert.photoUrl).toContain("S001183.jpg");
  });
});

describe("ingest:votes", () => {
  it("ingests starter roll calls (both chambers) and is idempotent", async () => {
    const first = await ingestVotes(STARTER_VOTES, fixtureTextFetcher);
    expect(first.votes).toBe(6); // 3 bills × 2 chambers
    expect(first.positions).toBe(6 * 12);

    await ingestVotes(STARTER_VOTES, fixtureTextFetcher);
    expect(await db.$count(votes)).toBe(6);
    expect(await db.$count(memberVotes)).toBe(72);
  });

  it("parses Present and Not Voting positions (spec user story 7)", async () => {
    const rows = await db
      .select()
      .from(memberVotes)
      .where(eq(memberVotes.voteId, "h119-1-190"));
    const positions = new Map(rows.map((r) => [r.bioguideId, r.position]));
    expect(positions.get("G000568")).toBe("Not Voting"); // index 5 in fixture
    expect(positions.get("L000560")).toBe("Present"); // index 7 in fixture
  });

  it("resolves senate LIS ids to bioguide ids", async () => {
    const rows = await db
      .select()
      .from(memberVotes)
      .where(eq(memberVotes.voteId, "s119-1-00244"));
    const ids = rows.map((r) => r.bioguideId);
    expect(ids).toContain("K000377"); // Kelly via S406
    expect(ids).toContain("G000574"); // Gallego via S432
    expect(ids.some((id) => id.startsWith("S4"))).toBe(false); // no raw LIS ids leaked
  });

  it("stores per-party tallies in votes.totals", async () => {
    const [vote] = await db.select().from(votes).where(eq(votes.voteId, "h119-1-190"));
    const totals = vote.totals as any;
    expect(totals.yea + totals.nay + totals.present + totals.notVoting).toBe(12);
    expect(totals.byParty.R.yea).toBeGreaterThan(0);
    expect(totals.byParty.D.nay).toBeGreaterThan(0);
    expect(vote.billId).toBe("hr1-119");
  });
});

describe("vote parsing units", () => {
  it("normalizes positions across chamber vocabularies", () => {
    expect(normalizePosition("Aye")).toBe("Yea");
    expect(normalizePosition("No")).toBe("Nay");
    expect(normalizePosition("Present, Giving Live Pair")).toBe("Present");
    expect(normalizePosition("Not Voting")).toBe("Not Voting");
    expect(() => normalizePosition("Maybe")).toThrow();
  });

  it("parses both chambers' date formats", () => {
    expect(parseVoteDate("3-Jul-2025")).toBe("2025-07-03");
    expect(parseVoteDate("22-Jan-2025")).toBe("2025-01-22");
    expect(parseVoteDate("January 20, 2025, 05:34 PM")).toBe("2025-01-20");
    expect(() => parseVoteDate("someday")).toThrow();
  });

  it("buildTotals splits by party", () => {
    const t = buildTotals([
      { bioguideId: "a", party: "R", position: "Yea" },
      { bioguideId: "b", party: "D", position: "Nay" },
      { bioguideId: "c", party: "D", position: "Not Voting" },
    ]);
    expect(t).toMatchObject({ yea: 1, nay: 1, notVoting: 1, present: 0 });
    expect(t.byParty.D.notVoting).toBe(1);
  });
});
