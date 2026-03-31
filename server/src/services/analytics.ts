/**
 * Analytics Service
 *
 * Aggregates agency performance metrics from existing data:
 * - Lead pipeline velocity (time from entry to each stage)
 * - Response time metrics (actual vs target SLA)
 * - Agent cost vs output (cost per lead, cost per viewing)
 * - Content performance (posts, engagement)
 * - Conversion rate by source
 * - Agent efficiency (runs, tasks completed, cost)
 */

import { and, eq, gte, lte, sql, desc, count } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  issues,
  heartbeatRuns,
  costEvents,
  approvals,
  activityLog,
} from "@paperclipai/db";

export interface DateRange {
  start: Date;
  end: Date;
}

function defaultRange(): DateRange {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return { start, end };
}

export function analyticsService(db: Db) {
  return {
    /** Get comprehensive analytics summary for a company */
    summary: async (companyId: string, range?: DateRange) => {
      const { start, end } = range ?? defaultRange();

      // Agent performance
      const agentList = await db
        .select()
        .from(agents)
        .where(eq(agents.companyId, companyId));

      // Runs by agent in date range
      const runsByAgent = await db
        .select({
          agentId: heartbeatRuns.agentId,
          status: heartbeatRuns.status,
          count: sql<number>`count(*)::int`,
        })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            gte(heartbeatRuns.createdAt, start),
            lte(heartbeatRuns.createdAt, end),
          ),
        )
        .groupBy(heartbeatRuns.agentId, heartbeatRuns.status);

      // Cost by agent in date range
      const costByAgent = await db
        .select({
          agentId: costEvents.agentId,
          totalCostCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          totalInputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          totalOutputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, start),
            lte(costEvents.occurredAt, end),
          ),
        )
        .groupBy(costEvents.agentId);

      // Tasks by status
      const tasksByStatus = await db
        .select({
          status: issues.status,
          count: sql<number>`count(*)::int`,
        })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      // Tasks completed in date range
      const completedTasks = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.status, "done"),
            gte(issues.completedAt, start),
          ),
        );

      // Approvals in date range
      const approvalStats = await db
        .select({
          status: approvals.status,
          count: sql<number>`count(*)::int`,
        })
        .from(approvals)
        .where(
          and(
            eq(approvals.companyId, companyId),
            gte(approvals.createdAt, start),
          ),
        )
        .groupBy(approvals.status);

      // Daily cost trend (last 14 days)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const dailyCosts = await db
        .select({
          date: sql<string>`to_char(${costEvents.occurredAt}, 'YYYY-MM-DD')`,
          totalCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, fourteenDaysAgo),
          ),
        )
        .groupBy(sql`to_char(${costEvents.occurredAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${costEvents.occurredAt}, 'YYYY-MM-DD')`);

      // Daily runs trend (last 14 days)
      const dailyRuns = await db
        .select({
          date: sql<string>`to_char(${heartbeatRuns.createdAt}, 'YYYY-MM-DD')`,
          total: sql<number>`count(*)::int`,
          succeeded: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'succeeded')::int`,
          failed: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'failed')::int`,
        })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            gte(heartbeatRuns.createdAt, fourteenDaysAgo),
          ),
        )
        .groupBy(sql`to_char(${heartbeatRuns.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${heartbeatRuns.createdAt}, 'YYYY-MM-DD')`);

      // Build per-agent efficiency metrics
      const agentMetrics = agentList.map((agent) => {
        const runs = runsByAgent.filter((r) => r.agentId === agent.id);
        const totalRuns = runs.reduce((s, r) => s + Number(r.count), 0);
        const succeededRuns = runs
          .filter((r) => r.status === "succeeded")
          .reduce((s, r) => s + Number(r.count), 0);
        const failedRuns = runs
          .filter((r) => r.status === "failed")
          .reduce((s, r) => s + Number(r.count), 0);

        const cost = costByAgent.find((c) => c.agentId === agent.id);
        const costCents = cost ? Number(cost.totalCostCents) : 0;

        return {
          agentId: agent.id,
          name: agent.name,
          role: agent.role,
          icon: agent.icon,
          status: agent.status,
          totalRuns,
          succeededRuns,
          failedRuns,
          successRate: totalRuns > 0 ? Math.round((succeededRuns / totalRuns) * 100) : 0,
          costCents,
          inputTokens: cost ? Number(cost.totalInputTokens) : 0,
          outputTokens: cost ? Number(cost.totalOutputTokens) : 0,
        };
      });

      // Totals
      const totalCostCents = agentMetrics.reduce((s, a) => s + a.costCents, 0);
      const totalRuns = agentMetrics.reduce((s, a) => s + a.totalRuns, 0);
      const totalSucceeded = agentMetrics.reduce((s, a) => s + a.succeededRuns, 0);
      const totalFailed = agentMetrics.reduce((s, a) => s + a.failedRuns, 0);

      const approvalMap: Record<string, number> = {};
      for (const a of approvalStats) {
        approvalMap[a.status] = Number(a.count);
      }

      const taskMap: Record<string, number> = {};
      for (const t of tasksByStatus) {
        taskMap[t.status] = Number(t.count);
      }

      return {
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        agents: agentMetrics,
        totals: {
          agents: agentList.length,
          runs: totalRuns,
          succeededRuns: totalSucceeded,
          failedRuns: totalFailed,
          successRate: totalRuns > 0 ? Math.round((totalSucceeded / totalRuns) * 100) : 0,
          costCents: totalCostCents,
          tasksCompleted: Number(completedTasks[0]?.count ?? 0),
        },
        tasks: taskMap,
        approvals: approvalMap,
        trends: {
          dailyCosts,
          dailyRuns,
        },
      };
    },
  };
}
