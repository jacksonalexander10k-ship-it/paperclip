import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentTags = pgTable(
  "aygent_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    behavior: jsonb("behavior").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNameUniqueIdx: uniqueIndex("aygent_tags_company_name_idx").on(table.companyId, table.name),
  }),
);

export const aygentLeadTags = pgTable(
  "aygent_lead_tags",
  {
    leadId: uuid("lead_id").notNull().references(() => aygentLeads.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => aygentTags.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.leadId, table.tagId] }),
  }),
);
