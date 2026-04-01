import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

/**
 * Inter-agent bulletin board messages. Agents post messages for other agents
 * to read on their next run. Supports structured alerts, summaries, and requests.
 */
export const aygentAgentMessages = pgTable(
  "aygent_agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    fromAgentId: uuid("from_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),

    /** null = broadcast to all agents in the company */
    toAgentId: uuid("to_agent_id").references(() => agents.id, { onDelete: "cascade" }),

    /** info | action | urgent — determines whether to trigger an immediate wake */
    priority: text("priority").notNull().default("info"),

    /** Structured message type: price_alert, lead_downgrade, content_published, demand_signal, viewing_outcome, etc. */
    messageType: text("message_type").notNull(),

    /** Human-readable summary of the message */
    summary: text("summary"),

    /** Structured payload — the actual data being communicated */
    data: jsonb("data"),

    /** Which agents have read this message (array of agent IDs) */
    readByAgents: jsonb("read_by_agents").notNull().default([]),

    /** Whether this message has been acted on (downstream action taken) */
    actedOn: boolean("acted_on").notNull().default(false),

    /** Auto-expire old messages */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyToAgentIdx: index("aygent_messages_company_to_agent_idx").on(
      table.companyId,
      table.toAgentId,
    ),
    companyFromAgentIdx: index("aygent_messages_company_from_agent_idx").on(
      table.companyId,
      table.fromAgentId,
    ),
    companyExpiresIdx: index("aygent_messages_company_expires_idx").on(
      table.companyId,
      table.expiresAt,
    ),
  }),
);
