import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentCallLogs = pgTable(
  "aygent_call_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id"),
    leadId: uuid("lead_id").references(() => aygentLeads.id, { onDelete: "set null" }),
    twilioCallSid: text("twilio_call_sid"),
    direction: text("direction"),
    purpose: text("purpose"),
    status: text("status"),
    durationSec: integer("duration_sec"),
    outcome: text("outcome"),
    transcript: text("transcript"),
    summary: text("summary"),
    costUsd: real("cost_usd"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    twilioCallSidUniqueIdx: uniqueIndex("aygent_call_logs_twilio_sid_idx").on(table.twilioCallSid),
    companyCreatedIdx: index("aygent_call_logs_company_created_idx").on(table.companyId, table.createdAt),
    leadIdx: index("aygent_call_logs_lead_idx").on(table.leadId),
  }),
);
