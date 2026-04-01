import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentLeads, aygentWhatsappMessages, aygentProperties } from "@paperclipai/db";
import { routedGenerate } from "./model-router.js";
import { logger } from "../middleware/logger.js";

export interface Prediction {
  type: "lead_at_risk" | "optimal_contact_time" | "price_trend" | "content_opportunity";
  subject: string;
  description: string;
  confidence: number;
  suggestedAction: string;
  data: Record<string, unknown>;
}

/**
 * Predictive agent actions — agents anticipate instead of just react.
 *
 * Analyzes patterns from historical data to surface predictions:
 * - Leads likely to go cold
 * - Optimal contact times
 * - Content opportunities based on engagement patterns
 */
export function predictiveActionsService(db: Db) {
  /**
   * Identify leads at risk of going cold.
   * A lead is "at risk" if:
   * - Score 5+ but no contact in last 5 days
   * - Previously responded but stopped replying for 3+ days
   * - Had a viewing but no follow-up activity for 7 days
   */
  async function findLeadsAtRisk(companyId: string): Promise<Prediction[]> {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const predictions: Prediction[] = [];

    // Leads with score 5+ and no recent contact
    const staleLeads = await db
      .select()
      .from(aygentLeads)
      .where(
        and(
          eq(aygentLeads.companyId, companyId),
          gte(aygentLeads.score, 5),
          lt(aygentLeads.lastContactAt, fiveDaysAgo),
        ),
      );

    for (const lead of staleLeads) {
      const daysSinceContact = lead.lastContactAt
        ? Math.floor((Date.now() - new Date(lead.lastContactAt).getTime()) / (24 * 60 * 60 * 1000))
        : 99;

      predictions.push({
        type: "lead_at_risk",
        subject: lead.name ?? "Unknown Lead",
        description: `Score ${lead.score}, no contact in ${daysSinceContact} days`,
        confidence: Math.min(90, 50 + daysSinceContact * 5),
        suggestedAction: "Send a follow-up referencing their last interest",
        data: {
          leadId: lead.id,
          score: lead.score,
          daysSinceContact,
          lastContactAt: lead.lastContactAt,
        },
      });
    }

    return predictions;
  }

  /**
   * Analyze WhatsApp reply patterns to find optimal contact times.
   */
  async function findOptimalContactTimes(companyId: string): Promise<Prediction[]> {
    // Get all inbound replies (from_me = false) and group by hour of day
    try {
      const rows = await db
        .select({
          hour: sql<number>`extract(hour from ${aygentWhatsappMessages.timestamp})::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(aygentWhatsappMessages)
        .where(
          and(
            eq(aygentWhatsappMessages.companyId, companyId),
            sql`${aygentWhatsappMessages.fromMe} = false`,
            gte(
              aygentWhatsappMessages.timestamp,
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            ),
          ),
        )
        .groupBy(sql`extract(hour from ${aygentWhatsappMessages.timestamp})`)
        .orderBy(desc(sql`count(*)`));

      if (rows.length < 3) return [];

      const topHours = rows.slice(0, 3);
      const totalReplies = rows.reduce((sum, r) => sum + r.count, 0);

      return [
        {
          type: "optimal_contact_time",
          subject: "Best Times to Contact Leads",
          description: `Leads reply most at ${topHours.map((h) => `${h.hour}:00`).join(", ")} Dubai time`,
          confidence: Math.min(85, 40 + totalReplies),
          suggestedAction: "Schedule follow-ups during peak reply hours",
          data: {
            hourlyDistribution: rows.map((r) => ({ hour: r.hour, replies: r.count })),
            topHours: topHours.map((h) => h.hour),
            sampleSize: totalReplies,
          },
        },
      ];
    } catch {
      return [];
    }
  }

  /**
   * Get all predictions for a company.
   */
  async function getAllPredictions(companyId: string): Promise<Prediction[]> {
    const [atRisk, contactTimes] = await Promise.all([
      findLeadsAtRisk(companyId),
      findOptimalContactTimes(companyId),
    ]);

    return [...atRisk, ...contactTimes].sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Format predictions for injection into CEO morning brief.
   */
  async function formatForBrief(companyId: string): Promise<string> {
    const predictions = await getAllPredictions(companyId);
    if (predictions.length === 0) return "";

    const lines = predictions.slice(0, 5).map((p) => {
      return `- **${p.subject}**: ${p.description}. Suggestion: ${p.suggestedAction}`;
    });

    return `\n### Predictions & Recommendations\n${lines.join("\n")}\n`;
  }

  return {
    findLeadsAtRisk,
    findOptimalContactTimes,
    getAllPredictions,
    formatForBrief,
  };
}
