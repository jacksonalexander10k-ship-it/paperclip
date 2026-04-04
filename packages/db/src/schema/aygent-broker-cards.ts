import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const aygentBrokerCards = pgTable(
  "aygent_broker_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    brokerName: text("broker_name").notNull(),
    reraCardNumber: text("rera_card_number"),
    reraBrn: text("rera_brn"),
    issueDate: timestamp("issue_date", { withTimezone: true }),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    dreiTrainingDate: timestamp("drei_training_date", { withTimezone: true }),
    dreiCertificateId: text("drei_certificate_id"),
    amlTrainingDate: timestamp("aml_training_date", { withTimezone: true }),
    amlTrainingExpiry: timestamp("aml_training_expiry", { withTimezone: true }),
    phone: text("phone"),
    email: text("email"),
    areasFocus: jsonb("areas_focus").$type<string[]>().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("aygent_broker_cards_company_status_idx").on(table.companyId, table.status),
    companyExpiryDateIdx: index("aygent_broker_cards_company_expiry_date_idx").on(table.companyId, table.expiryDate),
  }),
);
