import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentDocuments = pgTable(
  "aygent_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id"),
    name: text("name").notNull(),
    type: text("type"),
    fileUrl: text("file_url"),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    leadId: uuid("lead_id").references(() => aygentLeads.id, { onDelete: "set null" }),
    projectId: uuid("project_id"),
    landlordId: uuid("landlord_id"),
    managedPropertyId: uuid("managed_property_id"),
    tenancyId: uuid("tenancy_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("aygent_documents_company_idx").on(table.companyId),
    leadIdx: index("aygent_documents_lead_idx").on(table.leadId),
    projectIdx: index("aygent_documents_project_idx").on(table.projectId),
  }),
);
