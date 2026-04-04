import {
  eq,
  and,
  or,
  ilike,
  gte,
  lte,
  lt,
  isNull,
  desc,
  asc,
  inArray,
  sql,
} from "drizzle-orm";
import {
  aygentLeads,
  aygentActivities,
  aygentTags,
  aygentLeadTags,
} from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";
import { storeDeliverable } from "./lib/deliverables.js";

// ═══════════════════════════════════════════════════
// search_leads
// ═══════════════════════════════════════════════════

export const searchLeadsDefinition: ToolDefinition = {
  name: "search_leads",
  description:
    "Search the agent's lead pipeline by name, email, phone, stage, or notes. Use this when the agent asks about their clients, prospects, or pipeline status.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query — matches name, email, phone, notes",
      },
      stage: {
        type: "string",
        description:
          "Filter by pipeline stage: 'lead', 'qualified', 'active', 'under_contract', 'closed', 'nurture'",
      },
    },
  },
};

export const searchLeadsExecutor: ToolExecutor = async (input, ctx) => {
  const { query, stage } = input as { query?: string; stage?: string };
  const t = aygentLeads;

  const conditions = [eq(t.companyId, ctx.companyId)];
  if (stage) conditions.push(eq(t.stage, stage));
  if (query) {
    conditions.push(
      or(
        ilike(t.name, `%${query}%`),
        ilike(t.email, `%${query}%`),
        ilike(t.phone, `%${query}%`),
        ilike(t.notes, `%${query}%`),
      )!,
    );
  }

  const leads = await ctx.db
    .select()
    .from(t)
    .where(and(...conditions))
    .orderBy(desc(t.updatedAt))
    .limit(20);

  if (leads.length === 0) {
    return { results: [], message: "No leads found matching your criteria." };
  }

  return {
    results: leads.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      email: l.email,
      stage: l.stage,
      score: l.score,
      scoreBreakdown: l.scoreBreakdown,
      budget: l.budget,
      preferredAreas: l.preferredAreas,
      propertyType: l.propertyType,
      source: l.source,
      notes: l.notes?.slice(0, 200) ?? null,
      lastContactAt: l.lastContactAt?.toISOString() ?? null,
    })),
    total: leads.length,
  };
};

// ═══════════════════════════════════════════════════
// update_lead
// ═══════════════════════════════════════════════════

export const updateLeadDefinition: ToolDefinition = {
  name: "update_lead",
  description:
    "Update a lead's stage, notes, or contact details. For stage changes, this returns an approval card for the agent to confirm. Use the lead's database ID from search results.",
  input_schema: {
    type: "object",
    properties: {
      leadId: {
        type: "string",
        description: "The lead database ID from search results",
      },
      stage: {
        type: "string",
        description:
          "New pipeline stage: 'lead', 'qualified', 'active', 'under_contract', 'closed', 'nurture'",
      },
      notes: {
        type: "string",
        description: "Notes to add/update on the lead",
      },
    },
    required: ["leadId"],
  },
};

export const updateLeadExecutor: ToolExecutor = async (input, ctx) => {
  const { leadId, stage, notes } = input as {
    leadId: string;
    stage?: string;
    notes?: string;
  };

  const results = await ctx.db
    .select()
    .from(aygentLeads)
    .where(
      and(eq(aygentLeads.id, leadId), eq(aygentLeads.companyId, ctx.companyId)),
    )
    .limit(1);

  const lead = results[0];
  if (!lead) {
    return { error: "Lead not found or you don't have access." };
  }

  // Stage changes require approval
  if (stage && stage !== lead.stage) {
    return {
      type: "approval",
      action: "update_lead_stage",
      title: `Move ${lead.name} to ${stage.replace("_", " ")}`,
      description: `Change pipeline stage from **${lead.stage}** to **${stage.replace("_", " ")}** for ${lead.name}`,
      payload: { leadId, stage, currentStage: lead.stage },
      status: "pending",
    };
  }

  // Notes update — do directly
  if (notes) {
    await ctx.db
      .update(aygentLeads)
      .set({ notes, updatedAt: new Date() })
      .where(eq(aygentLeads.id, leadId));
    return { success: true, message: `Notes updated for ${lead.name}.` };
  }

  return { message: "No changes specified." };
};

// ═══════════════════════════════════════════════════
// get_lead_activity
// ═══════════════════════════════════════════════════

export const getLeadActivityDefinition: ToolDefinition = {
  name: "get_lead_activity",
  description:
    "Get the activity timeline for a specific lead. Returns a chronological log of all interactions including WhatsApp messages, emails, stage changes, score updates, notes, and viewings. Use when the agent asks about a lead's history or what's happened with a lead.",
  input_schema: {
    type: "object",
    properties: {
      leadId: {
        type: "string",
        description: "The lead's database ID",
      },
      limit: {
        type: "number",
        description: "Number of activities to return (default 20, max 50)",
      },
    },
    required: ["leadId"],
  },
};

export const getLeadActivityExecutor: ToolExecutor = async (input, ctx) => {
  const { leadId, limit } = input as { leadId: string; limit?: number };

  // Verify lead belongs to company
  const leadResults = await ctx.db
    .select({ id: aygentLeads.id, name: aygentLeads.name })
    .from(aygentLeads)
    .where(
      and(eq(aygentLeads.id, leadId), eq(aygentLeads.companyId, ctx.companyId)),
    )
    .limit(1);

  const lead = leadResults[0];
  if (!lead) {
    return { error: "Lead not found or you don't have access." };
  }

  const take = Math.min(limit ?? 20, 50);

  const activities = await ctx.db
    .select()
    .from(aygentActivities)
    .where(eq(aygentActivities.leadId, leadId))
    .orderBy(desc(aygentActivities.createdAt))
    .limit(take);

  if (activities.length === 0) {
    return {
      leadName: lead.name,
      message: "No activity recorded yet for this lead.",
      activities: [],
    };
  }

  return {
    leadName: lead.name,
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      body: a.body,
      metadata: a.metadata,
      createdAt: a.createdAt,
    })),
    total: activities.length,
  };
};

// ═══════════════════════════════════════════════════
// create_tag
// ═══════════════════════════════════════════════════

export const createTagDefinition: ToolDefinition = {
  name: "create_tag",
  description:
    "Create a custom tag for organizing leads. Tags can be plain labels (e.g. 'vip', 'dubai-hills') or behavior tags with automation (e.g. auto-reply, follow-up every 3 days). Use this when the agent wants to create a new tag.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "Tag name (lowercase, hyphenated). E.g. 'vip', 'auto-reply', 'nurture-monthly'",
      },
      color: {
        type: "string",
        description: "Hex color code. E.g. '#10b981'. Optional.",
      },
      behavior: {
        type: "object",
        description:
          "Optional automation behavior config. Omit for plain label tags.",
        properties: {
          type: {
            type: "string",
            enum: ["auto_reply", "draft_approval", "follow_up", "custom"],
          },
          autoReply: {
            type: "boolean",
            description:
              "Whether AI should auto-reply to messages from leads with this tag",
          },
          followUpIntervalDays: {
            type: "number",
            description:
              "Days between automated follow-ups. Null for no follow-up.",
          },
          followUpTemplate: {
            type: "string",
            description:
              "Prompt hint for follow-up generation. E.g. 'focus on new listings'",
          },
          guardrails: {
            type: "array",
            items: { type: "string" },
            description:
              "Topics to avoid in auto-replies. E.g. ['no_pricing', 'no_availability']",
          },
          channels: {
            type: "array",
            items: { type: "string" },
            description:
              "Channels this behavior applies to. E.g. ['whatsapp', 'instagram']",
          },
        },
        required: ["type", "autoReply", "channels"],
      },
    },
    required: ["name"],
  },
};

export const createTagExecutor: ToolExecutor = async (input, ctx) => {
  const { name, color, behavior } = input as {
    name: string;
    color?: string;
    behavior?: Record<string, unknown>;
  };

  try {
    const result = await ctx.db
      .insert(aygentTags)
      .values({
        companyId: ctx.companyId,
        name: name.toLowerCase().trim(),
        color: color ?? null,
        behavior: behavior ?? null,
      })
      .returning();

    const tag = result[0]!;
    const behaviorDesc = behavior
      ? ` with behavior: ${behavior.type}`
      : " (plain label)";
    return {
      success: true,
      tagId: tag.id,
      message: `Tag "${tag.name}" created${behaviorDesc}`,
    };
  } catch (error: unknown) {
    // Handle unique constraint violation
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      return { error: `Tag "${name}" already exists` };
    }
    throw error;
  }
};

// ═══════════════════════════════════════════════════
// tag_lead
// ═══════════════════════════════════════════════════

export const tagLeadDefinition: ToolDefinition = {
  name: "tag_lead",
  description:
    "Apply a tag to one or more leads. Use when the agent says 'tag Ahmed as VIP' or 'add auto-reply to all Dubai Hills leads'. For bulk tagging, call once per lead or use search to find leads first.",
  input_schema: {
    type: "object",
    properties: {
      lead: {
        type: "string",
        description: "Lead name, phone, email, or ID to tag",
      },
      tag: {
        type: "string",
        description: "Tag name to apply",
      },
    },
    required: ["lead", "tag"],
  },
};

export const tagLeadExecutor: ToolExecutor = async (input, ctx) => {
  const { lead: leadQuery, tag: tagName } = input as {
    lead: string;
    tag: string;
  };

  // Find lead by name, phone, email, or ID
  const leads = await ctx.db
    .select()
    .from(aygentLeads)
    .where(
      and(
        eq(aygentLeads.companyId, ctx.companyId),
        or(
          ilike(aygentLeads.name, `%${leadQuery}%`),
          ilike(aygentLeads.phone, `%${leadQuery}%`),
          ilike(aygentLeads.email, `%${leadQuery}%`),
          eq(aygentLeads.id, leadQuery),
        ),
      ),
    )
    .limit(1);

  const lead = leads[0];
  if (!lead) return { error: `Lead "${leadQuery}" not found` };

  // Find tag
  const tags = await ctx.db
    .select()
    .from(aygentTags)
    .where(
      and(
        eq(aygentTags.companyId, ctx.companyId),
        eq(aygentTags.name, tagName.toLowerCase().trim()),
      ),
    )
    .limit(1);

  const tag = tags[0];
  if (!tag)
    return {
      error: `Tag "${tagName}" not found. Create it first with create_tag.`,
    };

  // Apply tag (ignore if already exists)
  try {
    await ctx.db.insert(aygentLeadTags).values({
      leadId: lead.id,
      tagId: tag.id,
    });
  } catch (error: unknown) {
    // Duplicate key — already tagged, that's fine
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      return {
        success: true,
        message: `${lead.name} already has tag "${tag.name}"`,
      };
    }
    throw error;
  }

  // Log activity
  await ctx.db.insert(aygentActivities).values({
    companyId: ctx.companyId,
    leadId: lead.id,
    agentId: ctx.agentId,
    type: "tag_assigned",
    title: `Tag "${tag.name}" assigned`,
    metadata: { tagId: tag.id, tagName: tag.name },
  });

  return { success: true, message: `Tagged ${lead.name} as "${tag.name}"` };
};

// ═══════════════════════════════════════════════════
// untag_lead
// ═══════════════════════════════════════════════════

export const untagLeadDefinition: ToolDefinition = {
  name: "untag_lead",
  description:
    "Remove a tag from a lead. Use when agent says 'remove auto-reply from Ahmed'.",
  input_schema: {
    type: "object",
    properties: {
      lead: {
        type: "string",
        description: "Lead name, phone, email, or ID",
      },
      tag: {
        type: "string",
        description: "Tag name to remove",
      },
    },
    required: ["lead", "tag"],
  },
};

export const untagLeadExecutor: ToolExecutor = async (input, ctx) => {
  const { lead: leadQuery, tag: tagName } = input as {
    lead: string;
    tag: string;
  };

  const leads = await ctx.db
    .select()
    .from(aygentLeads)
    .where(
      and(
        eq(aygentLeads.companyId, ctx.companyId),
        or(
          ilike(aygentLeads.name, `%${leadQuery}%`),
          ilike(aygentLeads.phone, `%${leadQuery}%`),
          ilike(aygentLeads.email, `%${leadQuery}%`),
          eq(aygentLeads.id, leadQuery),
        ),
      ),
    )
    .limit(1);

  const lead = leads[0];
  if (!lead) return { error: `Lead "${leadQuery}" not found` };

  const tags = await ctx.db
    .select()
    .from(aygentTags)
    .where(
      and(
        eq(aygentTags.companyId, ctx.companyId),
        eq(aygentTags.name, tagName.toLowerCase().trim()),
      ),
    )
    .limit(1);

  const tag = tags[0];
  if (!tag) return { error: `Tag "${tagName}" not found` };

  await ctx.db
    .delete(aygentLeadTags)
    .where(
      and(
        eq(aygentLeadTags.leadId, lead.id),
        eq(aygentLeadTags.tagId, tag.id),
      ),
    );

  // Log activity
  await ctx.db.insert(aygentActivities).values({
    companyId: ctx.companyId,
    leadId: lead.id,
    agentId: ctx.agentId,
    type: "tag_removed",
    title: `Tag "${tag.name}" removed`,
    metadata: { tagId: tag.id, tagName: tag.name },
  });

  return {
    success: true,
    message: `Removed "${tag.name}" from ${lead.name}`,
  };
};

// ═══════════════════════════════════════════════════
// list_tags
// ═══════════════════════════════════════════════════

export const listTagsDefinition: ToolDefinition = {
  name: "list_tags",
  description:
    "List all tags, optionally filtered by lead. Use when agent asks 'show my tags' or 'what tags does Ahmed have'.",
  input_schema: {
    type: "object",
    properties: {
      lead: {
        type: "string",
        description:
          "Optional. Lead name/ID to show tags for. If omitted, shows all company tags.",
      },
    },
  },
};

export const listTagsExecutor: ToolExecutor = async (input, ctx) => {
  const { lead: leadQuery } = input as { lead?: string };

  if (leadQuery) {
    // Find lead
    const leads = await ctx.db
      .select()
      .from(aygentLeads)
      .where(
        and(
          eq(aygentLeads.companyId, ctx.companyId),
          or(
            ilike(aygentLeads.name, `%${leadQuery}%`),
            ilike(aygentLeads.phone, `%${leadQuery}%`),
            eq(aygentLeads.id, leadQuery),
          ),
        ),
      )
      .limit(1);

    const lead = leads[0];
    if (!lead) return { error: `Lead "${leadQuery}" not found` };

    // Get tags for this lead
    const leadTags = await ctx.db
      .select({
        name: aygentTags.name,
        color: aygentTags.color,
        behavior: aygentTags.behavior,
        assignedAt: aygentLeadTags.assignedAt,
      })
      .from(aygentLeadTags)
      .innerJoin(aygentTags, eq(aygentLeadTags.tagId, aygentTags.id))
      .where(eq(aygentLeadTags.leadId, lead.id));

    return {
      lead: lead.name,
      tags: leadTags.map((t) => ({
        name: t.name,
        color: t.color,
        hasBehavior: t.behavior !== null,
        assignedAt: t.assignedAt,
      })),
    };
  }

  // List all company tags with lead counts
  const tags = await ctx.db
    .select({
      id: aygentTags.id,
      name: aygentTags.name,
      color: aygentTags.color,
      behavior: aygentTags.behavior,
      leadCount: sql<number>`(SELECT count(*) FROM aygent_lead_tags WHERE tag_id = ${aygentTags.id})`,
    })
    .from(aygentTags)
    .where(eq(aygentTags.companyId, ctx.companyId));

  return {
    tags: tags.map((t) => ({
      name: t.name,
      color: t.color,
      behavior: t.behavior
        ? (t.behavior as Record<string, unknown>).type
        : null,
      leadCount: Number(t.leadCount),
    })),
  };
};

// ═══════════════════════════════════════════════════
// get_follow_ups
// ═══════════════════════════════════════════════════

export const getFollowUpsDefinition: ToolDefinition = {
  name: "get_follow_ups",
  description:
    "Find leads that need follow-up. Checks last contact date. Use when agent asks 'who needs a follow-up?', 'any leads I haven't spoken to?', or 'show me leads waiting for my reply'.",
  input_schema: {
    type: "object",
    properties: {
      tag: {
        type: "string",
        description: "Optional. Filter by tag name.",
      },
      daysInactive: {
        type: "number",
        description:
          "Optional. Minimum days since last contact. Default: 3.",
      },
      stage: {
        type: "string",
        description: "Optional. Filter by lead stage.",
      },
    },
  },
};

export const getFollowUpsExecutor: ToolExecutor = async (input, ctx) => {
  const { tag, daysInactive, stage } = input as {
    tag?: string;
    daysInactive?: number;
    stage?: string;
  };

  const days = daysInactive ?? 3;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const t = aygentLeads;

  const conditions = [
    eq(t.companyId, ctx.companyId),
    or(lt(t.lastContactAt, cutoff), isNull(t.lastContactAt))!,
  ];

  if (stage) conditions.push(eq(t.stage, stage));

  // If tag filter, we need a subquery
  if (tag) {
    conditions.push(
      sql`${t.id} IN (
        SELECT lt.lead_id FROM aygent_lead_tags lt
        JOIN aygent_tags tg ON lt.tag_id = tg.id
        WHERE tg.name = ${tag.toLowerCase().trim()}
      )`,
    );
  }

  const leads = await ctx.db
    .select()
    .from(t)
    .where(and(...conditions))
    .orderBy(desc(t.score))
    .limit(20);

  return {
    count: leads.length,
    leads: leads.map((l) => {
      const daysSince = l.lastContactAt
        ? Math.floor(
            (Date.now() - new Date(l.lastContactAt).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : "never";
      return {
        id: l.id,
        name: l.name,
        score: l.score,
        stage: l.stage,
        daysSinceContact: daysSince,
        phone: l.phone,
        email: l.email,
        preferredAreas: l.preferredAreas,
      };
    }),
  };
};

// ═══════════════════════════════════════════════════
// bulk_follow_up
// ═══════════════════════════════════════════════════

export const bulkFollowUpDefinition: ToolDefinition = {
  name: "bulk_follow_up",
  description:
    "Send personalized follow-up messages to multiple leads. Messages are AI-generated based on each lead's conversation history. Leads with auto-reply tag get sent immediately; others need agent approval. Use when agent says 'follow up with all my VIP leads' or 'send a market update to everyone tagged nurture'.",
  input_schema: {
    type: "object",
    properties: {
      tag: {
        type: "string",
        description: "Tag name to filter leads by",
      },
      leadIds: {
        type: "array",
        items: { type: "string" },
        description: "Specific lead IDs. Alternative to tag filter.",
      },
      message: {
        type: "string",
        description:
          "Optional. Custom message prompt or theme. E.g. 'share the new Emaar pricing'",
      },
    },
  },
};

export const bulkFollowUpExecutor: ToolExecutor = async (input, ctx) => {
  const { tag, leadIds, message } = input as {
    tag?: string;
    leadIds?: string[];
    message?: string;
  };

  if (!tag && (!leadIds || leadIds.length === 0)) {
    return { error: "Provide either a tag or leadIds to follow up with" };
  }

  let leads;
  if (tag) {
    leads = await ctx.db
      .select()
      .from(aygentLeads)
      .where(
        and(
          eq(aygentLeads.companyId, ctx.companyId),
          sql`${aygentLeads.id} IN (
            SELECT lt.lead_id FROM aygent_lead_tags lt
            JOIN aygent_tags tg ON lt.tag_id = tg.id
            WHERE tg.name = ${tag.toLowerCase().trim()}
          )`,
        ),
      );
  } else {
    leads = await ctx.db
      .select()
      .from(aygentLeads)
      .where(
        and(
          eq(aygentLeads.companyId, ctx.companyId),
          inArray(aygentLeads.id, leadIds!),
        ),
      );
  }

  if (leads.length === 0) return { error: "No leads found matching criteria" };

  const leadSummaries = leads.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email,
    score: l.score,
    stage: l.stage,
    lastContactAt: l.lastContactAt?.toISOString() ?? null,
  }));

  const deliverableId = await storeDeliverable(ctx, {
    type: "bulk_follow_up",
    title: `Bulk Follow-Up — ${leads.length} lead(s)${tag ? ` [${tag}]` : ""}`,
    summary: `Follow-up batch for ${leads.length} leads.${message ? ` Theme: ${message}` : ""} Lead names: ${leads.map((l) => l.name).join(", ")}.`,
    metadata: { toolInput: input, leadCount: leads.length, leadIds: leads.map((l) => l.id) },
  });

  // In the Aygency World context, we return the lead list for the agent to process.
  // The actual message generation happens through the agent's heartbeat + approval flow.
  return {
    message: `Found ${leads.length} leads for follow-up. Draft personalized messages for each and queue for approval.`,
    leadCount: leads.length,
    leads: leadSummaries,
    messageHint: message ?? null,
    deliverableId,
  };
};

// ═══════════════════════════════════════════════════
// bulk_lead_action
// ═══════════════════════════════════════════════════

export const bulkLeadActionDefinition: ToolDefinition = {
  name: "bulk_lead_action",
  description:
    "Perform an action on multiple leads at once. Can target leads by explicit IDs or by filter criteria (stage, score range). Actions: stage (move to new pipeline stage), tag (apply a tag). Use when the agent says 'move all my hot leads to active' or 'tag all qualified leads as vip'.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", description: "stage | tag" },
      filter: {
        type: "object",
        properties: {
          stage: { type: "string" },
          minScore: { type: "number" },
          maxScore: { type: "number" },
        },
      },
      leadIds: { type: "array", items: { type: "string" } },
      payload: {
        type: "object",
        properties: {
          stage: { type: "string" },
          tagName: { type: "string" },
        },
      },
    },
    required: ["action"],
  },
};

export const bulkLeadActionExecutor: ToolExecutor = async (input, ctx) => {
  const { action, leadIds, filter, payload } = input as {
    action: "stage" | "tag";
    leadIds?: string[];
    filter?: { stage?: string; minScore?: number; maxScore?: number };
    payload?: { stage?: string; tagName?: string };
  };

  if (!action) return { error: "action is required" };

  // Resolve lead IDs
  let resolvedIds: string[] = [];

  if (leadIds && leadIds.length > 0) {
    // Verify they belong to this company
    const owned = await ctx.db
      .select({ id: aygentLeads.id })
      .from(aygentLeads)
      .where(
        and(
          eq(aygentLeads.companyId, ctx.companyId),
          inArray(aygentLeads.id, leadIds),
        ),
      );
    resolvedIds = owned.map((l) => l.id);
  } else if (filter) {
    const conditions = [eq(aygentLeads.companyId, ctx.companyId)];
    if (filter.stage) conditions.push(eq(aygentLeads.stage, filter.stage));
    if (filter.minScore !== undefined)
      conditions.push(gte(aygentLeads.score, filter.minScore));
    if (filter.maxScore !== undefined)
      conditions.push(lte(aygentLeads.score, filter.maxScore));

    const leads = await ctx.db
      .select({ id: aygentLeads.id })
      .from(aygentLeads)
      .where(and(...conditions));
    resolvedIds = leads.map((l) => l.id);
  }

  if (resolvedIds.length === 0) {
    return {
      success: true,
      count: 0,
      action,
      message: "No leads matched the criteria.",
    };
  }

  if (action === "stage") {
    if (!payload?.stage) {
      return { error: "payload.stage is required for stage action" };
    }

    await ctx.db
      .update(aygentLeads)
      .set({ stage: payload.stage, updatedAt: new Date() })
      .where(inArray(aygentLeads.id, resolvedIds));

    return {
      success: true,
      count: resolvedIds.length,
      action,
      message: `Moved ${resolvedIds.length} leads to ${payload.stage}`,
    };
  }

  if (action === "tag") {
    if (!payload?.tagName) {
      return { error: "payload.tagName is required for tag action" };
    }

    // Find or create the tag
    const tagName = payload.tagName.toLowerCase().trim();
    let tagRows = await ctx.db
      .select()
      .from(aygentTags)
      .where(
        and(
          eq(aygentTags.companyId, ctx.companyId),
          eq(aygentTags.name, tagName),
        ),
      )
      .limit(1);

    if (tagRows.length === 0) {
      // Auto-create the tag
      tagRows = await ctx.db
        .insert(aygentTags)
        .values({ companyId: ctx.companyId, name: tagName })
        .returning();
    }

    const tag = tagRows[0]!;
    let applied = 0;

    for (const leadId of resolvedIds) {
      try {
        await ctx.db.insert(aygentLeadTags).values({
          leadId,
          tagId: tag.id,
        });
        applied++;
      } catch (error: unknown) {
        // Skip duplicate key errors (lead already has this tag)
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "23505"
        ) {
          continue;
        }
        throw error;
      }
    }

    return {
      success: true,
      count: resolvedIds.length,
      applied,
      action,
      tagName: tag.name,
      message: `Applied tag "${tag.name}" to ${applied} leads (${resolvedIds.length - applied} already had it)`,
    };
  }

  return { error: `Unknown action: ${action}. Supported actions: stage, tag` };
};

// ═══════════════════════════════════════════════════
// match_deal_to_leads
// ═══════════════════════════════════════════════════

export const matchDealToLeadsDefinition: ToolDefinition = {
  name: "match_deal_to_leads",
  description:
    "Match a new listing or deal opportunity against the agent's lead pipeline to find potential buyers/tenants. Searches leads by budget, preferred areas, property type, and score. Use when agent says 'I just got a listing' or 'who would want this property' or 'match this to my pipeline'.",
  input_schema: {
    type: "object",
    properties: {
      price: {
        type: "number",
        description:
          "Property price in AED (sale) or annual rent (rental)",
      },
      area: {
        type: "string",
        description: "Property area/community",
      },
      propertyType: {
        type: "string",
        description:
          "apartment, villa, townhouse, studio, penthouse, office",
      },
      bedrooms: { type: "string", description: "Number of bedrooms" },
      purpose: {
        type: "string",
        description: "'sale' or 'rent'",
      },
      highlights: {
        type: "string",
        description:
          "Key selling points (e.g. 'distressed seller, below market, sea view, furnished')",
      },
    },
    required: ["price", "area"],
  },
};

export const matchDealToLeadsExecutor: ToolExecutor = async (input, ctx) => {
  const { price, area, propertyType, bedrooms, purpose, highlights } =
    input as {
      price: number;
      area: string;
      propertyType?: string;
      bedrooms?: string;
      purpose?: string;
      highlights?: string;
    };

  const leads = await ctx.db
    .select()
    .from(aygentLeads)
    .where(eq(aygentLeads.companyId, ctx.companyId))
    .orderBy(desc(aygentLeads.score));

  const matches = leads.filter((lead) => {
    const budget = lead.budget as { min?: number; max?: number } | null;
    if (budget) {
      if (budget.max && price > budget.max * 1.1) return false;
      if (budget.min && price < budget.min * 0.5) return false;
    }

    const areas = lead.preferredAreas as string[] | null;
    if (areas && areas.length > 0 && area) {
      const areaLower = area.toLowerCase();
      const hasMatch = areas.some(
        (a) =>
          a.toLowerCase().includes(areaLower) ||
          areaLower.includes(a.toLowerCase()),
      );
      if (!hasMatch) return false;
    }

    return true;
  });

  const matchSummaries = matches.slice(0, 10).map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    score: lead.score,
    stage: lead.stage,
    budget: lead.budget,
    preferredAreas: lead.preferredAreas,
    propertyType: lead.propertyType,
    lastContactAt: lead.lastContactAt?.toISOString() ?? null,
    notes: lead.notes?.substring(0, 200),
  }));

  const safePrice = price ?? 0;
  const safeArea = area ?? "Unknown";

  const deliverableId = await storeDeliverable(ctx, {
    type: "deal_match",
    title: `Deal Match — ${safeArea} AED ${safePrice.toLocaleString()} (${matches.length} match${matches.length !== 1 ? "es" : ""})`,
    summary: `Matched listing in ${safeArea} (AED ${safePrice.toLocaleString()}) against pipeline. ${matches.length} lead(s) matched.${matches.length > 0 ? ` Top: ${matches[0]?.name} (score ${matches[0]?.score}/10).` : ""}`,
    metadata: { toolInput: input, matchCount: matches.length, matchIds: matches.slice(0, 10).map((l) => l.id) },
  });

  return {
    totalLeads: leads.length,
    matchingLeads: matches.length,
    matches: matchSummaries,
    listing: {
      price: price ?? 0,
      area: area ?? "",
      propertyType: propertyType ?? null,
      bedrooms: bedrooms ?? null,
      purpose: purpose ?? "sale",
      highlights: highlights ?? null,
    },
    suggestion:
      matches.length > 0
        ? `Found ${matches.length} matching leads. Top match: ${matches[0]?.name} (score ${matches[0]?.score}/10). Want me to draft personalized messages to all ${Math.min(matches.length, 10)} matches?`
        : "No matching leads in your pipeline for this listing.",
    deliverableId,
  };
};

// ═══════════════════════════════════════════════════
// reactivate_stale_leads
// ═══════════════════════════════════════════════════

export const reactivateStaleLeadsDefinition: ToolDefinition = {
  name: "reactivate_stale_leads",
  description:
    "Find leads that haven't been contacted in a specified number of days and draft personalized follow-up messages for each. Use when agent says 'follow up with cold leads', 'who haven't I spoken to', 'reactivate my pipeline', or 'message leads I haven't contacted'.",
  input_schema: {
    type: "object",
    properties: {
      daysSinceContact: {
        type: "number",
        description:
          "Number of days since last contact. Defaults to 14.",
      },
      stage: {
        type: "string",
        description:
          "Filter by stage: lead, qualified, active, nurture, all. Defaults to all.",
      },
      maxLeads: {
        type: "number",
        description: "Maximum number of leads to include. Defaults to 10.",
      },
      messageAngle: {
        type: "string",
        description:
          "Angle for the follow-up: 'market_update', 'new_listing', 'price_drop', 'general_checkin', 'opportunity'. Defaults to market_update.",
      },
    },
  },
};

export const reactivateStaleLeadsExecutor: ToolExecutor = async (
  input,
  ctx,
) => {
  const { daysSinceContact, stage, maxLeads, messageAngle } = input as {
    daysSinceContact?: number;
    stage?: string;
    maxLeads?: number;
    messageAngle?: string;
  };

  const days = daysSinceContact ?? 14;
  const take = maxLeads ?? 10;
  const angle = messageAngle ?? "market_update";
  const stageFilter = stage ?? "all";

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const conditions = [
    eq(aygentLeads.companyId, ctx.companyId),
    or(lt(aygentLeads.lastContactAt, cutoffDate), isNull(aygentLeads.lastContactAt))!,
  ];

  if (stageFilter !== "all") {
    conditions.push(eq(aygentLeads.stage, stageFilter));
  }

  const staleLeads = await ctx.db
    .select()
    .from(aygentLeads)
    .where(and(...conditions))
    .orderBy(desc(aygentLeads.score))
    .limit(take);

  const leadSummaries = staleLeads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    score: lead.score,
    stage: lead.stage,
    lastContactAt: lead.lastContactAt?.toISOString() ?? null,
    preferredAreas: lead.preferredAreas,
    propertyType: lead.propertyType,
    budget: lead.budget,
    notes: lead.notes?.substring(0, 200),
  }));

  let deliverableId: string | null = null;
  if (staleLeads.length > 0) {
    deliverableId = await storeDeliverable(ctx, {
      type: "stale_lead_reactivation",
      title: `Stale Lead Reactivation — ${staleLeads.length} lead(s), ${days}+ days inactive`,
      summary: `Found ${staleLeads.length} leads inactive for ${days}+ days. Angle: ${angle}. Stage filter: ${stageFilter}. Leads: ${staleLeads.map((l) => l.name).join(", ")}.`,
      metadata: { toolInput: input, leadCount: staleLeads.length, leadIds: staleLeads.map((l) => l.id) },
    });
  }

  return {
    totalFound: staleLeads.length,
    daysSinceContact: days,
    stageFilter,
    messageAngle: angle,
    leads: leadSummaries,
    instruction:
      staleLeads.length > 0
        ? `Found ${staleLeads.length} leads not contacted in ${days}+ days. Draft personalized ${angle} messages for each, using their preferences and last conversation context. Present as approval cards for WhatsApp.`
        : `All leads have been contacted within the last ${days} days. Pipeline is active.`,
    deliverableId,
  };
};

// ═══════════════════════════════════════════════════
// deduplicate_leads
// ═══════════════════════════════════════════════════

export const deduplicateLeadsDefinition: ToolDefinition = {
  name: "deduplicate_leads",
  description:
    "Find potential duplicate leads in the agent's pipeline by matching phone numbers (last 9 digits) and email addresses. Returns groups of leads that may be duplicates. Use when the agent wants to clean up their pipeline or suspects duplicate entries.",
  input_schema: {
    type: "object",
    properties: {},
  },
};

export const deduplicateLeadsExecutor: ToolExecutor = async (_input, ctx) => {
  const leads = await ctx.db
    .select({
      id: aygentLeads.id,
      name: aygentLeads.name,
      phone: aygentLeads.phone,
      email: aygentLeads.email,
      stage: aygentLeads.stage,
      score: aygentLeads.score,
      lastContactAt: aygentLeads.lastContactAt,
    })
    .from(aygentLeads)
    .where(eq(aygentLeads.companyId, ctx.companyId))
    .orderBy(asc(aygentLeads.name));

  if (leads.length === 0) {
    return { duplicates: [], message: "No leads found in your pipeline." };
  }

  // Group by normalized phone (last 9 digits)
  const phoneGroups = new Map<string, typeof leads>();
  const emailGroups = new Map<string, typeof leads>();

  for (const lead of leads) {
    if (lead.phone) {
      const normalizedPhone = lead.phone.replace(/\D/g, "").slice(-9);
      if (normalizedPhone.length >= 7) {
        const group = phoneGroups.get(normalizedPhone) ?? [];
        group.push(lead);
        phoneGroups.set(normalizedPhone, group);
      }
    }
    if (lead.email) {
      const normalizedEmail = lead.email.toLowerCase().trim();
      const group = emailGroups.get(normalizedEmail) ?? [];
      group.push(lead);
      emailGroups.set(normalizedEmail, group);
    }
  }

  const duplicateGroups: Array<{
    matchType: string;
    matchValue: string;
    leads: Array<{
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      stage: string;
      score: number;
    }>;
  }> = [];

  const seenIds = new Set<string>();

  for (const [phone, group] of phoneGroups) {
    if (group.length < 2) continue;
    const key = group
      .map((l) => l.id)
      .sort()
      .join(",");
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    duplicateGroups.push({
      matchType: "phone",
      matchValue: phone,
      leads: group.map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        stage: l.stage,
        score: l.score,
      })),
    });
  }

  for (const [email, group] of emailGroups) {
    if (group.length < 2) continue;
    const key = group
      .map((l) => l.id)
      .sort()
      .join(",");
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    duplicateGroups.push({
      matchType: "email",
      matchValue: email,
      leads: group.map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        stage: l.stage,
        score: l.score,
      })),
    });
  }

  if (duplicateGroups.length === 0) {
    return {
      duplicates: [],
      message: "No duplicate leads found. Your pipeline is clean!",
    };
  }

  return {
    duplicates: duplicateGroups,
    totalGroups: duplicateGroups.length,
    message: `Found ${duplicateGroups.length} group(s) of potential duplicates. Review each group and use merge_leads to combine them.`,
  };
};

// ═══════════════════════════════════════════════════
// merge_leads
// ═══════════════════════════════════════════════════

export const mergeLeadsDefinition: ToolDefinition = {
  name: "merge_leads",
  description:
    "Merge two duplicate leads. Moves all activities and tags from the source lead to the target lead. Combines notes. Deletes the source lead. Use after deduplicate_leads identifies duplicates and the agent confirms which to merge.",
  input_schema: {
    type: "object",
    properties: {
      sourceLeadId: {
        type: "string",
        description:
          "The ID of the duplicate lead to merge FROM (will be deleted)",
      },
      targetLeadId: {
        type: "string",
        description:
          "The ID of the lead to merge INTO (will be kept)",
      },
    },
    required: ["sourceLeadId", "targetLeadId"],
  },
};

export const mergeLeadsExecutor: ToolExecutor = async (input, ctx) => {
  const { sourceLeadId, targetLeadId } = input as {
    sourceLeadId: string;
    targetLeadId: string;
  };

  if (sourceLeadId === targetLeadId) {
    return { error: "Source and target lead cannot be the same." };
  }

  // Verify both leads exist and belong to company
  const [sourceResults, targetResults] = await Promise.all([
    ctx.db
      .select()
      .from(aygentLeads)
      .where(
        and(
          eq(aygentLeads.id, sourceLeadId),
          eq(aygentLeads.companyId, ctx.companyId),
        ),
      )
      .limit(1),
    ctx.db
      .select()
      .from(aygentLeads)
      .where(
        and(
          eq(aygentLeads.id, targetLeadId),
          eq(aygentLeads.companyId, ctx.companyId),
        ),
      )
      .limit(1),
  ]);

  const source = sourceResults[0];
  const target = targetResults[0];

  if (!source) return { error: "Source lead not found or not yours." };
  if (!target) return { error: "Target lead not found or not yours." };

  // Move activities from source to target
  await ctx.db
    .update(aygentActivities)
    .set({ leadId: targetLeadId })
    .where(eq(aygentActivities.leadId, sourceLeadId));

  // Move tags (skip duplicates via delete-then-insert)
  const sourceTags = await ctx.db
    .select()
    .from(aygentLeadTags)
    .where(eq(aygentLeadTags.leadId, sourceLeadId));

  const targetTags = await ctx.db
    .select()
    .from(aygentLeadTags)
    .where(eq(aygentLeadTags.leadId, targetLeadId));

  const targetTagIds = new Set(targetTags.map((t) => t.tagId));

  for (const tag of sourceTags) {
    if (!targetTagIds.has(tag.tagId)) {
      try {
        await ctx.db.insert(aygentLeadTags).values({
          leadId: targetLeadId,
          tagId: tag.tagId,
        });
      } catch {
        // Ignore duplicate key errors
      }
    }
  }

  // Delete source tags
  await ctx.db
    .delete(aygentLeadTags)
    .where(eq(aygentLeadTags.leadId, sourceLeadId));

  // Combine notes
  const combinedNotes = [target.notes, source.notes]
    .filter(Boolean)
    .join("\n\n---\n\n");

  // Update target with combined data
  await ctx.db
    .update(aygentLeads)
    .set({
      notes: combinedNotes || null,
      phone: target.phone || source.phone,
      email: target.email || source.email,
      nationality: target.nationality || source.nationality,
      source: target.source || source.source,
      score: Math.max(target.score ?? 0, source.score ?? 0),
      updatedAt: new Date(),
    })
    .where(eq(aygentLeads.id, targetLeadId));

  // Delete source lead
  await ctx.db
    .delete(aygentLeads)
    .where(eq(aygentLeads.id, sourceLeadId));

  return {
    success: true,
    message: `Merged "${source.name}" into "${target.name}". All activities and tags have been transferred. The duplicate lead has been deleted.`,
    targetLeadId,
    targetLeadName: target.name,
    mergedFrom: source.name,
  };
};
