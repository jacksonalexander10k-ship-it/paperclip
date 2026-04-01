import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, heartbeatRuns } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

export type HealthStatus = "green" | "yellow" | "red";

export interface AgentHealth {
  agentId: string;
  agentName: string;
  status: HealthStatus;
  successRate7d: number;
  totalRuns7d: number;
  failedRuns7d: number;
  lastRunAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
}

export interface DeadLetterEntry {
  runId: string;
  agentId: string;
  agentName: string;
  error: string | null;
  errorCode: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  retryCount: number;
}

const SUCCESS_RATE_GREEN = 90;
const SUCCESS_RATE_YELLOW = 70;

export function agentHealthService(db: Db) {
  /**
   * Get health status for all agents in a company.
   */
  async function getCompanyHealth(companyId: string): Promise<AgentHealth[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const companyAgents = await db
      .select({ id: agents.id, name: agents.name })
      .from(agents)
      .where(eq(agents.companyId, companyId));

    const results: AgentHealth[] = [];

    for (const agent of companyAgents) {
      const [stats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          succeeded: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'succeeded')::int`,
          failed: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'failed')::int`,
        })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.agentId, agent.id),
            gte(heartbeatRuns.startedAt, sevenDaysAgo),
          ),
        );

      const total = stats?.total ?? 0;
      const failed = stats?.failed ?? 0;
      const successRate = total > 0 ? Math.round(((total - failed) / total) * 100) : 100;

      // Get last error
      const [lastFailed] = await db
        .select({
          error: heartbeatRuns.error,
          finishedAt: heartbeatRuns.finishedAt,
        })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.agentId, agent.id),
            eq(heartbeatRuns.status, "failed"),
          ),
        )
        .orderBy(desc(heartbeatRuns.finishedAt))
        .limit(1);

      // Count consecutive failures from most recent run
      const recentRuns = await db
        .select({ status: heartbeatRuns.status })
        .from(heartbeatRuns)
        .where(eq(heartbeatRuns.agentId, agent.id))
        .orderBy(desc(heartbeatRuns.startedAt))
        .limit(10);

      let consecutiveFailures = 0;
      for (const r of recentRuns) {
        if (r.status === "failed") consecutiveFailures++;
        else break;
      }

      // Get last run timestamp
      const [lastRun] = await db
        .select({ startedAt: heartbeatRuns.startedAt })
        .from(heartbeatRuns)
        .where(eq(heartbeatRuns.agentId, agent.id))
        .orderBy(desc(heartbeatRuns.startedAt))
        .limit(1);

      let status: HealthStatus = "green";
      if (successRate < SUCCESS_RATE_YELLOW || consecutiveFailures >= 3) {
        status = "red";
      } else if (successRate < SUCCESS_RATE_GREEN || consecutiveFailures >= 2) {
        status = "yellow";
      }

      results.push({
        agentId: agent.id,
        agentName: agent.name,
        status,
        successRate7d: successRate,
        totalRuns7d: total,
        failedRuns7d: failed,
        lastRunAt: lastRun?.startedAt ?? null,
        lastErrorAt: lastFailed?.finishedAt ?? null,
        lastError: lastFailed?.error ?? null,
        consecutiveFailures,
      });
    }

    return results;
  }

  /**
   * Get the dead letter queue — failed runs that exhausted retries.
   */
  async function getDeadLetterQueue(companyId: string, limit = 20): Promise<DeadLetterEntry[]> {
    const rows = await db
      .select({
        runId: heartbeatRuns.id,
        agentId: heartbeatRuns.agentId,
        error: heartbeatRuns.error,
        errorCode: heartbeatRuns.errorCode,
        startedAt: heartbeatRuns.startedAt,
        finishedAt: heartbeatRuns.finishedAt,
        retryCount: heartbeatRuns.processLossRetryCount,
      })
      .from(heartbeatRuns)
      .where(
        and(
          eq(heartbeatRuns.companyId, companyId),
          eq(heartbeatRuns.status, "failed"),
        ),
      )
      .orderBy(desc(heartbeatRuns.finishedAt))
      .limit(limit);

    // Resolve agent names
    const agentIds = [...new Set(rows.map((r) => r.agentId))];
    const agentMap = new Map<string, string>();
    if (agentIds.length > 0) {
      const agentRows = await db
        .select({ id: agents.id, name: agents.name })
        .from(agents)
        .where(sql`${agents.id} = ANY(${agentIds})`);
      for (const a of agentRows) {
        agentMap.set(a.id, a.name);
      }
    }

    return rows.map((r) => ({
      runId: r.runId,
      agentId: r.agentId,
      agentName: agentMap.get(r.agentId) ?? "Unknown",
      error: r.error,
      errorCode: r.errorCode,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      retryCount: r.retryCount ?? 0,
    }));
  }

  return {
    getCompanyHealth,
    getDeadLetterQueue,
  };
}
