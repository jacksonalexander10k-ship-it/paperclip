import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const aygentLeads = pgTable(
  "aygent_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    assignedBrokerId: uuid("assigned_broker_id"),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    nationality: text("nationality"),
    budget: jsonb("budget").$type<Record<string, unknown>>(),
    preferredAreas: jsonb("preferred_areas").$type<string[]>().default([]),
    propertyType: text("property_type"),
    timeline: text("timeline"),
    marketPreference: text("market_preference"),
    source: text("source"),
    stage: text("stage").notNull().default("lead"),
    notes: text("notes"),
    score: integer("score").notNull().default(0),
    scoreBreakdown: jsonb("score_breakdown").$type<Record<string, unknown>>(),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
    language: text("language"),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStageIdx: index("aygent_leads_company_stage_idx").on(table.companyId, table.stage),
    companyScoreIdx: index("aygent_leads_company_score_idx").on(table.companyId, table.score),
    agentIdx: index("aygent_leads_agent_idx").on(table.agentId),
    companyUpdatedIdx: index("aygent_leads_company_updated_idx").on(table.companyId, table.updatedAt),
  }),
);
