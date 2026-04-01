/**
 * Lead Ingestion Service
 *
 * Creates leads from parsed portal emails and wires them into the Paperclip
 * issue queue so the Lead Agent picks them up on its next heartbeat.
 *
 * Steps:
 *  1. Deduplicate — skip if a lead with the same phone already exists
 *  2. Insert into aygent_leads
 *  3. Find the active Lead/Sales agent for the company
 *  4. Create a Paperclip issue assigned to that agent with high priority
 */

import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentLeads, issues, agents } from "@paperclipai/db";
import type { ParsedLead } from "./portal-email-parser.js";
import { logActivity } from "./activity-log.js";

export interface IngestedLead {
  lead: typeof aygentLeads.$inferSelect;
  issue: typeof issues.$inferSelect | null;
}

export function leadIngestionService(db: Db) {
  return {
    ingestFromPortal: async (
      companyId: string,
      callingAgentId: string,
      parsed: ParsedLead,
    ): Promise<IngestedLead | null> => {
      // 1. Deduplicate by phone within company
      if (parsed.phone) {
        const existing = await db
          .select({ id: aygentLeads.id })
          .from(aygentLeads)
          .where(
            and(
              eq(aygentLeads.companyId, companyId),
              eq(aygentLeads.phone, parsed.phone),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          console.log(
            `[lead-ingestion] Duplicate phone ${parsed.phone} for company ${companyId} — skipping`,
          );
          return null;
        }
      }

      // 2. Insert lead
      const [lead] = await db
        .insert(aygentLeads)
        .values({
          companyId,
          name: parsed.name ?? "Unknown",
          phone: parsed.phone,
          email: parsed.email,
          source: parsed.source,
          stage: "lead",
          score: 5,
          notes: parsed.message ?? null,
        })
        .returning();

      console.log(
        `[lead-ingestion] Created lead ${lead.id} from ${parsed.source} (${parsed.name ?? "unknown"})`,
      );

      // 3. Find the active Lead / Sales agent for this company
      const [leadAgent] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.companyId, companyId),
            eq(agents.status, "active"),
          ),
        )
        .then((rows) =>
          // Prefer role "lead", fall back to "sales", then any active agent
          rows.sort((a, b) => {
            const roleRank = (role: string) =>
              role === "lead" ? 0 : role === "sales" ? 1 : 2;
            return roleRank(a.role) - roleRank(b.role);
          }),
        );

      if (!leadAgent) {
        console.warn(
          `[lead-ingestion] No active agent found for company ${companyId} — lead created without issue`,
        );
        return { lead, issue: null };
      }

      // 4. Create Paperclip issue assigned to the lead agent
      const sourceLabel = {
        property_finder: "Property Finder",
        bayut: "Bayut",
        dubizzle: "Dubizzle",
      }[parsed.source];

      const descriptionLines = [
        `New inbound lead from ${sourceLabel}.`,
        "",
        `**Name:** ${parsed.name ?? "Unknown"}`,
        parsed.phone ? `**Phone:** ${parsed.phone}` : null,
        parsed.email ? `**Email:** ${parsed.email}` : null,
        parsed.propertyRef ? `**Property Ref:** ${parsed.propertyRef}` : null,
        parsed.message ? `\n**Message:**\n> ${parsed.message}` : null,
        "",
        "Please qualify this lead, assign a score, and draft a WhatsApp response for approval.",
      ]
        .filter((l) => l !== null)
        .join("\n");

      const [issue] = await db
        .insert(issues)
        .values({
          companyId,
          title: `${sourceLabel} lead: ${parsed.name ?? parsed.phone ?? "Unknown"}`,
          description: descriptionLines,
          status: "todo",
          priority: "high",
          assigneeAgentId: leadAgent.id,
          originKind: "webhook",
          originId: `portal-lead-${lead.id}`,
        })
        .returning();

      console.log(
        `[lead-ingestion] Issue ${issue.id} created, assigned to agent ${leadAgent.name} (${leadAgent.id})`,
      );

      // 5. Log activity
      await logActivity(db, {
        companyId,
        actorType: "system",
        actorId: "gmail-webhook",
        action: "lead.portal_inbound",
        entityType: "lead",
        entityId: lead.id,
        agentId: leadAgent.id,
        details: {
          source: parsed.source,
          leadName: parsed.name,
          phone: parsed.phone,
          email: parsed.email,
          issueId: issue.id,
        },
      });

      return { lead, issue };
    },
  };
}
