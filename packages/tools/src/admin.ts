import { eq, and, desc, ilike, sql } from "drizzle-orm";
import {
  aygentAgentMemory,
  aygentGuardrails,
  aygentNews,
  aygentCampaigns,
  aygentCampaignEnrollments,
} from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";

// ═══════════════════════════════════════════════════
// create_task
// ═══════════════════════════════════════════════════

export const createTaskDefinition: ToolDefinition = {
  name: "create_task",
  description:
    "Create a scheduled task or reminder for the agent. Can be a one-off reminder or a recurring cron job. Use this when the agent says 'remind me to...', 'every Monday send...', or 'schedule a follow-up'.",
  input_schema: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "Description of what the task/reminder should do",
      },
      type: {
        type: "string",
        description: "'cron' for recurring tasks, 'one_off' for single reminders",
      },
      cronExpression: {
        type: "string",
        description:
          "Cron expression for recurring tasks (e.g. '0 9 * * 1' for every Monday 9am). Required when type is 'cron'.",
      },
    },
    required: ["description", "type"],
  },
};

export const createTaskExecutor: ToolExecutor = async (input, _ctx) => {
  const { description, type, cronExpression } = input as {
    description: string;
    type: string;
    cronExpression?: string;
  };

  // Tasks are managed by Paperclip's issue system — return structured data for the orchestrator
  return {
    status: "task_created",
    description,
    type,
    cronExpression: cronExpression ?? null,
    message: type === "cron"
      ? `Recurring task created: "${description}" with schedule ${cronExpression}.`
      : `One-off reminder created: "${description}".`,
  };
};

// ═══════════════════════════════════════════════════
// remember
// ═══════════════════════════════════════════════════

export const rememberDefinition: ToolDefinition = {
  name: "remember",
  description:
    "Store an important fact in memory so it's available in future conversations. Use this when the agent explicitly asks you to remember something, or when you learn something important about a lead, project preference, or commitment that should persist.",
  input_schema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The fact to remember",
      },
      subject: {
        type: "string",
        description:
          "Who or what this is about (lead name, project name, or 'agent preference')",
      },
      type: {
        type: "string",
        description:
          "Category: lead_mentioned | project_interest | commitment | preference | context",
      },
    },
    required: ["content", "subject"],
  },
};

export const rememberExecutor: ToolExecutor = async (input, ctx) => {
  const { content, subject, type } = input as {
    content: string;
    subject: string;
    type?: string;
  };

  const memoryType = type ?? "context";

  // Upsert: update if same agent+subject+type exists, otherwise insert
  const existing = await ctx.db
    .select()
    .from(aygentAgentMemory)
    .where(
      and(
        eq(aygentAgentMemory.agentId, ctx.agentId),
        eq(aygentAgentMemory.subject, subject),
        eq(aygentAgentMemory.type, memoryType),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await ctx.db
      .update(aygentAgentMemory)
      .set({ content, updatedAt: new Date() })
      .where(eq(aygentAgentMemory.id, existing[0]!.id));
    return { status: "updated", subject, type: memoryType, message: `Memory updated for "${subject}".` };
  }

  await ctx.db.insert(aygentAgentMemory).values({
    companyId: ctx.companyId,
    agentId: ctx.agentId,
    type: memoryType,
    subject,
    content,
  });

  return { status: "stored", subject, type: memoryType, message: `Remembered: "${content}" about ${subject}.` };
};

// ═══════════════════════════════════════════════════
// set_guardrails
// ═══════════════════════════════════════════════════

export const setGuardrailsDefinition: ToolDefinition = {
  name: "set_guardrails",
  description:
    "Configure global guardrails for auto-reply. Controls what the AI should never discuss in automated responses. Use when agent says 'never auto-reply about pricing above 5M' or 'don't confirm availability in auto-replies'.",
  input_schema: {
    type: "object",
    properties: {
      guardrails: {
        type: "array",
        items: { type: "string" },
        description: "List of guardrail rules. E.g. ['no_pricing_above_5M', 'no_availability', 'qualify_budget_first']",
      },
    },
    required: ["guardrails"],
  },
};

export const setGuardrailsExecutor: ToolExecutor = async (input, ctx) => {
  const { guardrails } = input as { guardrails: string[] };

  // Delete existing guardrails for this agent, then insert new ones
  await ctx.db
    .delete(aygentGuardrails)
    .where(
      and(
        eq(aygentGuardrails.companyId, ctx.companyId),
        eq(aygentGuardrails.agentId, ctx.agentId),
      ),
    );

  for (const rule of guardrails) {
    await ctx.db.insert(aygentGuardrails).values({
      companyId: ctx.companyId,
      agentId: ctx.agentId,
      rule,
      enabled: true,
    });
  }

  return {
    guardrails,
    count: guardrails.length,
    message: `Set ${guardrails.length} guardrail(s) for this agent.`,
  };
};

// ═══════════════════════════════════════════════════
// get_news
// ═══════════════════════════════════════════════════

export const getNewsDefinition: ToolDefinition = {
  name: "get_news",
  description:
    "Get the latest Dubai real estate news articles. Optionally filter by category (market, launches, regulation, infrastructure, trends) or keyword search. Use this when the agent asks about market news, new launches, RERA updates, or any real estate industry news.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description:
          "Filter by category: 'market', 'launches', 'regulation', 'infrastructure', 'trends'",
      },
      query: {
        type: "string",
        description: "Search query to filter articles by title/summary",
      },
      limit: {
        type: "number",
        description: "Number of articles to return (default 10, max 20)",
      },
    },
  },
};

export const getNewsExecutor: ToolExecutor = async (input, ctx) => {
  const { category, query, limit } = input as {
    category?: string;
    query?: string;
    limit?: number;
  };

  const take = Math.min(limit ?? 10, 20);
  const t = aygentNews;
  const conditions = [eq(t.companyId, ctx.companyId)];

  if (category) conditions.push(eq(t.category, category));
  if (query) {
    conditions.push(ilike(t.title, `%${query}%`));
  }

  const articles = await ctx.db
    .select()
    .from(t)
    .where(and(...conditions))
    .orderBy(desc(t.publishedAt))
    .limit(take);

  if (articles.length === 0) {
    return { articles: [], message: "No news articles found. Try broadening your search or removing filters." };
  }

  return {
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      source: a.source,
      category: a.category,
      summary: a.summary?.slice(0, 300) ?? null,
      imageUrl: a.imageUrl,
      publishedAt: a.publishedAt?.toISOString() ?? null,
    })),
    total: articles.length,
  };
};

// ═══════════════════════════════════════════════════
// get_campaign_stats
// ═══════════════════════════════════════════════════

export const getCampaignStatsDefinition: ToolDefinition = {
  name: "get_campaign_stats",
  description:
    "Get aggregate statistics for an email drip campaign: total enrolled, total opens, total clicks, open rate, and click rate.",
  input_schema: {
    type: "object",
    properties: {
      campaignId: {
        type: "string",
        description: "The drip campaign ID to get stats for",
      },
    },
    required: ["campaignId"],
  },
};

export const getCampaignStatsExecutor: ToolExecutor = async (input, ctx) => {
  const { campaignId } = input as { campaignId: string };

  // Verify campaign exists
  const campaigns = await ctx.db
    .select()
    .from(aygentCampaigns)
    .where(and(eq(aygentCampaigns.id, campaignId), eq(aygentCampaigns.companyId, ctx.companyId)))
    .limit(1);

  if (campaigns.length === 0) {
    return { error: "Campaign not found." };
  }

  const campaign = campaigns[0]!;

  // Aggregate enrollment stats
  const enrollments = await ctx.db
    .select()
    .from(aygentCampaignEnrollments)
    .where(eq(aygentCampaignEnrollments.campaignId, campaignId));

  const totalEnrolled = enrollments.length;
  const totalOpens = enrollments.reduce((sum, e) => sum + (e.opens ?? 0), 0);
  const totalClicks = enrollments.reduce((sum, e) => sum + (e.clicks ?? 0), 0);
  const active = enrollments.filter((e) => e.status === "active").length;
  const completed = enrollments.filter((e) => e.status === "completed").length;

  return {
    campaignId,
    campaignName: campaign.name,
    type: campaign.type,
    status: campaign.status,
    totalEnrolled,
    active,
    completed,
    totalOpens,
    totalClicks,
    openRate: totalEnrolled > 0 ? `${((totalOpens / totalEnrolled) * 100).toFixed(1)}%` : "0%",
    clickRate: totalEnrolled > 0 ? `${((totalClicks / totalEnrolled) * 100).toFixed(1)}%` : "0%",
  };
};
