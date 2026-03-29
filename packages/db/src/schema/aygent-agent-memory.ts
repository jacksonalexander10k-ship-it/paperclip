import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const aygentAgentMemory = pgTable(
  "aygent_agent_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    subject: text("subject").notNull(),
    content: text("content"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentSubjectTypeUniqueIdx: uniqueIndex("aygent_agent_memory_agent_subject_type_idx").on(table.agentId, table.subject, table.type),
    agentTypeIdx: index("aygent_agent_memory_agent_type_idx").on(table.agentId, table.type),
  }),
);
