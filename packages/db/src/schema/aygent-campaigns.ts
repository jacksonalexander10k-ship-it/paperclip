import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentCampaigns = pgTable(
  "aygent_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type"),
    status: text("status").default("active"),
    projectId: uuid("project_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("aygent_campaigns_company_idx").on(table.companyId),
    statusIdx: index("aygent_campaigns_status_idx").on(table.status),
  }),
);

export const aygentCampaignSteps = pgTable(
  "aygent_campaign_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull().references(() => aygentCampaigns.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    subject: text("subject"),
    body: text("body"),
    delayDays: integer("delay_days").default(1),
    delayHours: integer("delay_hours").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignStepUniqueIdx: uniqueIndex("aygent_campaign_steps_campaign_step_idx").on(table.campaignId, table.stepNumber),
  }),
);

export const aygentCampaignEnrollments = pgTable(
  "aygent_campaign_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull().references(() => aygentCampaigns.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull().references(() => aygentLeads.id, { onDelete: "cascade" }),
    currentStep: integer("current_step").default(0),
    status: text("status").default("active"),
    nextSendAt: timestamp("next_send_at", { withTimezone: true }),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    opens: integer("opens").default(0),
    clicks: integer("clicks").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignLeadUniqueIdx: uniqueIndex("aygent_campaign_enroll_campaign_lead_idx").on(table.campaignId, table.leadId),
    statusNextSendIdx: index("aygent_campaign_enroll_status_next_idx").on(table.status, table.nextSendAt),
  }),
);
