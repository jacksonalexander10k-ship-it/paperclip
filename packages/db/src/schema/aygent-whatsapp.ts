import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentWhatsappMessages = pgTable(
  "aygent_whatsapp_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    leadId: uuid("lead_id").references(() => aygentLeads.id, { onDelete: "set null" }),
    chatJid: text("chat_jid"),
    messageId: text("message_id"),
    fromMe: boolean("from_me"),
    senderName: text("sender_name"),
    senderPhone: text("sender_phone"),
    content: text("content"),
    mediaType: text("media_type"),
    mediaUrl: text("media_url"),
    status: text("status").default("received"),
    timestamp: timestamp("timestamp", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    messageIdUniqueIdx: uniqueIndex("aygent_wa_msg_message_id_idx").on(table.messageId),
    companyAgentChatIdx: index("aygent_wa_msg_company_agent_chat_idx").on(table.companyId, table.agentId, table.chatJid, table.timestamp),
    leadIdx: index("aygent_wa_msg_lead_idx").on(table.leadId),
  }),
);
