import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentCommissions } from "./aygent-commissions.js";
import { aygentDeals } from "./aygent-deals.js";

export const aygentInvoices = pgTable(
  "aygent_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    commissionId: uuid("commission_id").references(() => aygentCommissions.id, { onDelete: "set null" }),
    dealId: uuid("deal_id").references(() => aygentDeals.id, { onDelete: "set null" }),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceType: text("invoice_type").notNull(),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email"),
    clientPhone: text("client_phone"),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),
    vatAmount: integer("vat_amount").notNull(),
    total: integer("total").notNull(),
    status: text("status").notNull().default("draft"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    sentDate: timestamp("sent_date", { withTimezone: true }),
    paidDate: timestamp("paid_date", { withTimezone: true }),
    paidAmount: integer("paid_amount").default(0),
    agencyName: text("agency_name"),
    agencyRera: text("agency_rera"),
    agencyTrn: text("agency_trn"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("aygent_invoices_company_status_idx").on(table.companyId, table.status),
    companyInvoiceTypeIdx: index("aygent_invoices_company_invoice_type_idx").on(table.companyId, table.invoiceType),
  }),
);
