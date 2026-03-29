import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentPortals = pgTable(
  "aygent_portals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull().references(() => aygentLeads.id, { onDelete: "cascade" }),
    slug: text("slug"),
    isActive: boolean("is_active").default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    sharedProjects: jsonb("shared_projects").$type<string[]>(),
    sharedDocuments: jsonb("shared_documents").$type<string[]>(),
    customMessage: text("custom_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadUniqueIdx: uniqueIndex("aygent_portals_lead_idx").on(table.leadId),
    slugUniqueIdx: uniqueIndex("aygent_portals_slug_idx").on(table.slug),
    companyIdx: index("aygent_portals_company_idx").on(table.companyId),
  }),
);

export const aygentPortalActivity = pgTable(
  "aygent_portal_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portalId: uuid("portal_id").notNull().references(() => aygentPortals.id, { onDelete: "cascade" }),
    type: text("type"),
    projectId: uuid("project_id"),
    documentId: uuid("document_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    portalCreatedIdx: index("aygent_portal_activity_portal_created_idx").on(table.portalId, table.createdAt),
  }),
);
