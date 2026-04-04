import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

/**
 * Stores Baileys SignalProtocol credentials (one row per agent session).
 * This is the "creds" portion of Baileys' auth state.
 */
export const aygentBaileysAuth = pgTable(
  "aygent_baileys_auth",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    credsJson: text("creds_json"),
    phoneNumber: text("phone_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueAgent: uniqueIndex("aygent_baileys_auth_agent_idx").on(table.agentId),
    companyIdx: index("aygent_baileys_auth_company_idx").on(table.companyId),
  }),
);

/**
 * Stores Baileys SignalProtocol keys (pre-keys, sessions, sender-keys, etc.).
 * Many rows per agent — Baileys reads/writes these frequently.
 */
export const aygentBaileysKeys = pgTable(
  "aygent_baileys_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    keyType: text("key_type").notNull(),
    keyId: text("key_id").notNull(),
    keyData: text("key_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueKey: uniqueIndex("aygent_baileys_keys_unique").on(table.agentId, table.keyType, table.keyId),
    agentIdx: index("aygent_baileys_keys_agent_idx").on(table.agentId),
  }),
);
