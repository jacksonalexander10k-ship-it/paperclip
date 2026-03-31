import { pgTable, uuid, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents as agentsTable } from "./agents.js";

export const aygentWhatsappWindows = pgTable(
  "aygent_whatsapp_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agentsTable.id, { onDelete: "cascade" }),
    chatJid: text("chat_jid").notNull(),
    windowOpenedAt: timestamp("window_opened_at", { withTimezone: true }).notNull(),
    windowExpiresAt: timestamp("window_expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    uniqueAgentChat: unique("aygent_whatsapp_windows_unique").on(table.agentId, table.chatJid),
    companyIdx: index("aygent_whatsapp_windows_company_idx").on(table.companyId),
  }),
);
