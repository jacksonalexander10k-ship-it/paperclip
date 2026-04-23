/**
 * Company Credentials — shared OAuth tokens per service per company.
 *
 * Replaces the 1:1 (agent → credential) model from aygent_agent_credentials
 * with a 1:many model so multiple agents can share the same underlying
 * OAuth token (e.g. two content agents both posting to the same Instagram
 * account without requiring two separate Meta OAuth flows).
 *
 * Each credential is OWNED by the agent that first connected it, tracked
 * via `connectedByAgentId`. Other agents can join the credential via the
 * aygent_agent_credential_links join table.
 *
 * Schema introduced in Sprint 0 of the connections rebuild. Populated on
 * migration by backfilling every existing aygent_agent_credentials row
 * into a new company credential + a matching "owner" link row.
 */

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

export const aygentCompanyCredentials = pgTable(
  "aygent_company_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    /** Service identifier: "whatsapp", "whatsapp_baileys", "gmail", "google_calendar", "facebook", "instagram", etc. */
    service: text("service").notNull(),

    /** Human-readable label for the account, shown in "join existing" dropdowns. e.g. "@jackson_properties", "mohammed@jackson.ae". */
    accountLabel: text("account_label"),

    /** The agent that originally connected this credential. If this agent is terminated and other agents have joined the credential, ownership auto-transfers. */
    connectedByAgentId: uuid("connected_by_agent_id")
      .references(() => agents.id, { onDelete: "set null" }),

    // ── OAuth tokens (stored plaintext for now; encryption deferred to a security sprint) ──
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),

    /** External account identifier (Facebook page ID, Instagram business account ID, ad account ID, etc.) */
    providerAccountId: text("provider_account_id"),

    /** WhatsApp phone number ID (for 360dialog / Meta Cloud API routing) */
    whatsappPhoneNumberId: text("whatsapp_phone_number_id"),

    /** Gmail address (for inbound webhook routing) */
    gmailAddress: text("gmail_address"),

    /** Space-separated OAuth scopes granted for this credential */
    scopes: text("scopes"),

    /** Token expiry — used by token-refresh worker */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** When the credential was first connected */
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyServiceIdx: index("aygent_company_cred_company_service_idx").on(
      table.companyId,
      table.service,
    ),
    // Prevent storing the same external account twice for the same company+service.
    // NOTE: this is nullable-aware — multiple rows with null providerAccountId are allowed
    // (e.g. WhatsApp Baileys sessions that don't use a Meta account ID).
    uniqueCompanyServiceAccount: uniqueIndex(
      "aygent_company_cred_company_service_account_uniq_idx",
    ).on(table.companyId, table.service, table.providerAccountId),
    whatsappPhoneIdx: index("aygent_company_cred_whatsapp_phone_idx").on(
      table.whatsappPhoneNumberId,
    ),
    gmailAddressIdx: index("aygent_company_cred_gmail_address_idx").on(
      table.gmailAddress,
    ),
  }),
);
