import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const aygentLandlords = pgTable(
  "aygent_landlords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    dob: text("dob"),
    passport: text("passport"),
    emiratesId: text("emirates_id"),
    nationality: text("nationality"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("aygent_landlords_company_idx").on(table.companyId),
    companyNameIdx: index("aygent_landlords_company_name_idx").on(table.companyId, table.name),
  }),
);
