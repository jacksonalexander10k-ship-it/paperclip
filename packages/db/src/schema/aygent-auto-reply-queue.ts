import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { aygentLeads } from "./aygent-leads.js";

/**
 * Delayed auto-reply send queue.
 *
 * When a new lead arrives (WhatsApp, portal, Facebook Ad), an entry is queued
 * here with a `sendAt` timestamp (typically now + 60 seconds). A background
 * processor polls this table and sends the message once `sendAt` has passed.
 *
 * This avoids instant-bot-feeling replies while still responding fast.
 */
export const aygentAutoReplyQueue = pgTable(
  "aygent_auto_reply_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => aygentLeads.id, { onDelete: "set null" }),
    /** "whatsapp" or "email" */
    channel: text("channel").notNull(),
    /** Recipient phone or email address */
    recipient: text("recipient").notNull(),
    /** Template ID from aygent_whatsapp_templates (if template-based) */
    templateId: uuid("template_id"),
    /** Pre-rendered message content (used for free-form or pre-merged template) */
    messageContent: text("message_content"),
    /** Email subject line (email channel only) */
    emailSubject: text("email_subject"),
    /** Lead source that triggered this auto-reply */
    leadSource: text("lead_source"),
    /** When this message should be sent */
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pendingSendAtIdx: index("aygent_auto_reply_pending_idx").on(table.status, table.sendAt),
    companyIdx: index("aygent_auto_reply_company_idx").on(table.companyId),
  }),
);

/**
 * Per-company mapping of lead source → auto-reply template.
 *
 * Configurable in the dashboard. When a lead arrives from a given source,
 * the system looks up this table to find which template to auto-send.
 * If no mapping exists, no auto-reply is sent (agent handles manually).
 */
export const aygentAutoReplyRules = pgTable(
  "aygent_auto_reply_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    /** Lead source: "whatsapp", "property_finder", "bayut", "dubizzle", "facebook_ad", "landing_page", "instagram" */
    leadSource: text("lead_source").notNull(),
    /** "whatsapp" or "email" — which channel to reply on */
    replyChannel: text("reply_channel").notNull().default("whatsapp"),
    /** Template ID to use (from aygent_whatsapp_templates) */
    templateId: uuid("template_id"),
    /** Or a fixed message content (used instead of templateId if set) */
    fixedMessage: text("fixed_message"),
    /** Email subject (if reply channel is email) */
    emailSubject: text("email_subject"),
    /** Delay in seconds before sending (default 60) */
    delaySecs: integer("delay_secs").notNull().default(60),
    /** Whether this rule is active */
    enabled: text("enabled").notNull().default("true"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySourceIdx: index("aygent_auto_reply_rules_company_source_idx").on(table.companyId, table.leadSource),
  }),
);
