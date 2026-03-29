import { eq, and, ilike, gte, lte, or, sql } from "drizzle-orm";
import { aygentProjects } from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";

// ── Helpers ──

function formatPrice(value: number): string {
  if (value >= 1_000_000) return `AED ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `AED ${(value / 1_000).toFixed(0)}K`;
  return `AED ${value.toLocaleString()}`;
}

// ── search_projects ──

export const searchProjectsDefinition: ToolDefinition = {
  name: "search_projects",
  description:
    "Search the Dubai off-plan project database by name, location, developer, price range, bedrooms, unit type, or keyword. The search is fuzzy — it searches across project name, developer, district, sector, region, and description simultaneously. Use this when the agent asks about projects, properties, or developments. If the user asks about a project by name, always search for it.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Free-text search query. Searches across project name, developer, district, sector, region, and description. Use this for project names, area names, or any keyword.",
      },
      developer: {
        type: "string",
        description:
          "Filter by developer name (e.g. Emaar, DAMAC, Sobha). Can be partial.",
      },
      district: {
        type: "string",
        description:
          "Filter by district/area (e.g. Dubai Marina, JVC, Downtown, Business Bay)",
      },
      minPrice: {
        type: "number",
        description: "Minimum unit price in AED",
      },
      maxPrice: {
        type: "number",
        description: "Maximum unit price in AED",
      },
      saleStatus: {
        type: "string",
        description:
          "Filter by sale status: 'On Sale', 'Out of Stock', 'Start of Sales', 'Announced'",
      },
      constructionStatus: {
        type: "string",
        description:
          "Filter by construction status: 'Completed', 'Under Construction', 'Presale'",
      },
      postHandover: {
        type: "boolean",
        description: "Only show projects with post-handover payment plans",
      },
      goldenVisa: {
        type: "boolean",
        description:
          "Only show projects eligible for UAE Golden Visa (max price >= AED 2,000,000)",
      },
      limit: {
        type: "number",
        description: "Number of results to return (default 5, max 20)",
      },
    },
  },
};

export const searchProjectsExecutor: ToolExecutor = async (input, ctx) => {
  const {
    query,
    developer,
    district,
    minPrice,
    maxPrice,
    saleStatus,
    constructionStatus,
    postHandover,
    goldenVisa,
    limit,
  } = input as {
    query?: string;
    developer?: string;
    district?: string;
    minPrice?: number;
    maxPrice?: number;
    saleStatus?: string;
    constructionStatus?: string;
    postHandover?: boolean;
    goldenVisa?: boolean;
    limit?: number;
  };

  const take = Math.min(limit ?? 5, 20);
  const t = aygentProjects;

  // Build filter conditions
  const conditions = [eq(t.companyId, ctx.companyId)];

  if (developer) {
    conditions.push(ilike(t.developer, `%${developer}%`));
  }

  if (district) {
    conditions.push(
      or(
        ilike(t.district, `%${district}%`),
        ilike(t.sector, `%${district}%`),
        ilike(t.location, `%${district}%`),
      )!,
    );
  }

  if (minPrice !== undefined && minPrice > 0) {
    conditions.push(gte(t.maxPrice, minPrice));
  }

  if (maxPrice !== undefined && maxPrice > 0) {
    conditions.push(lte(t.minPrice, maxPrice));
  }

  if (saleStatus) {
    conditions.push(ilike(t.saleStatus, `%${saleStatus}%`));
  }

  if (constructionStatus) {
    conditions.push(ilike(t.constructionStatus, `%${constructionStatus}%`));
  }

  if (postHandover) {
    conditions.push(eq(t.postHandover, true));
  }

  if (goldenVisa) {
    conditions.push(gte(t.maxPrice, 2_000_000));
  }

  // Search strategy: name match first, then fuzzy fallback
  let results;
  let totalCount = 0;

  if (query) {
    const fullPhrase = query.trim();

    // Step 1: Try exact name match
    const nameConditions = [...conditions, ilike(t.name, `%${fullPhrase}%`)];

    results = await ctx.db
      .select()
      .from(t)
      .where(and(...nameConditions))
      .orderBy(
        sql`CASE WHEN ${t.saleStatus} = 'On Sale' THEN 0 ELSE 1 END`,
        sql`${t.maxPrice} DESC`,
      )
      .limit(take);

    if (results.length > 0) {
      const countResult = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(t)
        .where(and(...nameConditions));
      totalCount = Number(countResult[0]?.count ?? 0);
    } else {
      // Step 2: Fuzzy word search
      const words = fullPhrase.split(/\s+/).filter((w) => w.length > 1);
      const fuzzyConditions = [...conditions];

      for (const word of words) {
        fuzzyConditions.push(
          or(
            ilike(t.name, `%${word}%`),
            ilike(t.developer, `%${word}%`),
            ilike(t.district, `%${word}%`),
            ilike(t.sector, `%${word}%`),
            ilike(t.region, `%${word}%`),
            ilike(t.location, `%${word}%`),
          )!,
        );
      }

      results = await ctx.db
        .select()
        .from(t)
        .where(and(...fuzzyConditions))
        .orderBy(
          sql`CASE WHEN ${t.saleStatus} = 'On Sale' THEN 0 ELSE 1 END`,
          sql`${t.maxPrice} DESC`,
        )
        .limit(take);

      const countResult = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(t)
        .where(and(...fuzzyConditions));
      totalCount = Number(countResult[0]?.count ?? 0);
    }
  } else {
    // No text query — just filters
    results = await ctx.db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(
        sql`CASE WHEN ${t.saleStatus} = 'On Sale' THEN 0 ELSE 1 END`,
        sql`${t.maxPrice} DESC`,
      )
      .limit(take);

    const countResult = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(t)
      .where(and(...conditions));
    totalCount = Number(countResult[0]?.count ?? 0);
  }

  if (results.length === 0) {
    return {
      results: [],
      totalAvailable: totalCount,
      message:
        "No projects found matching your criteria. Try broadening your search — use fewer keywords, a different area name, or remove price filters.",
    };
  }

  return {
    results: results.map((p) => {
      type BreakdownEntry = {
        type: string;
        bedrooms: number;
        count: number;
        minPrice: number;
        maxPrice: number;
        minSize: number;
        maxSize: number;
        avgPricePerSqft: number;
      };
      const breakdown = (
        Array.isArray(p.unitBreakdown) ? p.unitBreakdown : []
      ) as BreakdownEntry[];
      const bedroomPricing =
        breakdown.length > 0
          ? breakdown.map((b) => ({
              type: b.bedrooms === 0 ? "Studio" : `${b.bedrooms}BR`,
              from: formatPrice(b.minPrice),
              to: formatPrice(b.maxPrice),
              count: b.count,
              avgPricePerSqft: b.avgPricePerSqft,
            }))
          : null;

      const pMinPrice = p.minPrice ?? 0;
      const pMaxPrice = p.maxPrice ?? 0;
      const pMinSize = p.minSize ?? 0;
      const pMaxSize = p.maxSize ?? 0;

      return {
        id: p.id,
        reellyId: p.reellyId,
        name: p.name,
        developer: p.developer,
        district: p.district,
        region: p.region,
        location: p.location,
        priceRange:
          pMinPrice > 0
            ? `${formatPrice(pMinPrice)} — ${formatPrice(pMaxPrice)}`
            : "Price on request",
        minPrice: pMinPrice,
        maxPrice: pMaxPrice,
        sizeRange:
          pMinSize > 0
            ? `${pMinSize.toLocaleString()} — ${pMaxSize.toLocaleString()} sqft`
            : null,
        bedroomPricing,
        completionDate: p.completionDate,
        constructionStatus: p.constructionStatus,
        saleStatus: p.saleStatus,
        postHandover: p.postHandover,
        readinessProgress: p.readinessProgress
          ? `${p.readinessProgress.toFixed(0)}%`
          : null,
        pricePerSqft:
          pMinPrice > 0 && pMinSize > 0
            ? `${Math.round(pMinPrice / pMinSize).toLocaleString()} — ${Math.round(pMaxPrice / pMaxSize).toLocaleString()} AED/sqft`
            : null,
        goldenVisaEligible: pMaxPrice >= 2_000_000,
        coverImageUrl: p.coverImageUrl,
      };
    }),
    totalAvailable: totalCount,
    showing: results.length,
  };
};

// ── get_project_details ──

export const getProjectDetailsDefinition: ToolDefinition = {
  name: "get_project_details",
  description:
    "Get detailed information about a specific project including payment plans, amenities, floor plans, nearby landmarks, and construction progress. Use the project's database ID (not the Reelly ID). Use this when the agent wants to dive deeper into a specific project from search results.",
  input_schema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The project database ID (uuid from search results)",
      },
    },
    required: ["projectId"],
  },
};

export const getProjectDetailsExecutor: ToolExecutor = async (input, ctx) => {
  const { projectId } = input as { projectId: string };

  const results = await ctx.db
    .select()
    .from(aygentProjects)
    .where(
      and(
        eq(aygentProjects.id, projectId),
        eq(aygentProjects.companyId, ctx.companyId),
      ),
    )
    .limit(1);

  const project = results[0];

  if (!project) {
    return {
      error:
        "Project not found. Make sure you're using the correct ID from search results.",
    };
  }

  const pMinPrice = project.minPrice ?? 0;
  const pMaxPrice = project.maxPrice ?? 0;
  const pMinSize = project.minSize ?? 0;
  const pMaxSize = project.maxSize ?? 0;

  return {
    id: project.id,
    reellyId: project.reellyId,
    name: project.name,
    developer: project.developer,
    location: project.location,
    district: project.district,
    region: project.region,
    sector: project.sector,
    description: project.description?.slice(0, 1500) || null,
    priceRange:
      pMinPrice > 0
        ? `${formatPrice(pMinPrice)} — ${formatPrice(pMaxPrice)}`
        : "Price on request",
    minPrice: pMinPrice,
    maxPrice: pMaxPrice,
    sizeRange:
      pMinSize > 0
        ? `${pMinSize.toLocaleString()} — ${pMaxSize.toLocaleString()} sqft`
        : null,
    pricePerSqft:
      pMinPrice > 0 && pMinSize > 0
        ? `${Math.round(pMinPrice / pMinSize).toLocaleString()} — ${Math.round(pMaxPrice / pMaxSize).toLocaleString()} AED/sqft`
        : null,
    completionDate: project.completionDate,
    constructionStatus: project.constructionStatus,
    saleStatus: project.saleStatus,
    readinessProgress: project.readinessProgress
      ? `${project.readinessProgress.toFixed(0)}%`
      : null,
    furnishing: project.furnishing,
    serviceCharge: project.serviceCharge,
    escrowNumber: project.escrowNumber,
    postHandover: project.postHandover,
    buildingCount: project.buildingCount,
    amenities: project.amenities,
    paymentPlans: project.paymentPlans,
    nearbyLandmarks: project.nearbyLandmarks,
    buildings: project.buildings,
    parkings: project.parkings,
    brochureUrl: project.brochureUrl,
    floorPlanUrl: project.floorPlanUrl,
    coverImageUrl: project.coverImageUrl,
    unitBreakdown: Array.isArray(project.unitBreakdown)
      ? project.unitBreakdown
      : null,
  };
};
