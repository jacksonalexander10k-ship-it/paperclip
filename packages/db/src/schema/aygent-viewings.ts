import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentViewings = pgTable(
  "aygent_viewings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id"),
    leadId: uuid("lead_id").references(() => aygentLeads.id, { onDelete: "set null" }),
    projectId: uuid("project_id"),
    calendarEventId: text("calendar_event_id"),
    datetime: timestamp("datetime", { withTimezone: true }),
    location: text("location"),
    status: text("status").default("scheduled"),
    reminderSent: boolean("reminder_sent").default(false),
    confirmationSent: boolean("confirmation_sent").default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyDatetimeIdx: index("aygent_viewings_company_datetime_idx").on(table.companyId, table.datetime),
    leadIdx: index("aygent_viewings_lead_idx").on(table.leadId),
    statusIdx: index("aygent_viewings_status_idx").on(table.status),
  }),
);
