import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const aygentAgentCredentials = pgTable(
  "aygent_agent_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    providerAccountId: text("provider_account_id"),
    whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
    gmailAddress: text("gmail_address"),
    scopes: text("scopes"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentServiceIdx: index("aygent_agent_cred_agent_service_idx").on(table.agentId, table.service),
    companyIdx: index("aygent_agent_cred_company_idx").on(table.companyId),
  }),
);
