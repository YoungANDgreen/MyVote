CREATE TABLE "county_tax" (
	"tax_year" integer NOT NULL,
	"county_fips" text NOT NULL,
	"state" text NOT NULL,
	"county_name" text NOT NULL,
	"returns" integer NOT NULL,
	"agi_thousands" numeric(20, 2) NOT NULL,
	"income_tax_thousands" numeric(20, 2) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "county_tax_tax_year_county_fips_pk" PRIMARY KEY("tax_year","county_fips")
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "lis_id" text;