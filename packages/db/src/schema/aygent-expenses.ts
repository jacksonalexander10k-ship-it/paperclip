import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const aygentExpenses = pgTable(
  "aygent_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),
    vatAmount: integer("vat_amount").default(0),
    date: timestamp("date", { withTimezone: true }).notNull(),
    recurring: text("recurring"),
    vendor: text("vendor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCategoryIdx: index("aygent_expenses_company_category_idx").on(table.companyId, table.category),
    companyDateIdx: index("aygent_expenses_company_date_idx").on(table.companyId, table.date),
  }),
);
