import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, heartbeatRuns, aygentAgentMessages, costEvents } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

export interface TeamRecommendation {
  type: "hire" | "remove" | "reassign" | "adjust";
  agentId?: string;
  agentName?: string;
  reason: string;
  evidence: string;
  impact: string;
}

/**
 * Self-optimizing agent teams.
 *
 * CEO agent periodically reviews team composition and communication patterns,
 * then suggests org chart changes to the owner.
 *
 * - Detects overloaded agents (high run count, many inter-agent messages)
 * - Detects idle agents (zero runs, zero messages)
 * - Suggests new hires based on demand patterns
 * - Suggests role changes based on actual usage vs assigned role
 */
export function selfOptimizingTeamsService(db: Db) {
  /**
   * Analyze team performance and generate recommendations.
   */
  async function analyzeTeam(companyId: string): Promise<TeamRecommendation[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recommendations: TeamRecommendation[] = [];

    // Get all active agents
    const companyAgents = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.companyId, companyId),
          sql`${agents.status} != 'terminated'`,
        ),
      );

    for (const agent of companyAgents) {
      // Run count last 30 days
      const [runStats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          failed: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'failed')::int`,
        })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.agentId, agent.id),
            gte(heartbeatRuns.startedAt, thirtyDaysAgo),
          ),
        );

      // Message count (sent and received)
      const [msgStats] = await db
        .select({ sent: sql<number>`count(*)::int` })
        .from(aygentAgentMessages)
        .where(
          and(
            eq(aygentAgentMessages.fromAgentId, agent.id),
            gte(aygentAgentMessages.createdAt, thirtyDaysAgo),
          ),
        );

      // Cost
      const [costStats] = await db
        .select({ totalCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int` })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.agentId, agent.id),
            gte(costEvents.occurredAt, thirtyDaysAgo),
          ),
        );

      const totalRuns = runStats?.total ?? 0;
      const failedRuns = runStats?.failed ?? 0;
      const messagesSent = msgStats?.sent ?? 0;
      const costCents = costStats?.totalCents ?? 0;

      // Detect idle agents (0 runs in 30 days, not paused)
      if (totalRuns === 0 && agent.status !== "paused" && agent.role !== "ceo") {
        recommendations.push({
          type: "remove",
          agentId: agent.id,
          agentName: agent.name,
          reason: `${agent.name} has had zero runs in the last 30 days`,
          evidence: `0 runs, 0 messages sent, $${(costCents / 100).toFixed(2)} spent`,
          impact: "Removing this agent saves its base cost and simplifies the team",
        });
      }

      // Detect high-failure agents
      if (totalRuns > 5 && failedRuns / totalRuns > 0.3) {
        recommendations.push({
          type: "adjust",
          agentId: agent.id,
          agentName: agent.name,
          reason: `${agent.name} has a ${Math.round((failedRuns / totalRuns) * 100)}% failure rate`,
          evidence: `${failedRuns}/${totalRuns} runs failed in last 30 days`,
          impact: "Review this agent's instructions and tool access to improve reliability",
        });
      }

      // Detect overloaded agents (very high run count + messaging volume)
      if (totalRuns > 100 && messagesSent > 50) {
        recommendations.push({
          type: "hire",
          agentName: agent.name,
          reason: `${agent.name} is handling high volume — consider splitting the workload`,
          evidence: `${totalRuns} runs and ${messagesSent} messages sent in 30 days`,
          impact: "A second agent for this role could reduce latency and improve quality",
        });
      }
    }

    // Detect missing roles based on inter-agent message patterns
    // If agents are frequently messaging about topics that no dedicated agent handles,
    // suggest hiring a specialist
    const messageCounts = await db
      .select({
        messageType: aygentAgentMessages.messageType,
        count: sql<number>`count(*)::int`,
      })
      .from(aygentAgentMessages)
      .where(
        and(
          eq(aygentAgentMessages.companyId, companyId),
          gte(aygentAgentMessages.createdAt, thirtyDaysAgo),
        ),
      )
      .groupBy(aygentAgentMessages.messageType)
      .orderBy(desc(sql`count(*)`));

    // If viewing-related messages are high but no viewing agent exists
    const hasViewingAgent = companyAgents.some(
      (a) => a.role?.toLowerCase().includes("viewing") || a.role?.toLowerCase().includes("operations"),
    );
    const viewingMessages = messageCounts.find(
      (m) => m.messageType.includes("viewing") || m.messageType.includes("schedule"),
    );
    if (!hasViewingAgent && viewingMessages && viewingMessages.count >= 10) {
      recommendations.push({
        type: "hire",
        reason: "Your agents are exchanging many viewing-related messages but you don't have a dedicated Viewing Agent",
        evidence: `${viewingMessages.count} viewing messages in the last 30 days`,
        impact: "A Viewing Agent would handle scheduling, reminders, and follow-ups automatically",
      });
    }

    return recommendations;
  }

  /**
   * Format recommendations for CEO morning brief.
   */
  async function formatForBrief(companyId: string): Promise<string> {
    const recs = await analyzeTeam(companyId);
    if (recs.length === 0) return "";

    const lines = recs.map((r) => {
      const agentRef = r.agentName ? ` (${r.agentName})` : "";
      return `- **${r.type.toUpperCase()}${agentRef}**: ${r.reason}. ${r.impact}`;
    });

    return `\n### Team Optimization Suggestions\n${lines.join("\n")}\n`;
  }

  return {
    analyzeTeam,
    formatForBrief,
  };
}
