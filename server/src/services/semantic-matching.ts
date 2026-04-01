import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentLeads, aygentProperties } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

const EMBEDDING_MODEL = "text-embedding-004";

let _gemini: GoogleGenerativeAI | null = null;

function getGemini(): GoogleGenerativeAI | null {
  if (_gemini) return _gemini;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  _gemini = new GoogleGenerativeAI(key);
  return _gemini;
}

/**
 * Generate an embedding vector for a text string using Gemini.
 */
async function embed(text: string): Promise<number[] | null> {
  const gemini = getGemini();
  if (!gemini) return null;

  try {
    const model = gemini.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    logger.warn({ err }, "semantic-matching: embedding failed");
    return null;
  }
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Build a text profile for a lead suitable for embedding.
 */
function leadProfile(lead: {
  name: string | null;
  budget: Record<string, unknown> | null;
  propertyType: string | null;
  notes: string | null;
}): string {
  const parts: string[] = [];
  if (lead.propertyType) parts.push(`Type: ${lead.propertyType}`);
  if (lead.budget) {
    const min = lead.budget.min ?? lead.budget.budgetMin;
    const max = lead.budget.max ?? lead.budget.budgetMax;
    const area = lead.budget.area ?? lead.budget.areaPreference;
    if (area) parts.push(`Area: ${area}`);
    if (min || max) parts.push(`Budget: AED ${min ?? "?"} - ${max ?? "?"}`);
  }
  if (lead.notes) parts.push(`Notes: ${lead.notes}`);
  return parts.join(". ") || "Dubai property buyer";
}

/**
 * Build a text profile for a property suitable for embedding.
 */
function propertyProfile(prop: {
  buildingName: string | null;
  area: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  sqft: number | null;
  saleValue: number | null;
  rentalPrice: number | null;
  listingType: string | null;
  notes: string | null;
}): string {
  const parts: string[] = [];
  if (prop.buildingName) parts.push(prop.buildingName);
  if (prop.area) parts.push(`in ${prop.area}`);
  if (prop.propertyType) parts.push(prop.propertyType);
  if (prop.bedrooms) parts.push(`${prop.bedrooms} bedrooms`);
  if (prop.sqft) parts.push(`${prop.sqft} sqft`);
  if (prop.saleValue) parts.push(`AED ${prop.saleValue} sale`);
  if (prop.rentalPrice) parts.push(`AED ${prop.rentalPrice}/year rental`);
  if (prop.listingType) parts.push(`(${prop.listingType})`);
  if (prop.notes) parts.push(prop.notes);
  return parts.join(", ") || "Dubai property";
}

export function semanticMatchingService(db: Db) {
  /**
   * Find the top N properties that best match a lead's profile.
   */
  async function matchLeadToProperties(
    companyId: string,
    leadId: string,
    topN = 5,
  ): Promise<Array<{ propertyId: string; similarity: number; propertyName: string }>> {
    const [lead] = await db
      .select()
      .from(aygentLeads)
      .where(eq(aygentLeads.id, leadId))
      .limit(1);

    if (!lead) return [];

    const properties = await db
      .select()
      .from(aygentProperties)
      .where(eq(aygentProperties.companyId, companyId));

    if (properties.length === 0) return [];

    const leadText = leadProfile(lead);
    const leadEmbedding = await embed(leadText);
    if (!leadEmbedding) return [];

    // Embed all properties (batch would be better but embedding API does one at a time)
    const scored: Array<{ propertyId: string; similarity: number; propertyName: string }> = [];

    for (const prop of properties) {
      const propText = propertyProfile(prop);
      const propEmbedding = await embed(propText);
      if (!propEmbedding) continue;

      const sim = cosineSimilarity(leadEmbedding, propEmbedding);
      scored.push({
        propertyId: prop.id,
        similarity: Math.round(sim * 100) / 100,
        propertyName: prop.buildingName ?? prop.area ?? "Unknown",
      });
    }

    return scored.sort((a, b) => b.similarity - a.similarity).slice(0, topN);
  }

  /**
   * Find the top N leads that best match a property.
   */
  async function matchPropertyToLeads(
    companyId: string,
    propertyId: string,
    topN = 5,
  ): Promise<Array<{ leadId: string; similarity: number; leadName: string }>> {
    const [property] = await db
      .select()
      .from(aygentProperties)
      .where(eq(aygentProperties.id, propertyId))
      .limit(1);

    if (!property) return [];

    const leads = await db
      .select()
      .from(aygentLeads)
      .where(eq(aygentLeads.companyId, companyId));

    if (leads.length === 0) return [];

    const propText = propertyProfile(property);
    const propEmbedding = await embed(propText);
    if (!propEmbedding) return [];

    const scored: Array<{ leadId: string; similarity: number; leadName: string }> = [];

    for (const lead of leads) {
      const leadText = leadProfile(lead);
      const leadEmbedding = await embed(leadText);
      if (!leadEmbedding) continue;

      const sim = cosineSimilarity(propEmbedding, leadEmbedding);
      scored.push({
        leadId: lead.id,
        similarity: Math.round(sim * 100) / 100,
        leadName: lead.name ?? "Unknown",
      });
    }

    return scored.sort((a, b) => b.similarity - a.similarity).slice(0, topN);
  }

  return {
    matchLeadToProperties,
    matchPropertyToLeads,
    embed,
  };
}
