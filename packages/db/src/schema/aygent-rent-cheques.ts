import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentTenancies } from "./aygent-tenancies.js";

export const aygentRentCheques = pgTable(
  "aygent_rent_cheques",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    tenancyId: uuid("tenancy_id").notNull().references(() => aygentTenancies.id, { onDelete: "cascade" }),

    chequeNumber: text("cheque_number").notNull(),
    amount: integer("amount").notNull(), // AED
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"),
    // pending | deposited | cleared | bounced

    depositedDate: timestamp("deposited_date", { withTimezone: true }),
    clearedDate: timestamp("cleared_date", { withTimezone: true }),
    bouncedDate: timestamp("bounced_date", { withTimezone: true }),
    bankName: text("bank_name"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("aygent_rent_cheques_company_status_idx").on(table.companyId, table.status),
    tenancyIdx: index("aygent_rent_cheques_tenancy_idx").on(table.tenancyId),
    dueDateIdx: index("aygent_rent_cheques_due_date_idx").on(table.companyId, table.dueDate),
  }),
);
