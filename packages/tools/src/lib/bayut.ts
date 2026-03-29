// Bayut listing scraper stub — wire real Bayut scraper in Phase 2

const STUB = { status: "stub" as const, message: "Bayut scraper not yet connected. Wire real implementation in Phase 2." };

export async function scrapeBayutListings(_opts: {
  purpose: string;
  location: string;
  bedrooms?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  furnishing?: string;
  sortBy?: string;
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}

export async function scrapeDxbTransactions(_opts: {
  area: string;
  building?: string;
  transactionType?: string;
  days?: number;
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}
