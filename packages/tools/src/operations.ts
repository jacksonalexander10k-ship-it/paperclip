import { eq, and, gte, lte, count, sum, sql } from "drizzle-orm";
import {
  agents,
  aygentDeals,
  aygentCommissions,
  aygentLeads,
  costEvents,
  heartbeatRuns,
} from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";

// ═══════════════════════════════════════════════════
// get_agent_performance
// ═══════════════════════════════════════════════════

export const getAgentPerformanceDefinition: ToolDefinition = {
  name: "get_agent_performance",
  description:
    "Returns a performance scorecard for one or all agents over a date range. Aggregates deals closed, deal value, commission generated and collected, leads handled, compute cost, and heartbeat runs. Use for morning briefs, weekly reports, ROI analysis, and budget reviews.",
  input_schema: {
    type: "object",
    properties: {
      agentId: {
        type: "string",
        description: "Agent ID to scope the report to. Omit to return all agents in the company.",
      },
      startDate: {
        type: "string",
        description: "Start of reporting period as an ISO 8601 date string (e.g. '2026-04-01'). Inclusive.",
      },
      endDate: {
        type: "string",
        description: "End of reporting period as an ISO 8601 date string (e.g. '2026-04-30'). Inclusive.",
      },
    },
    required: ["startDate", "endDate"],
  },
};

const USD_TO_AED = 3.67;

async function aggregateForAgent(
  db: Parameters<ToolExecutor>[1]["db"],
  companyId: string,
  agentId: string,
  start: Date,
  end: Date,
): Promise<{
  deals_closed: number;
  deal_value_aed: number;
  commission_generated_aed: number;
  commission_collected_aed: number;
  leads_handled: number;
  compute_cost_usd: number;
  heartbeat_runs: number;
}> {
  // 1. Deals closed
  const dealsResult = await db
    .select({
      deals_closed: count(),
      deal_value_aed: sum(aygentDeals.price),
    })
    .from(aygentDeals)
    .where(
      and(
        eq(aygentDeals.companyId, companyId),
        eq(aygentDeals.agentId, agentId),
        eq(aygentDeals.stage, "completed"),
        gte(aygentDeals.completionDate, start),
        lte(aygentDeals.completionDate, end),
      ),
    );

  // 2. Commission generated (all commissions in range)
  const commissionGeneratedResult = await db
    .select({ total: sum(aygentCommissions.grossAmount) })
    .from(aygentCommissions)
    .where(
      and(
        eq(aygentCommissions.companyId, companyId),
        eq(aygentCommissions.agentId, agentId),
        gte(aygentCommissions.createdAt, start),
        lte(aygentCommissions.createdAt, end),
      ),
    );

  // 3. Commission collected (status=collected AND paidDate in range)
  const commissionCollectedResult = await db
    .select({ total: sum(aygentCommissions.grossAmount) })
    .from(aygentCommissions)
    .where(
      and(
        eq(aygentCommissions.companyId, companyId),
        eq(aygentCommissions.agentId, agentId),
        eq(aygentCommissions.status, "collected"),
        gte(aygentCommissions.paidDate, start),
        lte(aygentCommissions.paidDate, end),
      ),
    );

  // 4. Leads handled
  const leadsResult = await db
    .select({ total: count() })
    .from(aygentLeads)
    .where(
      and(
        eq(aygentLeads.companyId, companyId),
        eq(aygentLeads.agentId, agentId),
        gte(aygentLeads.createdAt, start),
        lte(aygentLeads.createdAt, end),
      ),
    );

  // 5. Compute cost (costCents → USD)
  const costResult = await db
    .select({ total: sum(costEvents.costCents) })
    .from(costEvents)
    .where(
      and(
        eq(costEvents.companyId, companyId),
        eq(costEvents.agentId, agentId),
        gte(costEvents.createdAt, start),
        lte(costEvents.createdAt, end),
      ),
    );

  // 6. Heartbeat runs
  const heartbeatResult = await db
    .select({ total: count() })
    .from(heartbeatRuns)
    .where(
      and(
        eq(heartbeatRuns.companyId, companyId),
        eq(heartbeatRuns.agentId, agentId),
        gte(heartbeatRuns.createdAt, start),
        lte(heartbeatRuns.createdAt, end),
      ),
    );

  const deals_closed = Number(dealsResult[0]?.deals_closed ?? 0);
  const deal_value_aed = Number(dealsResult[0]?.deal_value_aed ?? 0);
  const commission_generated_aed = Number(commissionGeneratedResult[0]?.total ?? 0);
  const commission_collected_aed = Number(commissionCollectedResult[0]?.total ?? 0);
  const leads_handled = Number(leadsResult[0]?.total ?? 0);
  const compute_cost_usd = Number(costResult[0]?.total ?? 0) / 100;
  const heartbeat_runs_count = Number(heartbeatResult[0]?.total ?? 0);

  return {
    deals_closed,
    deal_value_aed,
    commission_generated_aed,
    commission_collected_aed,
    leads_handled,
    compute_cost_usd,
    heartbeat_runs: heartbeat_runs_count,
  };
}

export const getAgentPerformanceExecutor: ToolExecutor = async (input, ctx) => {
  const { agentId, startDate, endDate } = input as {
    agentId?: string;
    startDate: string;
    endDate: string;
  };

  if (!startDate) return { error: "startDate is required." };
  if (!endDate) return { error: "endDate is required." };

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Set end to end-of-day to make the range inclusive
  end.setUTCHours(23, 59, 59, 999);

  if (isNaN(start.getTime())) return { error: `Invalid startDate: ${startDate}` };
  if (isNaN(end.getTime())) return { error: `Invalid endDate: ${endDate}` };
  if (start > end) return { error: "startDate must be before or equal to endDate." };

  // Determine which agents to report on
  let agentRows: { id: string; name: string; role: string }[];

  if (agentId) {
    const result = await ctx.db
      .select({ id: agents.id, name: agents.name, role: agents.role })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, ctx.companyId)))
      .limit(1);

    if (result.length === 0) return { error: `Agent not found: ${agentId}` };
    agentRows = result;
  } else {
    agentRows = await ctx.db
      .select({ id: agents.id, name: agents.name, role: agents.role })
      .from(agents)
      .where(eq(agents.companyId, ctx.companyId));
  }

  const agentResults = await Promise.all(
    agentRows.map(async (agent) => {
      const agg = await aggregateForAgent(ctx.db, ctx.companyId, agent.id, start, end);

      const compute_cost_aed = agg.compute_cost_usd * USD_TO_AED;
      const roi =
        compute_cost_aed > 0
          ? Math.round(agg.commission_generated_aed / compute_cost_aed)
          : agg.commission_generated_aed > 0
            ? null // infinite ROI — no cost but generated commission
            : 0;

      return {
        agent_id: agent.id,
        agent_name: agent.name,
        role: agent.role,
        deals_closed: agg.deals_closed,
        deal_value_aed: agg.deal_value_aed,
        commission_generated_aed: agg.commission_generated_aed,
        commission_collected_aed: agg.commission_collected_aed,
        leads_handled: agg.leads_handled,
        compute_cost_usd: Math.round(agg.compute_cost_usd * 100) / 100,
        heartbeat_runs: agg.heartbeat_runs,
        roi,
      };
    }),
  );

  // Sort by deals_closed desc
  agentResults.sort((a, b) => b.deals_closed - a.deals_closed);

  // Compute totals
  const totals = agentResults.reduce(
    (acc, a) => ({
      deals_closed: acc.deals_closed + a.deals_closed,
      deal_value_aed: acc.deal_value_aed + a.deal_value_aed,
      commission_generated_aed: acc.commission_generated_aed + a.commission_generated_aed,
      compute_cost_usd: acc.compute_cost_usd + a.compute_cost_usd,
    }),
    { deals_closed: 0, deal_value_aed: 0, commission_generated_aed: 0, compute_cost_usd: 0 },
  );

  totals.compute_cost_usd = Math.round(totals.compute_cost_usd * 100) / 100;

  return {
    period: {
      start: startDate,
      end: endDate,
    },
    agents: agentResults,
    totals,
  };
};
