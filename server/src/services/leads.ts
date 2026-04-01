/**
 * Leads Service
 *
 * CRUD for aygent_leads with filtering, scoring, and soft delete.
 */

import { and, eq, desc, gte, lte, ilike, or } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentLeads } from "@paperclipai/db";

export interface LeadFilters {
  source?: string;
  stage?: string;
  scoreMin?: number;
  scoreMax?: number;
  search?: string;
}

export function leadService(db: Db) {
  return {
    /** List leads with filters, ordered by updatedAt desc */
    list: async (companyId: string, filters: LeadFilters = {}) => {
      const conditions = [eq(aygentLeads.companyId, companyId)];

      if (filters.source) {
        conditions.push(eq(aygentLeads.source, filters.source));
      }
      if (filters.stage) {
        conditions.push(eq(aygentLeads.stage, filters.stage));
      }
      if (filters.scoreMin !== undefined) {
        conditions.push(gte(aygentLeads.score, filters.scoreMin));
      }
      if (filters.scoreMax !== undefined) {
        conditions.push(lte(aygentLeads.score, filters.scoreMax));
      }
      if (filters.search) {
        const pattern = `%${filters.search}%`;
        conditions.push(
          or(
            ilike(aygentLeads.name, pattern),
            ilike(aygentLeads.phone, pattern),
            ilike(aygentLeads.email, pattern),
          )!,
        );
      }

      return db
        .select()
        .from(aygentLeads)
        .where(and(...conditions))
        .orderBy(desc(aygentLeads.updatedAt));
    },

    /** Get a single lead scoped to company */
    getById: async (companyId: string, leadId: string) => {
      const rows = await db
        .select()
        .from(aygentLeads)
        .where(
          and(
            eq(aygentLeads.companyId, companyId),
            eq(aygentLeads.id, leadId),
          ),
        );
      return rows[0] ?? null;
    },

    /** Create a new lead */
    create: async (
      companyId: string,
      data: Omit<typeof aygentLeads.$inferInsert, "id" | "companyId" | "createdAt" | "updatedAt">,
    ) => {
      const [lead] = await db
        .insert(aygentLeads)
        .values({
          ...data,
          companyId,
        })
        .returning();
      return lead;
    },

    /** Partial update a lead */
    update: async (
      companyId: string,
      leadId: string,
      data: Partial<Omit<typeof aygentLeads.$inferInsert, "id" | "companyId" | "createdAt">>,
    ) => {
      const [lead] = await db
        .update(aygentLeads)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(aygentLeads.companyId, companyId),
            eq(aygentLeads.id, leadId),
          ),
        )
        .returning();
      return lead ?? null;
    },

    /** Soft delete — set stage to "archived" */
    remove: async (companyId: string, leadId: string) => {
      const [lead] = await db
        .update(aygentLeads)
        .set({ stage: "archived", updatedAt: new Date() })
        .where(
          and(
            eq(aygentLeads.companyId, companyId),
            eq(aygentLeads.id, leadId),
          ),
        )
        .returning();
      return lead ?? null;
    },
  };
}
