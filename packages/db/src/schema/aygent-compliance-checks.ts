import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentDeals } from "./aygent-deals.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentComplianceChecks = pgTable(
  "aygent_compliance_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => aygentDeals.id, { onDelete: "set null" }),
    leadId: uuid("lead_id").references(() => aygentLeads.id, { onDelete: "set null" }),
    clientName: text("client_name").notNull(),
    clientType: text("client_type").notNull(),
    nationality: text("nationality"),
    emiratesId: text("emirates_id"),
    passportNumber: text("passport_number"),
    checkType: text("check_type").notNull(),
    status: text("status").notNull().default("pending"),
    documentsCollected: jsonb("documents_collected").$type<Record<string, boolean>>().default({}),
    riskLevel: text("risk_level"),
    flagReason: text("flag_reason"),
    resolution: text("resolution"),
    checkedBy: text("checked_by"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCheckTypeStatusIdx: index("aygent_compliance_checks_company_check_type_status_idx").on(table.companyId, table.checkType, table.status),
    dealIdx: index("aygent_compliance_checks_deal_idx").on(table.dealId),
    clientNameIdx: index("aygent_compliance_checks_client_name_idx").on(table.clientName),
  }),
);
