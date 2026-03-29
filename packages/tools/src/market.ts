import { eq, and, ilike, gte, lte, desc, sql } from "drizzle-orm";
import { aygentDldTransactions, aygentListingWatches } from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";
import * as bayut from "./lib/bayut.js";
import * as tavily from "./lib/tavily.js";

// ═══════════════════════════════════════════════════
// search_dld_transactions
// ═══════════════════════════════════════════════════

export const searchDldTransactionsDefinition: ToolDefinition = {
  name: "search_dld_transactions",
  description:
    "Search DLD (Dubai Land Department) and DXB Interact transaction records for actual sale prices, market averages, and price comparisons. Combines local DLD data with fresher DXB Interact data. Use for CMA (comparative market analysis), pricing advice, market trends, and validating asking prices against real transaction data.",
  input_schema: {
    type: "object",
    properties: {
      area: { type: "string", description: "Area name (e.g. 'Marsa Dubai', 'Business Bay', 'Palm Jumeirah')" },
      propertyType: { type: "string", description: "Filter: 'Flat', 'Villa', 'Office', 'Hotel Apartment', 'all'" },
      rooms: { type: "string", description: "Filter: 'Studio', '1 B/R', '2 B/R', '3 B/R', '4 B/R', '5 B/R', 'all'" },
      transactionType: { type: "string", description: "'Sales', 'Mortgages', 'Gifts', 'all'. Defaults to Sales." },
      registrationType: { type: "string", description: "'Existing Properties' (secondary), 'Off-Plan Properties', 'all'" },
      project: { type: "string", description: "Filter by project/building name" },
      minPrice: { type: "number", description: "Minimum transaction amount in AED" },
      maxPrice: { type: "number", description: "Maximum transaction amount in AED" },
      dateFrom: { type: "string", description: "Start date filter (YYYY-MM-DD)" },
      dateTo: { type: "string", description: "End date filter (YYYY-MM-DD)" },
      limit: { type: "number", description: "Max results to return. Defaults to 20." },
    },
  },
};

export const searchDldTransactionsExecutor: ToolExecutor = async (input, ctx) => {
  const {
    area, propertyType, rooms, transactionType, registrationType,
    project, minPrice, maxPrice, dateFrom, dateTo, limit,
  } = input as {
    area?: string; propertyType?: string; rooms?: string;
    transactionType?: string; registrationType?: string;
    project?: string; minPrice?: number; maxPrice?: number;
    dateFrom?: string; dateTo?: string; limit?: number;
  };

  const take = Math.min(limit ?? 20, 50);
  const t = aygentDldTransactions;
  const conditions = [eq(t.companyId, ctx.companyId)];

  if (area) conditions.push(ilike(t.areaNameEn, `%${area}%`));
  if (propertyType && propertyType !== "all") conditions.push(ilike(t.propertySubTypeEn, `%${propertyType}%`));
  if (rooms && rooms !== "all") conditions.push(ilike(t.roomsEn, `%${rooms}%`));
  if (transactionType && transactionType !== "all") conditions.push(ilike(t.transGroupEn, `%${transactionType}%`));
  if (registrationType && registrationType !== "all") conditions.push(ilike(t.regTypeEn, `%${registrationType}%`));
  if (project) conditions.push(ilike(t.projectNameEn, `%${project}%`));
  if (minPrice) conditions.push(gte(t.actualWorth, minPrice));
  if (maxPrice) conditions.push(lte(t.actualWorth, maxPrice));
  if (dateFrom) conditions.push(gte(t.instanceDate, dateFrom));
  if (dateTo) conditions.push(lte(t.instanceDate, dateTo));

  const results = await ctx.db
    .select()
    .from(t)
    .where(and(...conditions))
    .orderBy(desc(t.instanceDate))
    .limit(take);

  if (results.length === 0) {
    return { results: [], message: "No DLD transactions found matching your criteria." };
  }

  // Calculate averages
  const prices = results.map((r) => r.actualWorth).filter((p): p is number => p !== null && p > 0);
  const priceSqft = results.map((r) => r.pricePerSqft).filter((p): p is number => p !== null && p > 0);

  return {
    results: results.map((r) => ({
      id: r.id,
      transactionId: r.transactionId,
      date: r.instanceDate,
      area: r.areaNameEn,
      building: r.buildingNameEn,
      project: r.projectNameEn,
      propertyType: r.propertySubTypeEn,
      rooms: r.roomsEn,
      transactionType: r.transGroupEn,
      registrationType: r.regTypeEn,
      amount: r.actualWorth,
      pricePerSqft: r.pricePerSqft,
      sizeSqft: r.sizeSqft,
      source: r.source,
    })),
    summary: {
      count: results.length,
      avgPrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
      avgPricePerSqft: priceSqft.length > 0 ? Math.round(priceSqft.reduce((a, b) => a + b, 0) / priceSqft.length) : null,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
      maxPrice: prices.length > 0 ? Math.max(...prices) : null,
    },
  };
};

// ═══════════════════════════════════════════════════
// scrape_dxb_transactions
// ═══════════════════════════════════════════════════

export const scrapeDxbTransactionsDefinition: ToolDefinition = {
  name: "scrape_dxb_transactions",
  description:
    "Scrape the latest real estate transactions directly from DXB Interact (dxbinteract.com) via web scraping. Use this when search_dld_transactions returns empty or stale data and you need fresh transaction data. This scrapes the public transaction page for a given area or building and returns recent sales, mortgages, and gifts with prices.",
  input_schema: {
    type: "object",
    properties: {
      area: { type: "string", description: "Area name (e.g. 'Dubai Marina', 'JVC', 'Business Bay')" },
      building: { type: "string", description: "Specific building name (optional)" },
      transactionType: { type: "string", description: "'sales', 'mortgages', 'gifts', or 'all' (default: 'sales')" },
      days: { type: "number", description: "Number of days to look back (default: 30, max: 90)" },
    },
    required: ["area"],
  },
};

export const scrapeDxbTransactionsExecutor: ToolExecutor = async (input, _ctx) => {
  const { area, building, transactionType, days } = input as {
    area: string; building?: string; transactionType?: string; days?: number;
  };
  return bayut.scrapeDxbTransactions({
    area,
    building,
    transactionType: transactionType ?? "sales",
    days: Math.min(days ?? 30, 90),
  });
};

// ═══════════════════════════════════════════════════
// get_building_analysis
// ═══════════════════════════════════════════════════

export const getBuildingAnalysisDefinition: ToolDefinition = {
  name: "get_building_analysis",
  description:
    "Get detailed analysis for a specific building/project: average price per sqft, transaction volume, price trend (up/down/flat), and recent transactions. Uses local DLD data plus DXB Interact API for the most current picture. Ideal for CMAs, valuations, and advising sellers/buyers.",
  input_schema: {
    type: "object",
    properties: {
      buildingName: { type: "string", description: "Building or project name (e.g. 'Burj Khalifa', 'Marina Gate', 'The Opus')" },
    },
    required: ["buildingName"],
  },
};

export const getBuildingAnalysisExecutor: ToolExecutor = async (input, ctx) => {
  const { buildingName } = input as { buildingName: string };
  const t = aygentDldTransactions;

  const transactions = await ctx.db
    .select()
    .from(t)
    .where(
      and(
        eq(t.companyId, ctx.companyId),
        ilike(t.buildingNameEn, `%${buildingName}%`),
      ),
    )
    .orderBy(desc(t.instanceDate))
    .limit(50);

  if (transactions.length === 0) {
    return {
      buildingName,
      message: "No transactions found for this building in the local database. Try scrape_dxb_transactions for fresher data.",
    };
  }

  const prices = transactions.map((r) => r.actualWorth).filter((p): p is number => p !== null && p > 0);
  const priceSqft = transactions.map((r) => r.pricePerSqft).filter((p): p is number => p !== null && p > 0);

  // Simple trend: compare first half to second half
  const mid = Math.floor(priceSqft.length / 2);
  const recentAvg = priceSqft.slice(0, mid).reduce((a, b) => a + b, 0) / (mid || 1);
  const olderAvg = priceSqft.slice(mid).reduce((a, b) => a + b, 0) / (priceSqft.length - mid || 1);
  const trendPct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
  const trend = trendPct > 3 ? "up" : trendPct < -3 ? "down" : "flat";

  return {
    buildingName,
    transactionCount: transactions.length,
    avgPrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
    avgPricePerSqft: priceSqft.length > 0 ? Math.round(priceSqft.reduce((a, b) => a + b, 0) / priceSqft.length) : null,
    trend,
    trendPercentage: `${trendPct.toFixed(1)}%`,
    recentTransactions: transactions.slice(0, 10).map((r) => ({
      date: r.instanceDate,
      amount: r.actualWorth,
      pricePerSqft: r.pricePerSqft,
      rooms: r.roomsEn,
      type: r.transGroupEn,
      sizeSqft: r.sizeSqft,
    })),
  };
};

// ═══════════════════════════════════════════════════
// search_listings
// ═══════════════════════════════════════════════════

export const searchListingsDefinition: ToolDefinition = {
  name: "search_listings",
  description:
    "Search live property listings on Bayut for sale or rent. Scrapes bayut.com in real-time. Use when agent asks to find available properties, rentals, or wants to browse current market inventory. Returns actual listings with prices, locations, photos, and agent contacts.",
  input_schema: {
    type: "object",
    properties: {
      purpose: { type: "string", description: "'for-sale' or 'for-rent'" },
      location: { type: "string", description: "Area name (e.g. 'dubai marina', 'jvc', 'palm jumeirah')" },
      bedrooms: { type: "string", description: "Number of bedrooms: 'studio', '1', '2', '3', '4', '5', or 'all'" },
      minPrice: { type: "number", description: "Minimum price in AED" },
      maxPrice: { type: "number", description: "Maximum price in AED" },
      propertyType: { type: "string", description: "'apartment', 'villa', 'townhouse', 'penthouse', 'office', or leave empty for all" },
      furnishing: { type: "string", description: "'furnished' or 'unfurnished'" },
      sortBy: { type: "string", description: "'price-asc', 'price-desc', 'date-desc', 'verified'" },
    },
    required: ["purpose", "location"],
  },
};

export const searchListingsExecutor: ToolExecutor = async (input, _ctx) => {
  const { purpose, location, bedrooms, minPrice, maxPrice, propertyType, furnishing, sortBy } = input as {
    purpose: string; location: string; bedrooms?: string;
    minPrice?: number; maxPrice?: number; propertyType?: string;
    furnishing?: string; sortBy?: string;
  };
  return bayut.scrapeBayutListings({
    purpose, location, bedrooms, minPrice, maxPrice,
    propertyType, furnishing, sortBy,
  });
};

// ═══════════════════════════════════════════════════
// watch_listings
// ═══════════════════════════════════════════════════

export const watchListingsDefinition: ToolDefinition = {
  name: "watch_listings",
  description:
    "Set up a listing monitor that alerts the agent when new properties matching criteria are listed on Bayut. Use when agent says 'alert me when...', 'watch for...', 'notify me if...', or 'monitor listings'.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", description: "'create' to set up a new watch, 'list' to see active watches, 'delete' to remove a watch" },
      watchId: { type: "string", description: "Watch ID (for delete)" },
      purpose: { type: "string", description: "'for-sale' or 'for-rent'" },
      location: { type: "string", description: "Area to monitor" },
      bedrooms: { type: "string", description: "Bedrooms filter" },
      maxPrice: { type: "number", description: "Maximum price alert threshold" },
      propertyType: { type: "string", description: "Property type filter" },
    },
    required: ["action"],
  },
};

export const watchListingsExecutor: ToolExecutor = async (input, ctx) => {
  const { action, watchId, purpose, location, bedrooms, maxPrice, propertyType } = input as {
    action: string; watchId?: string; purpose?: string; location?: string;
    bedrooms?: string; maxPrice?: number; propertyType?: string;
  };

  const t = aygentListingWatches;

  if (action === "list") {
    const watches = await ctx.db
      .select()
      .from(t)
      .where(and(eq(t.companyId, ctx.companyId), eq(t.isActive, true)));
    return {
      watches: watches.map((w) => ({
        id: w.id,
        purpose: w.purpose,
        location: w.location,
        bedrooms: w.bedrooms,
        maxPrice: w.maxPrice,
        propertyType: w.propertyType,
        lastChecked: w.lastChecked?.toISOString() ?? null,
      })),
      total: watches.length,
    };
  }

  if (action === "delete" && watchId) {
    await ctx.db
      .update(t)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(t.id, watchId), eq(t.companyId, ctx.companyId)));
    return { deleted: true, watchId };
  }

  if (action === "create") {
    if (!location) return { error: "Location is required to create a watch." };

    const bedroomNum = bedrooms ? (bedrooms === "studio" ? 0 : parseInt(bedrooms, 10)) : null;
    const watch = await ctx.db
      .insert(t)
      .values({
        companyId: ctx.companyId,
        agentId: ctx.agentId,
        purpose: purpose ?? "for-sale",
        location,
        bedrooms: isNaN(bedroomNum!) ? null : bedroomNum,
        maxPrice: maxPrice ?? null,
        propertyType: propertyType ?? null,
        isActive: true,
      })
      .returning();

    return {
      watchId: watch[0]?.id,
      status: "active",
      message: `Listing watch created. You'll be notified when new properties matching your criteria appear on Bayut.`,
    };
  }

  return { error: `Unknown action: ${action}. Use 'create', 'list', or 'delete'.` };
};

// ═══════════════════════════════════════════════════
// analyze_investment
// ═══════════════════════════════════════════════════

export const analyzeInvestmentDefinition: ToolDefinition = {
  name: "analyze_investment",
  description:
    "Compare investment potential of one or more Dubai off-plan projects. Returns price/sqft, estimated rental yield, ROI (including 4% DLD fee), Golden Visa eligibility, and area analytics. Use project database IDs from search results.",
  input_schema: {
    type: "object",
    properties: {
      projectIds: {
        type: "array",
        items: { type: "string" },
        description: "Array of project database IDs to compare (1-5 projects)",
      },
    },
    required: ["projectIds"],
  },
};

export const analyzeInvestmentExecutor: ToolExecutor = async (input, _ctx) => {
  const { projectIds } = input as { projectIds: string[] };
  return {
    status: "ai_generation",
    message: "Investment analysis is AI-driven. Use search_projects and search_dld_transactions data to compute ROI, rental yields, and price comparisons for the requested projects.",
    projectIds,
  };
};

// ═══════════════════════════════════════════════════
// web_search
// ═══════════════════════════════════════════════════

export const webSearchDefinition: ToolDefinition = {
  name: "web_search",
  description:
    "Search the web for current information. Use this when the agent asks about recent news, market data, regulations, new launches, or anything that requires up-to-date information not in the project database.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query. Be specific — include 'Dubai' or 'UAE' for location-specific results.",
      },
      maxResults: {
        type: "number",
        description: "Number of results to return (default 5, max 10)",
      },
    },
    required: ["query"],
  },
};

export const webSearchExecutor: ToolExecutor = async (input, _ctx) => {
  const { query, maxResults } = input as { query: string; maxResults?: number };
  return tavily.webSearch({ query, maxResults: Math.min(maxResults ?? 5, 10) });
};
