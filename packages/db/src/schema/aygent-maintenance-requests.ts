import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentProperties } from "./aygent-properties.js";
import { aygentTenancies } from "./aygent-tenancies.js";

export const aygentMaintenanceRequests = pgTable(
  "aygent_maintenance_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => aygentProperties.id, { onDelete: "set null" }),
    tenancyId: uuid("tenancy_id").references(() => aygentTenancies.id, { onDelete: "set null" }),

    category: text("category").notNull(),
    // plumbing | electrical | ac | painting | pest | general | other
    description: text("description").notNull(),
    priority: text("priority").notNull().default("medium"),
    // low | medium | high | urgent
    status: text("status").notNull().default("open"),
    // open | assigned | in_progress | completed | cancelled

    contractorName: text("contractor_name"),
    contractorPhone: text("contractor_phone"),
    estimatedCost: integer("estimated_cost"),
    actualCost: integer("actual_cost"),

    assignedDate: timestamp("assigned_date", { withTimezone: true }),
    completedDate: timestamp("completed_date", { withTimezone: true }),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("aygent_maintenance_company_status_idx").on(table.companyId, table.status),
    propertyIdx: index("aygent_maintenance_property_idx").on(table.propertyId),
    priorityIdx: index("aygent_maintenance_priority_idx").on(table.companyId, table.priority),
  }),
);
