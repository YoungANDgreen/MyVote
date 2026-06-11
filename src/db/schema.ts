import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ── Spec §10 core tables ────────────────────────────────────────────────────

export const members = pgTable("members", {
  bioguideId: text("bioguide_id").primaryKey(),
  // Senate.gov roll-call XML identifies senators by LIS id, not bioguide
  lisId: text("lis_id"),
  chamber: text("chamber").notNull(), // 'house' | 'senate'
  state: text("state").notNull(),
  district: text("district"), // zero-padded ("01"; "00" = at-large); null for senators
  party: text("party").notNull(),
  fullName: text("full_name").notNull(),
  photoUrl: text("photo_url"),
  urls: jsonb("urls"),
  current: boolean("current").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const votes = pgTable("votes", {
  voteId: text("vote_id").primaryKey(),
  congress: integer("congress").notNull(),
  chamber: text("chamber").notNull(),
  billId: text("bill_id"),
  question: text("question"),
  date: date("date").notNull(),
  result: text("result").notNull(),
  totals: jsonb("totals"), // incl. party split
});

export const memberVotes = pgTable(
  "member_votes",
  {
    voteId: text("vote_id")
      .notNull()
      .references(() => votes.voteId),
    bioguideId: text("bioguide_id")
      .notNull()
      .references(() => members.bioguideId),
    position: text("position").notNull(), // Yea | Nay | Present | Not Voting
  },
  (t) => [primaryKey({ columns: [t.voteId, t.bioguideId] })],
);

export const zipDistrict = pgTable(
  "zip_district",
  {
    zip: text("zip").notNull(),
    state: text("state").notNull(),
    district: text("district").notNull(),
    isSplit: boolean("is_split").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.zip, t.district] })],
);

export const responses = pgTable("responses", {
  anonId: uuid("anon_id").notNull(), // client-generated UUID; NO ip, NO address, NO email linkage
  itemType: text("item_type").notNull(), // 'line_item' | 'card'
  itemKey: text("item_key").notNull(),
  answer: text("answer").notNull(),
  state: text("state").notNull(),
  district: text("district").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailSubscribers = pgTable("email_subscribers", {
  // deliberately NOT joinable to responses (no anon_id column)
  email: text("email").primaryKey(),
  state: text("state").notNull(),
  district: text("district").notNull(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Spending data (receipt engine + rarity engine) ──────────────────────────

// FY totals: receipts vs outlays → the borrowed-dollar line ("per $100 paid in").
export const fiscalTotals = pgTable("fiscal_totals", {
  fiscalYear: integer("fiscal_year").primaryKey(),
  totalReceipts: numeric("total_receipts", { precision: 20, scale: 2 }).notNull(),
  totalOutlays: numeric("total_outlays", { precision: 20, scale: 2 }).notNull(),
  source: text("source").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Outlays by budget function for a fiscal year → the receipt allocation.
export const outlaysByFunction = pgTable(
  "outlays_by_function",
  {
    fiscalYear: integer("fiscal_year").notNull(),
    functionName: text("function_name").notNull(), // normalized official name, e.g. "National Defense"
    outlays: numeric("outlays", { precision: 20, scale: 2 }).notNull(),
    source: text("source").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.fiscalYear, t.functionName] })],
);

// Federal award spending flowing INTO a geography (USAspending spending_by_geography).
// geoLayer: 'state' | 'county' | 'district'. geoId is USAspending's shape_code
// (state FIPS, county FIPS, or e.g. "AZ01"). Powers the local card + rarity percentiles.
export const geoSpending = pgTable(
  "geo_spending",
  {
    fiscalYear: integer("fiscal_year").notNull(),
    geoLayer: text("geo_layer").notNull(),
    geoId: text("geo_id").notNull(),
    displayName: text("display_name").notNull(),
    amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
    population: integer("population"),
    perCapita: numeric("per_capita", { precision: 14, scale: 2 }),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.fiscalYear, t.geoLayer, t.geoId] })],
);

// IRS SOI county totals: what each county PAID IN. Joined with geo_spending
// (countyFips = geo_spending.geo_id for the county layer) it yields the local
// "dollars back per $100 paid in" ratio for the rarity engine.
export const countyTax = pgTable(
  "county_tax",
  {
    taxYear: integer("tax_year").notNull(),
    countyFips: text("county_fips").notNull(), // 5-digit state+county FIPS
    state: text("state").notNull(),
    countyName: text("county_name").notNull(),
    returns: integer("returns").notNull(),
    agiThousands: numeric("agi_thousands", { precision: 20, scale: 2 }).notNull(),
    incomeTaxThousands: numeric("income_tax_thousands", { precision: 20, scale: 2 }).notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.taxYear, t.countyFips] })],
);
