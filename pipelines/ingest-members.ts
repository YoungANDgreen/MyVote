/**
 * ingest:members — current members of Congress from the canonical
 * unitedstates/congress-legislators repo (raw YAML from GitHub; the published
 * JSON mirrors are not always available). Refresh weekly (spec §9).
 *
 * Photo URL strategy: the companion unitedstates/images repo serves
 * 450x550 jpgs keyed by bioguide id — no scraping, stable URLs.
 *
 * Idempotent: upserts everyone in the file with current=true, then flips
 * current=false for anyone in our table who left (never deletes — old
 * roll-call rows still need their member).
 */
import "dotenv/config";
import { notInArray } from "drizzle-orm";
import YAML from "yaml";
import { db, sql } from "../src/db/client";
import { members } from "../src/db/schema";
import { liveTextFetcher, TextFetcher } from "./lib/http";
import { pickTextFetcher } from "./lib/fixtures";

const SOURCE =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml";

interface Legislator {
  id: { bioguide: string; lis?: string };
  name: { official_full?: string; first: string; last: string };
  terms: {
    type: "rep" | "sen";
    start: string;
    end: string;
    state: string;
    district?: number;
    party?: string;
    url?: string;
    contact_form?: string;
  }[];
}

export async function ingestMembers(fetcher: TextFetcher = liveTextFetcher): Promise<{
  upserted: number;
  house: number;
  senate: number;
  markedNotCurrent: number;
}> {
  const raw = await fetcher(SOURCE);
  const legislators = YAML.parse(raw) as Legislator[];
  if (!Array.isArray(legislators) || legislators.length === 0) {
    throw new Error("legislators-current.yaml parsed to an empty/non-array result");
  }
  // Sanity: a full current file is ~535 ± vacancies. A partial file (the
  // fixture) is allowed only in fixture mode.
  if (process.env.PIPELINE_FIXTURES !== "1" && legislators.length < 500) {
    throw new Error(`Only ${legislators.length} legislators in file — expected ~535. Truncated download?`);
  }

  let house = 0;
  let senate = 0;
  const seen: string[] = [];

  for (const leg of legislators) {
    const term = leg.terms[leg.terms.length - 1];
    if (!term || !leg.id?.bioguide) {
      throw new Error(`Malformed legislator entry: ${JSON.stringify(leg?.id)}`);
    }
    const chamber = term.type === "sen" ? "senate" : "house";
    chamber === "house" ? house++ : senate++;
    seen.push(leg.id.bioguide);

    const row = {
      bioguideId: leg.id.bioguide,
      lisId: leg.id.lis ?? null,
      chamber,
      state: term.state,
      district:
        chamber === "house" ? String(term.district ?? 0).padStart(2, "0") : null,
      party: term.party ?? "Unknown",
      fullName: leg.name.official_full ?? `${leg.name.first} ${leg.name.last}`,
      photoUrl: `https://unitedstates.github.io/images/congress/450x550/${leg.id.bioguide}.jpg`,
      urls: { website: term.url ?? null, contactForm: term.contact_form ?? null },
    };
    await db
      .insert(members)
      .values({ ...row, current: true })
      .onConflictDoUpdate({
        target: members.bioguideId,
        set: { ...row, current: true, updatedAt: new Date() },
      });
  }

  const departed = await db
    .update(members)
    .set({ current: false, updatedAt: new Date() })
    .where(notInArray(members.bioguideId, seen))
    .returning({ bioguideId: members.bioguideId });

  return { upserted: seen.length, house, senate, markedNotCurrent: departed.length };
}

if (typeof require !== "undefined" && require.main === module) {
  ingestMembers(pickTextFetcher(liveTextFetcher))
    .then(async (r) => {
      console.log(
        `✔ ${r.upserted} current members upserted (${r.house} House, ${r.senate} Senate); ` +
          `${r.markedNotCurrent} marked not-current`,
      );
      await sql.end();
    })
    .catch(async (err) => {
      console.error("✘ ingest:members failed:", err.message ?? err);
      await sql.end();
      process.exit(1);
    });
}
