import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { approvals } from "./approvals.js";

/**
 * Agent learnings captured from owner corrections (edit-before-approve, rejections)
 * and outcome observations. Injected into agent runs to improve future output.
 */
export const aygentAgentLearnings = pgTable(
  "aygent_agent_learnings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }),

    /** correction | rejection | observation | outcome | compacted */
    type: text("type").notNull(),

    /** What the agent was trying to do: send_whatsapp, post_instagram, etc. */
    actionType: text("action_type"),

    /** The context of the action (lead name, area, language, etc.) */
    context: text("context"),

    /** What the agent originally produced */
    original: text("original"),

    /** What the owner changed it to (null for rejections) */
    corrected: text("corrected"),

    /** Owner's note on why they made the change */
    reason: text("reason"),

    /** How many times this learning has been injected into agent runs */
    appliedCount: integer("applied_count").notNull().default(0),

    /** Whether this learning is active (false = archived/deleted by owner) */
    active: boolean("active").notNull().default(true),

    /** For compacted learnings: IDs of the source learnings that were compacted */
    sourceIds: jsonb("source_ids"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentActiveIdx: index("aygent_learnings_company_agent_active_idx").on(
      table.companyId,
      table.agentId,
      table.active,
    ),
    companyAgentTypeIdx: index("aygent_learnings_company_agent_type_idx").on(
      table.companyId,
      table.agentId,
      table.type,
    ),
    approvalIdx: index("aygent_learnings_approval_idx").on(table.approvalId),
  }),
);
