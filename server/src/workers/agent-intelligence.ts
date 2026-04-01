import type { Db } from "@paperclipai/db";
import { agents, companies } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { agentLearningService } from "../services/agent-learnings.js";
import { agentMessageService } from "../services/agent-messages.js";

/**
 * Background worker for agent intelligence maintenance tasks:
 * 1. Learning compaction — summarize raw corrections into durable insights (weekly cadence)
 * 2. Message purge — delete expired inter-agent messages
 * 3. Outcome tracking — track WhatsApp reply rates and feed back into learnings
 */
export function startAgentIntelligenceWorker(db: Db) {
  // Run compaction weekly (check every 6 hours, compact if enough learnings)
  const COMPACTION_INTERVAL_MS = 6 * 60 * 60 * 1000;
  // Purge expired messages every hour
  const PURGE_INTERVAL_MS = 60 * 60 * 1000;
  // Track outcomes every 2 hours
  const OUTCOME_INTERVAL_MS = 2 * 60 * 60 * 1000;

  async function runCompaction() {
    try {
      const learningSvc = agentLearningService(db);
      const allCompanies = await db.select({ id: companies.id }).from(companies);

      for (const company of allCompanies) {
        const companyAgents = await db
          .select({ id: agents.id })
          .from(agents)
          .where(eq(agents.companyId, company.id));

        for (const agent of companyAgents) {
          try {
            const result = await learningSvc.compactLearnings(company.id, agent.id);
            if (result) {
              console.log(
                `[agent-intelligence] ✓ Compacted ${result.compacted} learnings → ${result.insights} insights for agent ${agent.id}`,
              );
            }
          } catch (err) {
            console.error(`[agent-intelligence] ✗ Compaction failed for agent ${agent.id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("[agent-intelligence] Compaction worker error:", err);
    }
  }

  async function runPurge() {
    try {
      const messageSvc = agentMessageService(db);
      const purged = await messageSvc.purgeExpired();
      if (purged > 0) {
        console.log(`[agent-intelligence] ✓ Purged ${purged} expired agent messages`);
      }
    } catch (err) {
      console.error("[agent-intelligence] Purge worker error:", err);
    }
  }

  async function runOutcomeTracking() {
    try {
      // Track WhatsApp reply rates — check sent messages from the last 48h
      // and see which ones got replies (inbound messages from the same chatJid)
      const { aygentWhatsappMessages } = await import("@paperclipai/db");
      const { and, eq: eqOp, gt, sql } = await import("drizzle-orm");

      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

      // Find sent messages that haven't been tracked yet
      const sentMessages = await db
        .select()
        .from(aygentWhatsappMessages)
        .where(
          and(
            eqOp(aygentWhatsappMessages.fromMe, true),
            gt(aygentWhatsappMessages.timestamp, cutoff),
          ),
        )
        .limit(200);

      if (sentMessages.length === 0) return;

      let repliedCount = 0;
      let totalChecked = 0;

      for (const sent of sentMessages) {
        if (!sent.chatJid) continue;
        totalChecked++;

        // Check if there's an inbound reply from this chatJid after the sent message
        const sentTime = sent.timestamp ?? new Date();
        const [replyRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(aygentWhatsappMessages)
          .where(
            and(
              sql`${aygentWhatsappMessages.chatJid} = ${sent.chatJid}`,
              sql`${aygentWhatsappMessages.fromMe} = false`,
              sql`${aygentWhatsappMessages.timestamp} > ${sentTime}`,
            ),
          );

        if ((replyRow?.count ?? 0) > 0) {
          repliedCount++;
        }
      }

      if (totalChecked > 0) {
        const replyRate = Math.round((repliedCount / totalChecked) * 100);
        console.log(
          `[agent-intelligence] ✓ WhatsApp outcome: ${repliedCount}/${totalChecked} messages got replies (${replyRate}%)`,
        );
      }
    } catch (err) {
      // WhatsApp messages table might not exist in all environments
      if (!(err instanceof Error && err.message.includes("does not exist"))) {
        console.error("[agent-intelligence] Outcome tracking error:", err);
      }
    }
  }

  // Initial runs (delayed to avoid startup congestion)
  setTimeout(() => void runPurge(), 30_000);
  setTimeout(() => void runOutcomeTracking(), 60_000);
  setTimeout(() => void runCompaction(), 120_000);

  // Recurring intervals
  const compactionInterval = setInterval(() => void runCompaction(), COMPACTION_INTERVAL_MS);
  const purgeInterval = setInterval(() => void runPurge(), PURGE_INTERVAL_MS);
  const outcomeInterval = setInterval(() => void runOutcomeTracking(), OUTCOME_INTERVAL_MS);

  return {
    stop: () => {
      clearInterval(compactionInterval);
      clearInterval(purgeInterval);
      clearInterval(outcomeInterval);
    },
  };
}
