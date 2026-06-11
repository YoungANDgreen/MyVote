/**
 * ingest:votes — final-passage roll calls into votes + member_votes.
 *
 * DECISION (docs/decisions.md D5): primary sources are House Clerk XML
 * (clerk.house.gov/evs/{year}/roll{NNN}.xml) and Senate.gov LIS XML
 * (vote_{congress}_{session}_{NNNNN}.xml) — stable public formats covering
 * every roll call. The Congress.gov house-votes API remains beta/unverified.
 *
 * Identity: House XML carries bioguide ids directly (legislator name-id);
 * Senate XML carries LIS ids, resolved via members.lis_id — so ingest:members
 * MUST run first. Any unresolvable voter aborts the run (a partially scored
 * vote would corrupt alignment math downstream).
 *
 * Run: npm run ingest:votes        (all starter votes, see votes-config.ts)
 * Idempotent upserts; safe to re-run.
 */
import "dotenv/config";
import { XMLParser } from "fast-xml-parser";
import { eq } from "drizzle-orm";
import { db, sql } from "../src/db/client";
import { members, memberVotes, votes } from "../src/db/schema";
import { liveTextFetcher, TextFetcher } from "./lib/http";
import { pickTextFetcher } from "./lib/fixtures";
import { STARTER_VOTES, VoteRef } from "./votes-config";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export type Position = "Yea" | "Nay" | "Present" | "Not Voting";

export function normalizePosition(raw: string): Position {
  const v = raw.trim().toLowerCase();
  if (v === "yea" || v === "aye" || v === "yes") return "Yea";
  if (v === "nay" || v === "no") return "Nay";
  if (v.startsWith("present")) return "Present";
  if (v === "not voting" || v === "novote" || v === "absent") return "Not Voting";
  throw new Error(`Unrecognized vote position: "${raw}"`);
}

interface ParsedVote {
  voteId: string;
  chamber: "house" | "senate";
  question: string;
  date: string; // ISO yyyy-mm-dd
  result: string;
  positions: { bioguideId: string; position: Position; party: string }[];
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** House dates look like "22-May-2025"; Senate like "January 20, 2025, 05:34 PM". */
export function parseVoteDate(raw: string): string {
  const house = raw.match(/^(\d{1,2})-([A-Za-z]{3})[a-z]*-(\d{4})$/);
  if (house) {
    const mm = MONTHS[house[2].slice(0, 3).toLowerCase()];
    if (mm) return `${house[3]}-${mm}-${house[1].padStart(2, "0")}`;
  }
  const senate = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (senate) {
    const mm = MONTHS[senate[1].slice(0, 3).toLowerCase()];
    if (mm) return `${senate[3]}-${mm}-${senate[2].padStart(2, "0")}`;
  }
  throw new Error(`Unparseable vote date: "${raw}"`);
}

function asArray<T>(x: T | T[] | undefined): T[] {
  return x === undefined ? [] : Array.isArray(x) ? x : [x];
}

function parseHouseXml(xml: string, ref: VoteRef): ParsedVote {
  const doc = parser.parse(xml);
  const meta = doc["rollcall-vote"]?.["vote-metadata"];
  const recorded = asArray(doc["rollcall-vote"]?.["vote-data"]?.["recorded-vote"]);
  if (!meta || recorded.length === 0) {
    throw new Error(`House roll ${ref.house!.roll}/${ref.house!.year}: unexpected XML shape`);
  }
  return {
    voteId: `h${ref.congress}-${ref.house!.session}-${ref.house!.roll}`,
    chamber: "house",
    question: String(meta["vote-question"]),
    date: parseVoteDate(String(meta["action-date"])),
    result: String(meta["vote-result"]),
    positions: recorded.map((rv: any) => ({
      bioguideId: String(rv.legislator["@_name-id"]),
      party: String(rv.legislator["@_party"] ?? "?"),
      position: normalizePosition(String(rv.vote)),
    })),
  };
}

function parseSenateXml(xml: string, ref: VoteRef, lisToBioguide: Map<string, string>): ParsedVote {
  const doc = parser.parse(xml);
  const root = doc["roll_call_vote"];
  const memberRows = asArray(root?.members?.member);
  if (!root || memberRows.length === 0) {
    throw new Error(`Senate vote ${ref.senate!.number}: unexpected XML shape`);
  }
  const unmatched: string[] = [];
  const positions = memberRows.map((m: any) => {
    const lis = String(m.lis_member_id);
    const bioguideId = lisToBioguide.get(lis);
    if (!bioguideId) unmatched.push(`${lis} (${m.member_full ?? m.last_name})`);
    return {
      bioguideId: bioguideId ?? lis,
      party: String(m.party ?? "?"),
      position: normalizePosition(String(m.vote_cast)),
    };
  });
  if (unmatched.length > 0) {
    throw new Error(
      `Senate vote ${ref.senate!.number}: ${unmatched.length} LIS ids not in members table ` +
        `(run ingest:members first): ${unmatched.slice(0, 10).join(", ")}`,
    );
  }
  return {
    voteId: `s${ref.congress}-${ref.senate!.session}-${String(ref.senate!.number).padStart(5, "0")}`,
    chamber: "senate",
    question: String(root.question),
    date: parseVoteDate(String(root.vote_date)),
    result: String(root.vote_result),
    positions,
  };
}

export function buildTotals(positions: ParsedVote["positions"]) {
  const blank = () => ({ yea: 0, nay: 0, present: 0, notVoting: 0 });
  const keyOf = (p: Position) =>
    p === "Yea" ? "yea" : p === "Nay" ? "nay" : p === "Present" ? "present" : "notVoting";
  const all = blank();
  const byParty: Record<string, ReturnType<typeof blank>> = {};
  for (const { party, position } of positions) {
    const k = keyOf(position) as keyof ReturnType<typeof blank>;
    all[k] += 1;
    byParty[party] ??= blank();
    byParty[party][k] += 1;
  }
  return { ...all, byParty };
}

async function upsertVote(parsed: ParsedVote, ref: VoteRef) {
  await db
    .insert(votes)
    .values({
      voteId: parsed.voteId,
      congress: ref.congress,
      chamber: parsed.chamber,
      billId: ref.billId,
      question: parsed.question,
      date: parsed.date,
      result: parsed.result,
      totals: buildTotals(parsed.positions),
    })
    .onConflictDoUpdate({
      target: votes.voteId,
      set: {
        question: parsed.question,
        date: parsed.date,
        result: parsed.result,
        totals: buildTotals(parsed.positions),
      },
    });
  for (const p of parsed.positions) {
    await db
      .insert(memberVotes)
      .values({ voteId: parsed.voteId, bioguideId: p.bioguideId, position: p.position })
      .onConflictDoUpdate({
        target: [memberVotes.voteId, memberVotes.bioguideId],
        set: { position: p.position },
      });
  }
}

export async function ingestVotes(
  refs: VoteRef[] = STARTER_VOTES,
  fetcher: TextFetcher = liveTextFetcher,
): Promise<{ votes: number; positions: number }> {
  const senators = await db
    .select({ lisId: members.lisId, bioguideId: members.bioguideId })
    .from(members)
    .where(eq(members.chamber, "senate"));
  const lisToBioguide = new Map(
    senators.filter((s) => s.lisId).map((s) => [s.lisId!, s.bioguideId]),
  );

  let voteCount = 0;
  let positionCount = 0;
  for (const ref of refs) {
    if (ref.house) {
      const xml = await fetcher(
        `https://clerk.house.gov/evs/${ref.house.year}/roll${String(ref.house.roll).padStart(3, "0")}.xml`,
      );
      const parsed = parseHouseXml(xml, ref);
      await upsertVote(parsed, ref);
      voteCount++;
      positionCount += parsed.positions.length;
    }
    if (ref.senate) {
      const xml = await fetcher(
        `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${ref.congress}${ref.senate.session}/vote_${ref.congress}_${ref.senate.session}_${String(ref.senate.number).padStart(5, "0")}.xml`,
      );
      const parsed = parseSenateXml(xml, ref, lisToBioguide);
      await upsertVote(parsed, ref);
      voteCount++;
      positionCount += parsed.positions.length;
    }
  }
  return { votes: voteCount, positions: positionCount };
}

if (typeof require !== "undefined" && require.main === module) {
  ingestVotes(STARTER_VOTES, pickTextFetcher(liveTextFetcher))
    .then(async (r) => {
      console.log(`✔ ${r.votes} roll calls upserted (${r.positions} member positions)`);
      await sql.end();
    })
    .catch(async (err) => {
      console.error("✘ ingest:votes failed:", err.message ?? err);
      await sql.end();
      process.exit(1);
    });
}
