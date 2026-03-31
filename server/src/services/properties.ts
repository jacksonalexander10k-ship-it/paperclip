/**
 * Property Service
 *
 * CRUD for properties, pipeline summary, and lead-linking.
 */

import { and, eq, desc, sql, ilike, gte, lte } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  aygentProperties,
  aygentPropertyLeads,
  aygentLandlords,
  aygentLeads,
} from "@paperclipai/db";

export interface PropertyFilters {
  listingType?: string;
  pipelineStatus?: string;
  area?: string;
  bedrooms?: number;
  propertyType?: string;
  priceMin?: number;
  priceMax?: number;
}

export function propertyService(db: Db) {
  return {
    /** List properties with filters, lead count, landlord name, and pipeline summary */
    list: async (companyId: string, filters: PropertyFilters = {}) => {
      // Build where conditions
      const conditions = [eq(aygentProperties.companyId, companyId)];

      if (filters.listingType) {
        conditions.push(eq(aygentProperties.listingType, filters.listingType));
      }
      if (filters.pipelineStatus) {
        conditions.push(eq(aygentProperties.pipelineStatus, filters.pipelineStatus));
      }
      if (filters.area) {
        conditions.push(ilike(aygentProperties.area, `%${filters.area}%`));
      }
      if (filters.bedrooms !== undefined) {
        conditions.push(eq(aygentProperties.bedrooms, filters.bedrooms));
      }
      if (filters.propertyType) {
        conditions.push(eq(aygentProperties.propertyType, filters.propertyType));
      }
      if (filters.priceMin !== undefined) {
        conditions.push(gte(aygentProperties.rentalPrice, filters.priceMin));
      }
      if (filters.priceMax !== undefined) {
        conditions.push(lte(aygentProperties.rentalPrice, filters.priceMax));
      }

      const items = await db
        .select({
          id: aygentProperties.id,
          companyId: aygentProperties.companyId,
          landlordId: aygentProperties.landlordId,
          landlordName: aygentLandlords.name,
          unit: aygentProperties.unit,
          buildingName: aygentProperties.buildingName,
          streetAddress: aygentProperties.streetAddress,
          area: aygentProperties.area,
          propertyType: aygentProperties.propertyType,
          bedrooms: aygentProperties.bedrooms,
          bathrooms: aygentProperties.bathrooms,
          sqft: aygentProperties.sqft,
          floor: aygentProperties.floor,
          viewType: aygentProperties.viewType,
          parkingSpaces: aygentProperties.parkingSpaces,
          titleDeedNo: aygentProperties.titleDeedNo,
          photos: aygentProperties.photos,
          saleValue: aygentProperties.saleValue,
          purchasePrice: aygentProperties.purchasePrice,
          serviceCharge: aygentProperties.serviceCharge,
          listingType: aygentProperties.listingType,
          rentalPrice: aygentProperties.rentalPrice,
          pipelineStatus: aygentProperties.pipelineStatus,
          status: aygentProperties.status,
          notes: aygentProperties.notes,
          createdAt: aygentProperties.createdAt,
          updatedAt: aygentProperties.updatedAt,
          leadCount: sql<number>`(
            SELECT COUNT(*)::int FROM aygent_property_leads
            WHERE aygent_property_leads.property_id = ${aygentProperties.id}
          )`,
        })
        .from(aygentProperties)
        .leftJoin(
          aygentLandlords,
          eq(aygentProperties.landlordId, aygentLandlords.id),
        )
        .where(and(...conditions))
        .orderBy(desc(aygentProperties.createdAt));

      // Pipeline summary counts
      const summaryRows = await db
        .select({
          pipelineStatus: aygentProperties.pipelineStatus,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(aygentProperties)
        .where(eq(aygentProperties.companyId, companyId))
        .groupBy(aygentProperties.pipelineStatus);

      const summary: Record<string, number> = {};
      for (const row of summaryRows) {
        summary[row.pipelineStatus ?? "unknown"] = row.count;
      }

      return { items, summary };
    },

    /** Get a single property with landlord details */
    getById: async (companyId: string, propertyId: string) => {
      const rows = await db
        .select({
          id: aygentProperties.id,
          companyId: aygentProperties.companyId,
          landlordId: aygentProperties.landlordId,
          landlordName: aygentLandlords.name,
          landlordPhone: aygentLandlords.phone,
          landlordEmail: aygentLandlords.email,
          unit: aygentProperties.unit,
          buildingName: aygentProperties.buildingName,
          streetAddress: aygentProperties.streetAddress,
          area: aygentProperties.area,
          propertyType: aygentProperties.propertyType,
          bedrooms: aygentProperties.bedrooms,
          bathrooms: aygentProperties.bathrooms,
          sqft: aygentProperties.sqft,
          floor: aygentProperties.floor,
          viewType: aygentProperties.viewType,
          parkingSpaces: aygentProperties.parkingSpaces,
          titleDeedNo: aygentProperties.titleDeedNo,
          photos: aygentProperties.photos,
          saleValue: aygentProperties.saleValue,
          purchasePrice: aygentProperties.purchasePrice,
          serviceCharge: aygentProperties.serviceCharge,
          listingType: aygentProperties.listingType,
          rentalPrice: aygentProperties.rentalPrice,
          pipelineStatus: aygentProperties.pipelineStatus,
          status: aygentProperties.status,
          notes: aygentProperties.notes,
          createdAt: aygentProperties.createdAt,
          updatedAt: aygentProperties.updatedAt,
        })
        .from(aygentProperties)
        .leftJoin(
          aygentLandlords,
          eq(aygentProperties.landlordId, aygentLandlords.id),
        )
        .where(
          and(
            eq(aygentProperties.companyId, companyId),
            eq(aygentProperties.id, propertyId),
          ),
        );
      return rows[0] ?? null;
    },

    /** Create a new property */
    create: async (
      companyId: string,
      data: Omit<typeof aygentProperties.$inferInsert, "id" | "companyId" | "createdAt" | "updatedAt">,
    ) => {
      const [property] = await db
        .insert(aygentProperties)
        .values({
          ...data,
          companyId,
          pipelineStatus: data.pipelineStatus ?? "available",
        })
        .returning();
      return property;
    },

    /** Partial update a property */
    update: async (
      companyId: string,
      propertyId: string,
      data: Partial<Omit<typeof aygentProperties.$inferInsert, "id" | "companyId" | "createdAt">>,
    ) => {
      const [property] = await db
        .update(aygentProperties)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(aygentProperties.companyId, companyId),
            eq(aygentProperties.id, propertyId),
          ),
        )
        .returning();
      return property ?? null;
    },

    /** Soft delete — set pipelineStatus to "inactive" */
    remove: async (companyId: string, propertyId: string) => {
      const [property] = await db
        .update(aygentProperties)
        .set({ pipelineStatus: "inactive", updatedAt: new Date() })
        .where(
          and(
            eq(aygentProperties.companyId, companyId),
            eq(aygentProperties.id, propertyId),
          ),
        )
        .returning();
      return property ?? null;
    },

    /** List leads linked to a property */
    listPropertyLeads: async (companyId: string, propertyId: string) => {
      return db
        .select({
          id: aygentLeads.id,
          name: aygentLeads.name,
          phone: aygentLeads.phone,
          email: aygentLeads.email,
          score: aygentLeads.score,
          stage: aygentLeads.stage,
          interestLevel: aygentPropertyLeads.interestLevel,
          linkedAt: aygentPropertyLeads.createdAt,
        })
        .from(aygentPropertyLeads)
        .innerJoin(aygentLeads, eq(aygentPropertyLeads.leadId, aygentLeads.id))
        .where(
          and(
            eq(aygentPropertyLeads.companyId, companyId),
            eq(aygentPropertyLeads.propertyId, propertyId),
          ),
        );
    },

    /** Link a lead to a property */
    linkLead: async (
      companyId: string,
      propertyId: string,
      leadId: string,
      interestLevel?: string,
    ) => {
      const [link] = await db
        .insert(aygentPropertyLeads)
        .values({
          companyId,
          propertyId,
          leadId,
          interestLevel: interestLevel ?? "interested",
        })
        .onConflictDoNothing()
        .returning();
      return link ?? null;
    },

    /** Unlink a lead from a property */
    unlinkLead: async (
      companyId: string,
      propertyId: string,
      leadId: string,
    ) => {
      await db
        .delete(aygentPropertyLeads)
        .where(
          and(
            eq(aygentPropertyLeads.companyId, companyId),
            eq(aygentPropertyLeads.propertyId, propertyId),
            eq(aygentPropertyLeads.leadId, leadId),
          ),
        );
      return { unlinked: true };
    },
  };
}
