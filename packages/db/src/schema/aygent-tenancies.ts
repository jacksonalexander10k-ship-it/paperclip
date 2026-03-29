import {
  pgTable,
  uuid,
  text,
  real,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentProperties } from "./aygent-properties.js";

export const aygentTenancies = pgTable(
  "aygent_tenancies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    managedPropertyId: uuid("managed_property_id").notNull().references(() => aygentProperties.id, { onDelete: "cascade" }),
    tenantName: text("tenant_name"),
    tenantPhone: text("tenant_phone"),
    tenantEmail: text("tenant_email"),
    tenantPassport: text("tenant_passport"),
    tenantEmiratesId: text("tenant_emirates_id"),
    tenantNationality: text("tenant_nationality"),
    tenantNotes: text("tenant_notes"),
    rent: real("rent"),
    leaseStart: timestamp("lease_start", { withTimezone: true }),
    leaseEnd: timestamp("lease_end", { withTimezone: true }),
    securityDeposit: real("security_deposit"),
    paymentFrequency: text("payment_frequency"),
    ejariNumber: text("ejari_number"),
    status: text("status").default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("aygent_tenancies_company_idx").on(table.companyId),
    managedPropertyIdx: index("aygent_tenancies_property_idx").on(table.managedPropertyId),
    companyStatusLeaseEndIdx: index("aygent_tenancies_company_status_lease_idx").on(table.companyId, table.status, table.leaseEnd),
  }),
);
