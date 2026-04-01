import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentAgentLearnings, companies } from "@paperclipai/db";
import { routedGenerate } from "./model-router.js";
import { logger } from "../middleware/logger.js";

/**
 * Cross-agency anonymized learning.
 *
 * Agencies that opt in contribute anonymized patterns to a shared pool.
 * New agencies benefit from day 1 with proven patterns from the network.
 *
 * Privacy: no lead data, no message content, no agency identity —
 * only statistical patterns like "JVC leads respond best to price-first messages."
 */

interface AnonymizedPattern {
  pattern: string;
  confidence: number; // 0-100
  sourceCount: number; // how many agencies contributed
  area?: string;
  actionType?: string;
  createdAt: Date;
}

// In-memory store for now — would be a shared table in production
const sharedPatterns: AnonymizedPattern[] = [];

export function crossAgencyLearningService(db: Db) {
  /**
   * Extract anonymized patterns from a company's learnings and contribute
   * them to the shared pool. Called periodically for opted-in companies.
   */
  async function contributePatterns(companyId: string) {
    const learnings = await db
      .select()
      .from(aygentAgentLearnings)
      .where(
        and(
          eq(aygentAgentLearnings.companyId, companyId),
          eq(aygentAgentLearnings.active, true),
          eq(aygentAgentLearnings.type, "compacted"),
        ),
      );

    if (learnings.length === 0) return { contributed: 0 };

    // Use Gemini Flash to anonymize and extract patterns
    const texts = learnings.map((l) => l.corrected ?? "").filter(Boolean);

    try {
      const result = await routedGenerate({
        taskType: "learning_compaction",
        systemPrompt:
          "You extract anonymized real estate market patterns from agency learnings. Remove all names, phone numbers, and agency-specific details. Output only general market insights as a JSON array of strings. Each insight should be a reusable pattern like 'JVC leads respond better to price-first messages' or 'Russian-speaking buyers prefer metrics over emotional appeals'.",
        userMessage: `Learnings from a Dubai real estate agency:\n${texts.join("\n")}\n\nExtract anonymized patterns:`,
        maxTokens: 512,
      });

      let patterns: string[];
      try {
        patterns = JSON.parse(result.text);
        if (!Array.isArray(patterns)) return { contributed: 0 };
      } catch {
        return { contributed: 0 };
      }

      for (const pattern of patterns) {
        // Check if we already have a similar pattern
        const existing = sharedPatterns.find(
          (p) => p.pattern.toLowerCase() === pattern.toLowerCase(),
        );
        if (existing) {
          existing.sourceCount++;
          existing.confidence = Math.min(100, existing.confidence + 5);
        } else {
          sharedPatterns.push({
            pattern,
            confidence: 50,
            sourceCount: 1,
            createdAt: new Date(),
          });
        }
      }

      logger.info(
        { companyId, contributed: patterns.length, totalShared: sharedPatterns.length },
        "cross-agency: patterns contributed",
      );

      return { contributed: patterns.length };
    } catch (err) {
      logger.warn({ err }, "cross-agency: failed to extract patterns");
      return { contributed: 0 };
    }
  }

  /**
   * Get shared patterns relevant to a new agency for bootstrapping.
   * Returns high-confidence patterns from the network.
   */
  async function getBootstrapPatterns(limit = 10): Promise<AnonymizedPattern[]> {
    return sharedPatterns
      .filter((p) => p.confidence >= 60 && p.sourceCount >= 2)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Format shared patterns for injection into agent prompts.
   */
  async function formatForPrompt(limit = 5): Promise<string> {
    const patterns = await getBootstrapPatterns(limit);
    if (patterns.length === 0) return "";

    const lines = patterns.map(
      (p) => `- ${p.pattern} (confidence: ${p.confidence}%, from ${p.sourceCount} agencies)`,
    );

    return `\n### Industry Insights (from the Aygency World network)\n${lines.join("\n")}\n`;
  }

  return {
    contributePatterns,
    getBootstrapPatterns,
    formatForPrompt,
  };
}
