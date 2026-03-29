import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentActivities = pgTable(
  "aygent_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    leadId: uuid("lead_id").notNull().references(() => aygentLeads.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id"),
    type: text("type").notNull(),
    title: text("title"),
    body: text("body"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadCreatedIdx: index("aygent_activities_lead_created_idx").on(table.leadId, table.createdAt),
    companyTypeIdx: index("aygent_activities_company_type_idx").on(table.companyId, table.type),
  }),
);
