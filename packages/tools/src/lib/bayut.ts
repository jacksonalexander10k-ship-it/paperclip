// Bayut listing search — requires BAYUT_API_KEY for live data.
// Falls back to a descriptive error when not configured.

const BAYUT_API_KEY = process.env.BAYUT_API_KEY;
const BAYUT_API_BASE = "https://bayut-com1.p.rapidapi.com/properties/list";

interface BayutListingResult {
  results: unknown[];
  location: string;
  message: string;
}

export async function scrapeBayutListings(opts: {
  purpose: string;
  location: string;
  bedrooms?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  furnishing?: string;
  sortBy?: string;
}): Promise<BayutListingResult> {
  if (!BAYUT_API_KEY) {
    return {
      results: [],
      location: opts.location,
      message:
        "Bayut API requires BAYUT_API_KEY environment variable (RapidAPI key for bayut-com1.p.rapidapi.com). " +
        "Set this to enable live listing search. Without it, use search_projects or manage_property to query local inventory instead.",
    };
  }

  try {
    const params = new URLSearchParams({
      locationExternalIDs: opts.location,
      purpose: opts.purpose === "for-rent" ? "for-rent" : "for-sale",
      hitsPerPage: "10",
      sort: opts.sortBy ?? "city-level-score",
    });
    if (opts.bedrooms) params.set("roomsMin", opts.bedrooms);
    if (opts.minPrice) params.set("priceMin", String(opts.minPrice));
    if (opts.maxPrice) params.set("priceMax", String(opts.maxPrice));
    if (opts.propertyType) params.set("categoryExternalID", opts.propertyType);
    if (opts.furnishing) params.set("furnishingStatus", opts.furnishing);

    const res = await fetch(`${BAYUT_API_BASE}?${params.toString()}`, {
      headers: {
        "X-RapidAPI-Key": BAYUT_API_KEY,
        "X-RapidAPI-Host": "bayut-com1.p.rapidapi.com",
      },
    });

    if (!res.ok) {
      return {
        results: [],
        location: opts.location,
        message: `Bayut API returned HTTP ${res.status}. Check BAYUT_API_KEY validity.`,
      };
    }

    const data = (await res.json()) as { hits?: unknown[] };
    return {
      results: data.hits ?? [],
      location: opts.location,
      message: `Found ${data.hits?.length ?? 0} listings in ${opts.location}.`,
    };
  } catch (err) {
    return {
      results: [],
      location: opts.location,
      message: `Bayut API fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function scrapeDxbTransactions(opts: {
  area: string;
  building?: string;
  transactionType?: string;
  days?: number;
}): Promise<{ results: never[]; area: string; message: string }> {
  return {
    results: [],
    area: opts.area,
    message:
      "DXB Interact scraper is not connected. Live transaction scraping is unavailable. " +
      "Use search_dld_transactions instead — it queries the synced DLD transaction database " +
      "which contains historical sale prices, mortgage data, and market averages for Dubai properties.",
  };
}
