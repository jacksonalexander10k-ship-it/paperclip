/**
 * Outreach Service
 *
 * Owns the "start outreach for an assigned lead" flow:
 *   - Creates a high-priority issue assigned to the agent (visible delegation)
 *   - Logs activity event `lead.outreach_started`
 *   - Inserts a queue entry with the rendered message (template OR custom)
 *
 * Used by:
 *   - POST /companies/:id/leads/bulk (action=start_outreach)
 *   - CEO command `start_outreach`
 */

import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  companies,
  issues,
  aygentLeads,
  aygentWhatsappTemplates,
  aygentAutoReplyQueue,
} from "@paperclipai/db";
import { autoReplyService } from "./auto-reply.js";
import { approvalService } from "./approvals.js";
import { logActivity } from "./activity-log.js";
import { logger } from "../middleware/logger.js";

/** Replace {{var}} placeholders with values; missing vars become empty string */
export function renderTemplate(
  template: string,
  vars: Record<string, string | undefined | null>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, key) => String(vars[key] ?? ""));
}

export interface OutreachLeadInput {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string | null;
  agentId: string;
}

export interface OutreachOptions {
  templateId?: string;
  customMessage?: string;
  delaySecs?: number;
}

export interface OutreachResult {
  issueId: string | null;
  enqueued: boolean;
  reason?: string;
}

export async function startOutreachForAssignedLead(
  db: Db,
  companyId: string,
  lead: OutreachLeadInput,
  outreach: OutreachOptions = {},
): Promise<OutreachResult> {
  try {
    const [leadAgent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, lead.agentId), eq(agents.companyId, companyId)))
      .limit(1);

    if (!leadAgent) {
      return { issueId: null, enqueued: false, reason: "agent_not_found" };
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);

    const vars: Record<string, string> = {
      lead_name: lead.name,
      client_name: lead.name,
      agent_name: leadAgent.name,
      company_name: company?.name ?? "",
      phone: lead.phone,
      source: lead.source ?? "",
    };

    let templateId: string | null = null;
    let messageContent: string | null = null;

    if (outreach.customMessage && outreach.customMessage.trim()) {
      messageContent = renderTemplate(outreach.customMessage, vars);
    } else if (outreach.templateId) {
      const [tpl] = await db
        .select()
        .from(aygentWhatsappTemplates)
        .where(
          and(
            eq(aygentWhatsappTemplates.id, outreach.templateId),
            eq(aygentWhatsappTemplates.companyId, companyId),
          ),
        )
        .limit(1);
      if (!tpl?.content) {
        return { issueId: null, enqueued: false, reason: "template_not_found" };
      }
      templateId = tpl.id;
      messageContent = renderTemplate(tpl.content, vars);
    }

    const descriptionLines = [
      `Outreach started for assigned lead.`,
      "",
      `**Name:** ${lead.name}`,
      `**Phone:** ${lead.phone}`,
      lead.email ? `**Email:** ${lead.email}` : null,
      lead.source ? `**Source:** ${lead.source}` : null,
      messageContent ? `\n**Outbound message:**\n> ${messageContent.replace(/\n/g, "\n> ")}` : null,
      "",
    ]
      .filter((l) => l !== null)
      .join("\n");

    const [issue] = await db
      .insert(issues)
      .values({
        companyId,
        title: `Start outreach: ${lead.name}`,
        description: descriptionLines,
        status: "todo",
        priority: "high",
        assigneeAgentId: leadAgent.id,
        originKind: "board",
        originId: `start-outreach-${lead.id}`,
      })
      .returning();

    await logActivity(db, {
      companyId,
      actorType: "system",
      actorId: "outreach-service",
      action: "lead.outreach_started",
      entityType: "lead",
      entityId: lead.id,
      agentId: leadAgent.id,
      details: {
        source: lead.source ?? "manual",
        leadName: lead.name,
        phone: lead.phone,
        email: lead.email,
        issueId: issue?.id,
        templateId,
        usedCustomMessage: Boolean(outreach.customMessage && outreach.customMessage.trim()),
      },
    }).catch((err) => logger.warn({ err, leadId: lead.id }, "outreach: activity log failed"));

    let enqueued = false;
    let reason: string | undefined;

    if (messageContent) {
      // Create an approval entry. The approvals service will evaluate the agent's
      // metadata.autoApprove toggle — if on, auto-approves + executes immediately;
      // if off, waits for human approval in the CEO Chat.
      try {
        const approval = await approvalService(db).create(companyId, {
          type: "send_whatsapp",
          requestedByAgentId: leadAgent.id,
          status: "pending",
          payload: {
            type: "approval_required",
            action: "send_whatsapp",
            phone: lead.phone,
            message: messageContent,
            leadId: lead.id,
            leadName: lead.name,
            agentName: leadAgent.name,
            companyName: company?.name ?? "",
            templateId: templateId ?? undefined,
            context: `Outreach start · source: ${lead.source ?? "manual"}`,
          },
        });
        enqueued = Boolean(approval);
        if (!enqueued) reason = "approval_create_failed";
      } catch (err) {
        logger.warn({ err, leadId: lead.id }, "outreach: approval create failed");
        reason = "approval_create_failed";
      }
    } else {
      // No template/custom — fall back to rule-based auto-reply queue enqueue
      try {
        const result = await autoReplyService(db).enqueue({
          companyId,
          agentId: leadAgent.id,
          leadId: lead.id,
          leadSource: lead.source ?? "manual",
          recipientPhone: lead.phone,
          recipientEmail: lead.email ?? undefined,
          leadName: lead.name,
          agentName: leadAgent.name,
          companyName: company?.name,
        });
        enqueued = Boolean(result);
        if (!enqueued) reason = "no_matching_rule";
      } catch (err) {
        logger.warn({ err, leadId: lead.id }, "outreach: auto-reply enqueue failed");
        reason = "auto_reply_failed";
      }
    }

    return { issueId: issue?.id ?? null, enqueued, reason };
  } catch (err) {
    logger.warn({ err, leadId: lead.id }, "outreach: trigger failed");
    return { issueId: null, enqueued: false, reason: "exception" };
  }
}

/**
 * Look up a template by name within a company. Case-insensitive exact match.
 */
export async function findTemplateByName(
  db: Db,
  companyId: string,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const rows = await db
    .select({ id: aygentWhatsappTemplates.id, name: aygentWhatsappTemplates.name })
    .from(aygentWhatsappTemplates)
    .where(eq(aygentWhatsappTemplates.companyId, companyId));
  const lower = name.trim().toLowerCase();
  return rows.find((r) => r.name.toLowerCase() === lower) ?? null;
}

/**
 * Look up multiple leads by ID, scoped to company. Returns only those with phone numbers.
 */
export async function getLeadsForOutreach(
  db: Db,
  companyId: string,
  leadIds: string[],
): Promise<OutreachLeadInput[]> {
  if (leadIds.length === 0) return [];
  const rows = await db
    .select()
    .from(aygentLeads)
    .where(eq(aygentLeads.companyId, companyId));
  const idSet = new Set(leadIds);
  return rows
    .filter((l) => idSet.has(l.id) && l.agentId && l.phone)
    .map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone as string,
      email: l.email,
      source: l.source,
      agentId: l.agentId as string,
    }));
}
