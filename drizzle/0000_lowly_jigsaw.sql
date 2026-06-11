CREATE TABLE "email_subscribers" (
	"email" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"district" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_totals" (
	"fiscal_year" integer PRIMARY KEY NOT NULL,
	"total_receipts" numeric(20, 2) NOT NULL,
	"total_outlays" numeric(20, 2) NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_spending" (
	"fiscal_year" integer NOT NULL,
	"geo_layer" text NOT NULL,
	"geo_id" text NOT NULL,
	"display_name" text NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"population" integer,
	"per_capita" numeric(14, 2),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "geo_spending_fiscal_year_geo_layer_geo_id_pk" PRIMARY KEY("fiscal_year","geo_layer","geo_id")
);
--> statement-breakpoint
CREATE TABLE "member_votes" (
	"vote_id" text NOT NULL,
	"bioguide_id" text NOT NULL,
	"position" text NOT NULL,
	CONSTRAINT "member_votes_vote_id_bioguide_id_pk" PRIMARY KEY("vote_id","bioguide_id")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"bioguide_id" text PRIMARY KEY NOT NULL,
	"chamber" text NOT NULL,
	"state" text NOT NULL,
	"district" text,
	"party" text NOT NULL,
	"full_name" text NOT NULL,
	"photo_url" text,
	"urls" jsonb,
	"current" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlays_by_function" (
	"fiscal_year" integer NOT NULL,
	"function_name" text NOT NULL,
	"outlays" numeric(20, 2) NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "outlays_by_function_fiscal_year_function_name_pk" PRIMARY KEY("fiscal_year","function_name")
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"anon_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_key" text NOT NULL,
	"answer" text NOT NULL,
	"state" text NOT NULL,
	"district" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"vote_id" text PRIMARY KEY NOT NULL,
	"congress" integer NOT NULL,
	"chamber" text NOT NULL,
	"bill_id" text,
	"question" text,
	"date" date NOT NULL,
	"result" text NOT NULL,
	"totals" jsonb
);
--> statement-breakpoint
CREATE TABLE "zip_district" (
	"zip" text NOT NULL,
	"state" text NOT NULL,
	"district" text NOT NULL,
	"is_split" boolean DEFAULT false NOT NULL,
	CONSTRAINT "zip_district_zip_district_pk" PRIMARY KEY("zip","district")
);
--> statement-breakpoint
ALTER TABLE "member_votes" ADD CONSTRAINT "member_votes_vote_id_votes_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."votes"("vote_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_votes" ADD CONSTRAINT "member_votes_bioguide_id_members_bioguide_id_fk" FOREIGN KEY ("bioguide_id") REFERENCES "public"."members"("bioguide_id") ON DELETE no action ON UPDATE no action;