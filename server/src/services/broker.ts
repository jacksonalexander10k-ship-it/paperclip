/**
 * Broker Service
 *
 * Provides limited access for human brokers:
 * - View only their assigned leads
 * - Log actions (called, visited, notes)
 * - Request help from CEO via issues
 */

import { and, eq, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentLeads, issueComments, issues } from "@paperclipai/db";

export function brokerService(db: Db) {
  return {
    /** List leads assigned to a specific broker */
    listLeads: async (companyId: string, brokerId: string) => {
      return db
        .select()
        .from(aygentLeads)
        .where(
          and(
            eq(aygentLeads.companyId, companyId),
            eq(aygentLeads.assignedBrokerId, brokerId),
          ),
        )
        .orderBy(desc(aygentLeads.updatedAt));
    },

    /** Get a single lead (only if assigned to this broker) */
    getLead: async (companyId: string, brokerId: string, leadId: string) => {
      const rows = await db
        .select()
        .from(aygentLeads)
        .where(
          and(
            eq(aygentLeads.companyId, companyId),
            eq(aygentLeads.assignedBrokerId, brokerId),
            eq(aygentLeads.id, leadId),
          ),
        );
      return rows[0] ?? null;
    },

    /** Log a broker action on a lead */
    logAction: async (
      companyId: string,
      brokerId: string,
      leadId: string,
      action: string,
      notes?: string,
    ) => {
      // Update lead's last contact time
      await db
        .update(aygentLeads)
        .set({
          lastContactAt: new Date(),
          updatedAt: new Date(),
          notes: notes ?? undefined,
        })
        .where(
          and(
            eq(aygentLeads.id, leadId),
            eq(aygentLeads.assignedBrokerId, brokerId),
          ),
        );

      return { logged: true, action, leadId };
    },

    /** Create a help request (issue) from broker to CEO */
    requestHelp: async (
      companyId: string,
      brokerId: string,
      title: string,
      description: string,
    ) => {
      const [issue] = await db
        .insert(issues)
        .values({
          companyId,
          title: `Broker request: ${title}`,
          description,
          status: "todo",
          priority: "high",
          createdByUserId: brokerId,
          originKind: "manual",
        })
        .returning();
      return issue;
    },
  };
}
