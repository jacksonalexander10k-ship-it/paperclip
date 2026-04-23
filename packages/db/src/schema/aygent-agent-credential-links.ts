/**
 * Agent ↔ Credential Links — join table connecting agents to shared credentials.
 *
 * Each row represents one agent being linked to one company credential. Many
 * agents can be linked to the same credential (e.g. two content agents sharing
 * one Instagram account). The first link for a credential has role="owner";
 * subsequent joiners have role="joined".
 *
 * When an agent is deleted, their links are cascade-deleted. If the deleted
 * agent was the owner and other joined agents remain, ownership auto-transfers
 * to the earliest-linked remaining agent (handled at the service layer, not
 * the DB layer).
 *
 * Schema introduced in Sprint 0 of the connections rebuild.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { aygentCompanyCredentials } from "./aygent-company-credentials.js";

export const aygentAgentCredentialLinks = pgTable(
  "aygent_agent_credential_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    credentialId: uuid("credential_id")
      .notNull()
      .references(() => aygentCompanyCredentials.id, { onDelete: "cascade" }),

    /** "owner" = the agent that originally connected this credential; "joined" = any agent that later joined it. */
    role: text("role").notNull().default("joined"),

    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Each agent can only be linked to a given credential once.
    agentCredUniqueIdx: uniqueIndex("aygent_agent_cred_link_agent_cred_uniq_idx").on(
      table.agentId,
      table.credentialId,
    ),
    agentIdx: index("aygent_agent_cred_link_agent_idx").on(table.agentId),
    credIdx: index("aygent_agent_cred_link_cred_idx").on(table.credentialId),
  }),
);
