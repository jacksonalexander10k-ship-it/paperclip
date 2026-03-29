import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const aygentCallConfigs = pgTable(
  "aygent_call_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    agentName: text("agent_name").default("Ayla"),
    agencyName: text("agency_name"),
    voice: text("voice").default("Kore"),
    language: text("language").default("auto"),
    systemPromptBase: text("system_prompt_base"),
    fillerPhrases: jsonb("filler_phrases").$type<string[]>(),
    noAnswerBehavior: text("no_answer_behavior").default("hangup"),
    voicemailScript: text("voicemail_script"),
    retryCount: integer("retry_count").default(2),
    inboundEnabled: boolean("inbound_enabled").default(false),
    inboundGreeting: text("inbound_greeting"),
    inboundAfterHours: text("inbound_after_hours"),
    inboundAlwaysAnswer: boolean("inbound_always_answer").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentUniqueIdx: uniqueIndex("aygent_call_configs_company_agent_idx").on(table.companyId, table.agentId),
  }),
);

export const aygentCallScripts = pgTable(
  "aygent_call_scripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    configId: uuid("config_id").notNull().references(() => aygentCallConfigs.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    openingLine: text("opening_line"),
    keyPoints: jsonb("key_points").$type<string[]>(),
    onYes: text("on_yes"),
    onNo: text("on_no"),
    onCallback: text("on_callback"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    configPurposeUniqueIdx: uniqueIndex("aygent_call_scripts_config_purpose_idx").on(table.configId, table.purpose),
  }),
);
