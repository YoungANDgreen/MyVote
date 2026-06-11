/**
 * Local rarity factors: joins what a county PAID IN (IRS SOI county_tax)
 * with what flowed BACK (USAspending geo_spending, county layer) to produce
 * the inputs computeRarity() needs. Pure functions — callers pass rows.
 */
import { percentileOf } from "./engine";

export interface GeoCountyRow {
  geoId: string; // 5-digit FIPS
  amount: number; // federal award inflow, dollars
  perCapita: number | null;
}

export interface CountyTaxRow {
  countyFips: string;
  returns: number;
  incomeTaxThousands: number;
}

export interface LocalFactors {
  countyFips: string;
  inflow: number; // dollars back (awards)
  taxPaid: number; // dollars in (income tax)
  returnPer100: number; // dollars back per $100 paid in
  inflowPercentile: number; // per-capita inflow vs all counties, 0..1
  avgTaxPerReturn: number; // for the local tax-paid percentile / card copy
}

export function computeLocalFactors(
  countyFips: string,
  geoRows: GeoCountyRow[],
  taxRows: CountyTaxRow[],
): LocalFactors {
  const geo = geoRows.find((g) => g.geoId === countyFips);
  if (!geo) throw new Error(`No geo_spending county row for FIPS ${countyFips}`);
  const tax = taxRows.find((t) => t.countyFips === countyFips);
  if (!tax) throw new Error(`No county_tax row for FIPS ${countyFips}`);

  const taxPaid = tax.incomeTaxThousands * 1000;
  if (!(taxPaid > 0)) throw new Error(`County ${countyFips} has nonpositive income tax paid`);

  const population = geoRows
    .filter((g) => g.perCapita !== null)
    .map((g) => g.perCapita as number);

  return {
    countyFips,
    inflow: geo.amount,
    taxPaid,
    returnPer100: (geo.amount / taxPaid) * 100,
    inflowPercentile:
      geo.perCapita === null ? 0.5 : percentileOf(geo.perCapita, population),
    avgTaxPerReturn: taxPaid / tax.returns,
  };
}
