import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { aygentDeals } from "./aygent-deals.js";

export const aygentCommissions = pgTable(
  "aygent_commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").notNull().references(() => aygentDeals.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    dealType: text("deal_type").notNull(),
    grossAmount: integer("gross_amount").notNull(),
    commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
    agentSplitPct: numeric("agent_split_pct", { precision: 5, scale: 2 }),
    agentAmount: integer("agent_amount"),
    agencyAmount: integer("agency_amount"),
    vatAmount: integer("vat_amount"),
    totalWithVat: integer("total_with_vat"),
    status: text("status").notNull().default("earned"),
    invoiceNumber: text("invoice_number"),
    invoiceDate: timestamp("invoice_date", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    paidDate: timestamp("paid_date", { withTimezone: true }),
    paidAmount: integer("paid_amount"),
    source: text("source"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("aygent_commissions_company_status_idx").on(table.companyId, table.status),
    dealIdx: index("aygent_commissions_deal_idx").on(table.dealId),
    agentIdx: index("aygent_commissions_agent_idx").on(table.agentId),
  }),
);
